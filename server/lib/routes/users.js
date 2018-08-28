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
const config = require('../config');

const CODE_LENGTH = 64;

async function sendEmail(to, subject, body) {
  const emailConfig = JSON.parse(JSON.stringify(config.email));
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

function replaceProtocol(str) {
  return str.replace(/^\w+:\/\/(www\.)?/, '');
}
config.hostWithoutProtocol = replaceProtocol(config.host);

const router = module.exports = new express.Router();
router.get('/me', cors(), middleware.authenticate, (req, res) => {
  if (!req.user) return fail("You are not logged in", 401);
  const user = Object.assign({$: {id: req.db.user.id}}, req.db.user.data);
  res.json(user);
});

router.get('/authorize', errorGuard((req, res) => {
  req.query.scope = req.query.scope || '';
  const error = validate.validators.url(req.query.origin || '') || validate.validators.scope(req.query.scope);
  if (error) return res.status(400).send(error);
  req.query.originNoProtocol = replaceProtocol(req.query.origin);
  const scopes = req.query.scope ? util.scopes(req.query.scope) : null;
  res.render('authorize', {query: req.query, config, scopes});
}));
router.post('/authorize', new RateLimit(config.rateLimit.createUser), middleware.authorize);

router.get(['/register', '/register/:username'], middleware.checkUsername);
router.post(['/register', '/register/:username'],
      new RateLimit(config.rateLimit.createUser),
      errorGuard(async (req, res, next) => {
        const auth = req.get('authorization');
        if (!auth) {
          return res.status(400).json({message: "Invalid authorization header"});
        }
        const parts = auth.split(' ');
        if (parts[0] === 'Basic') {
          const creds = (new Buffer(parts[1], 'base64')).toString().split(':');
          if (creds.length !== 2) return res.status(400).send("Invalid authorization header");
          const email = creds[0];
          const password = creds[1];
          const code = randomstring.generate(CODE_LENGTH);
          const user = await req.systemDB.createUser(email, password, req.params.username, code);
          const link = config.host + '/users/confirm_email?code=' + code + '&email=' + email;
          await sendEmail(email, `Welcome to FreeDB! Please confirm your email address`, `
            <a href="${link}">Click here</a> to confirm your email address for FreeDB
          `)
          res.json(user.$.id);
        } else {
          res.status(400).send("Invalid authorization header");
        }
      }));

router.get('/confirm_email', async (req, res, next) => {
  if (typeof req.query.code !== 'string' || validate.validators.email(req.query.email)) {
    return res.status(400).send("Invalid email or confirmation code");
  }
  const collection = req.systemDB.db.collection('core-user_private');
  const query = {
    'data.email': req.query.email,
    'data.email_confirmation.code': req.query.code,
    'data.email_confirmation.expires': {$gt: moment().toISOString()},
  };
  const update = {$set: {'data.email_confirmation.confirmed': true, 'data.email_confirmation.code': null}};
  const updated = await collection.update(query, update);
  if (updated.result.nModified !== 1) {
    return res.status(404).send("Confirmation code is invalid or expired");
  }
  res.end("Thanks! Your email has been confirmed.");
});

router.get('/reset_password', async (req, res, next) => {
  res.render('reset_password', {code: req.query.code});
});

router.post('/start_reset_password', async (req, res, next) => {
  if (validate.validators.email(req.query.email)) {
    return res.status(400).send("Must supply an email address");
  }
  const collection = req.systemDB.db.collection('core-user_private');
  const userQuery = {'data.email': req.query.email};
  const userPrivate = await collection.findOne(userQuery);
  if (!userPrivate) return res.status(404).send("User " + req.query.email + " not found");
  const code = randomstring.generate(CODE_LENGTH);
  await collection.update(userQuery, {$set: {
    'password_reset.code': code,
    'password_reset.expires': moment().add(1, 'days').toISOString(),
  }});
  const link = config.host + '/reset_password?code=' + code;
  await sendEmail(req.query.email, "Reset your FreeDB password", `
    <a href="${link}">Click here</a> to reset your password, or paste the link below into your browser.
    <br><br>
    ${link}
  `);
  res.end("An email has been sent to your inbox.");
});

router.post('/reset_password', bodyParser.json(), async (req, res, next) => {
  if (typeof req.body.code !== 'string') return res.status(400).send("Invalid code");
  const collection = req.systemDB.db.collection('core-user_private');
  const userPrivate = await collection.findOne({
    'password_reset.code': req.body.code,
    'password_reset.expires': {$gt: moment().toISOString()},
  });
  if (!userPrivate) return res.status(404).send("Invalid code");
  await req.systemDB.setPassword(userPrivate.data.id, req.body.newPassword);
  res.send("Password successfully reset");
});
