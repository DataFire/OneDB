const crypto = require('crypto');

const DOLLAR = "\uFF04";
const DOT = "\uFF0E";
const KEY_REPLACEMENTS = {
  dollar: {
    encode: /\$/g,
    decode: new RegExp(DOLLAR, 'g'),
    encoded: DOLLAR,
    decoded: '$',
  },
  dot: {
    encode: /\./g,
    decode: new RegExp(DOT, 'g'),
    encoded: DOT,
    decoded: '.',
  }
}

module.exports.encodeDocument = function(schema) {
  if (typeof schema !== 'object' || schema === null) return schema;
  if (Array.isArray(schema)) return schema.map(module.exports.encodeDocument);
  let obj = {};
  for (let key in schema) {
    let newKey = key;
    for (let replaceKey in KEY_REPLACEMENTS) {
      let replacement = KEY_REPLACEMENTS[replaceKey];
      newKey = newKey.replace(replacement.encode, replacement.encoded);
    }
    obj[newKey] = module.exports.encodeDocument(schema[key]);
  }
  return obj;
}

module.exports.decodeDocument = function(schema) {
  if (typeof schema !== 'object' || schema === null) return schema;
  if (Array.isArray(schema)) return schema.map(module.exports.decodeDocument);
  let obj = {};
  for (let key in schema) {
    let newKey = key;
    for (let replaceKey in KEY_REPLACEMENTS) {
      let replacement = KEY_REPLACEMENTS[replaceKey];
      newKey = newKey.replace(replacement.decode, replacement.decoded);
    }
    obj[newKey] = module.exports.decodeDocument(schema[key]);
  }
  return obj;
}

module.exports.fixSchemaRefs = function(schema, rootID) {
  if (typeof schema !== 'object' || schema === null) return;
  if (Array.isArray(schema)) schema.forEach(sub => module.exports.fixSchemaRefs(sub, rootID));
  if (schema.$ref) {
    if (schema.$ref === '#') schema.$ref = '/data/core/schema/' + rootID;
    let [dummy, namespace, type] = schema.$ref.split('/');
    let newSchema = {
      type: 'object',
      properties: {
        $ref: {
          type: 'string',
          pattern: `.*/${namespace}/${type}/\\w+`,
        },
      },
    }
    for (let key in schema) delete schema[key];
    Object.assign(schema, newSchema);
  } else {
    for (let key in schema) module.exports.fixSchemaRefs(schema[key], rootID);
  }
}

const SALT_LENGTH = 32;
const VERIFICATION_ID_LENGTH = 16;
const ITERATIONS = 25000;
const KEY_LENGTH = 512;
const DIGEST_ALGO = 'sha256'

module.exports.computeCredentials = (password) => {
  return new Promise((resolve, reject) => {
    let result = {};
    crypto.randomBytes(SALT_LENGTH, (err, buf) => {
      if (err) return reject(err);
      result.salt = buf.toString('hex');
      crypto.randomBytes(VERIFICATION_ID_LENGTH, (err, buf) => {
        if (err) return reject(err);
        result.verificationID = buf.toString('hex');
        crypto.pbkdf2(password, result.salt, ITERATIONS, KEY_LENGTH, DIGEST_ALGO, (err, hashRaw) => {
          if (err) return reject(err);
          result.hash = new Buffer(hashRaw, 'binary').toString('hex');
          resolve(result);
        });
      });
    });
  });
}

module.exports.checkPassword = (password, hash, salt) => {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST_ALGO, (err, hashRaw) => {
      if (err) return reject(err);
      let compHash = new Buffer(hashRaw, 'binary').toString('hex');
      resolve(compHash === hash);
    })
  });
}
