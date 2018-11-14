const fs = require('fs');
const express = require('express');
const RateLimit = require('express-rate-limit');
const moment = require('moment');
const cors = require('cors');
const bodyParser = require('body-parser');
const randomstring = require("randomstring");
const nodemailer = require('nodemailer');
const aws = require('aws-sdk');
const middleware = require('../middleware');
const validate = require('../validate');
const errorGuard = require('../error-guard');
const util = require('../util');
const fail = require('../fail');

const CODE_LENGTH = 64;

module.exports = function(config) {
  function replaceProtocol(str) {
    return str.replace(/^\w+:\/\/(www\.)?/, '');
  }
  config.hostWithoutProtocol = replaceProtocol(config.host);

  async function sendEmail(to, subject, body) {
    if (!config.email) {
      console.log("Warning: email is not set up for this server");
      return Promise.resolve();
    }
    const emailConfig = JSON.parse(JSON.stringify(config.email || {}));
    if (!emailConfig.from) throw new Error("Must specify 'from' in email configuration");
    return new Promise((resolve, reject) => {
      if (emailConfig.file) {
        fs.writeFileSync(config.email.file, [to, subject, body].join('\n'));
        resolve();
      } else {
        let nmOpts = emailConfig;
        if (emailConfig.SES) {
          Object.assign(nmOpts, emailConfig, {SES: new aws.SES(emailConfig.SES)});
        }
        transporter = nodemailer.createTransport(nmOpts);
        let email = {
          to,
          subject,
          from: emailConfig.from,
          html: body,
        }
        transporter.sendMail(email, (error, info) => {
          if (error) reject(error);
          else resolve(info);
        })
      }
    })
  }

  const router = new express.Router();

  router.get('/me', cors(), middleware.authenticate(config), errorGuard((req, res) => {
    if (!req.user) return fail("You are not logged in", 401);
    const user = Object.assign({$: {id: req.db.user.id}}, req.db.user.data);
    res.json(user);
  }));

  router.get('/authorize', errorGuard((req, res) => {
    req.query.scope = req.query.scope || '';
    const error = validate.validators.url(req.query.origin || '') || validate.validators.scope(req.query.scope);
    if (error) return fail(error, 400);
    req.query.originNoProtocol = replaceProtocol(req.query.origin);
    const scopes = req.query.scope ? util.scopes(req.query.scope) : null;
    res.render('authorize', {query: req.query, config, scopes});
  }));
  router.post('/authorize', new RateLimit(config.rateLimit.createUser), middleware.authorize(config));

  router.get(['/register', '/register/:username'], middleware.checkUsername);
  router.post(['/register', '/register/:username'],
        new RateLimit(config.rateLimit.createUser),
        errorGuard(async (req, res, next) => {
          const auth = req.get('authorization');
          if (!auth) {
            return fail("Invalid authorization header", 400);
          }
          const parts = auth.split(' ');
          if (parts[0] === 'Basic') {
            const creds = (new Buffer(parts[1], 'base64')).toString().split(':');
            if (creds.length !== 2) return fail("Invalid authorization header", 400);
            const email = creds[0];
            const password = creds[1];
            const code = randomstring.generate(CODE_LENGTH);
            const user = await req.systemDB.createUser(email, password, req.params.username, code);
            const link = config.host + '/users/confirm_email?code=' + encodeURIComponent(code) + '&email=' + encodeURIComponent(email);
            await sendEmail(email, `Welcome to OneDB! Please confirm your email address`, `
              <a href="${link}">Click here</a> to confirm your email address for the OneDB instance at ${config.hostWithoutProtocol}
            `)
            res.json(user.$.id);
          } else {
            return fail("Invalid authorization header", 400);
          }
        }));

  router.get('/confirm_email', errorGuard(async (req, res, next) => {
    if (typeof req.query.code !== 'string') {
      return fail("Invalid confirmation code", 400);
    }
    let err = validate.validators.email(req.query.email);
    if (err) {
      return fail("Invalid email", 400);
    }
    const collection = req.systemDB.db.collection('system-user_private');
    const query = {
      'data.email': req.query.email,
      'data.email_confirmation.code': req.query.code,
      'data.email_confirmation.expires': {$gt: moment().toISOString()},
    };
    const update = {$set: {'data.email_confirmation.confirmed': true, 'data.email_confirmation.code': null}};
    const updated = await collection.updateOne(query, update);
    if (updated.result.nModified !== 1) {
      return fail("Confirmation code is invalid or expired", 400);
    }
    res.end("Thanks! Your email has been confirmed.");
  }));

  router.get('/reset_password', errorGuard(async (req, res, next) => {
    res.render('reset_password', {code: req.query.code});
  }));

  router.post('/start_reset_password', errorGuard(async (req, res, next) => {
    if (!config.email) {
      return fail("Email is not set up for this OneDB instance. Please contact the owner to reset your password.");
    }
    if (validate.validators.email(req.query.email)) {
      return fail("Must supply an email address", 400);
    }
    function finish() {
      res.end("An email has been sent to your inbox.");
    }
    const collection = req.systemDB.db.collection('system-user_private');
    const userQuery = {'data.email': req.query.email};
    const userPrivate = await collection.findOne(userQuery);
    if (!userPrivate) {
      await sendEmail(req.query.email, "OneDB password reset request", `
        Someone asked to reset the OneDB password for this email address. However, we don't have a user with this email address on file.
        <br><br>
        We suggest trying a different email address, or a different OneDB instance.
      `);
      return finish()
    }
    const code = randomstring.generate(CODE_LENGTH);
    await collection.updateOne(userQuery, {$set: {
      'password_reset.code': code,
      'password_reset.expires': moment().add(1, 'days').toISOString(),
    }});
    const link = config.host + '/users/reset_password?code=' + encodeURIComponent(code);
    await sendEmail(req.query.email, "Reset your OneDB password", `
      <a href="${link}">Click here</a> to reset your password on the OneDB instance at ${config.hostWithoutProtocol}, or paste the link below into your browser.
      <br><br>
      ${link}
    `);
    finish();
  }));

  router.post('/reset_password', bodyParser.json(), errorGuard(async (req, res, next) => {
    if (typeof req.body.code !== 'string') return fail("Invalid code", 400);
    const collection = req.systemDB.db.collection('system-user_private');
    const query = {
      'password_reset.code': req.body.code,
      'password_reset.expires': {$gt: moment().toISOString()},
    }
    const userPrivate = await collection.findOne(query);
    if (!userPrivate) return fail("Link is invalid or expired", 404);
    await req.systemDB.setPassword(userPrivate.data.id, req.body.newPassword);
    await collection.updateOne(query, {$set: {password_reset: {}}});
    res.send("Password successfully reset");
  }));

  return router;
}
