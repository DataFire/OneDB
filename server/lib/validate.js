const Ajv = require('ajv');
const validator = require('validator');

const MIN_PASSWORD_LENGTH = 8;
const WORDY_REGEX = /^[a-zA-Z0-9]\w{1,29}$/; // starts with a letter, 2-30 characters

const REGEX = {
  typeID: WORDY_REGEX,
  itemID: WORDY_REGEX,
  namespace: WORDY_REGEX,
}

let ajvCore = new Ajv({useDefaults: true});
let validateACL = ajvCore.compile(require('../namespaces/core/acl'));
let validateInfo = ajvCore.compile(require('../namespaces/core/info'));

let sendError = module.exports.sendError = (res, message="Unknown error", details=undefined, statusCode=400) => {
  res.status(statusCode).json({error: message, details});
}

let validators = module.exports.validators = {
  namespace: namespace => {
    if (typeof namespace !== 'string')     return "You must specify a namespace";
    if (!REGEX.namespace.test(namespace))  return "Invalid namespace: " + namespace;
  },
  typeID: type => {
    if (typeof type !== 'string')  return "You must specify a type ID";
    if (!REGEX.typeID.test(type))  return "Invalid type ID: " + type;
  },
  itemID: id => {
    if (typeof id !== 'string') return "No ID specified";
    if (!REGEX.itemID.test(id)) return "Invalid ID: " + id;
  },
  data: (data, schema) => {
    if (data === undefined)        return "No data specified";
    if (!schema)                   return "No JSON schema specified";
    let ajv = new Ajv({useDefaults: true}) // TODO: a single ajv instance will cache schemas, but the cache could grow unbounded...
    let validate = null;
    try {
      validate = ajv.compile(schema);
    } catch (e) {
      return "Error compiling JSON schema: " + e.message;
    }
    let isValid = validate(data);
    if (!isValid) return "Data does not match schema. " + ajv.errorsText(validate.errors);
  },
  acl: acl => {
    let isValid = validateACL(acl);
    if (!isValid) return "ACL is invalid. " + ajvCore.errorsText(validateACL.errors);
  },
  info: info => {
    let isValid = validateInfo(info);
    if (!isValid) return "Info is invalid. " + ajvCore.errorsText(validateInfo.errors);
  },
  url: url => {
    const opts = {require_protocol: true, protocols: ['http', 'https']};
    if (!validator.isURL(url, opts)) {
      return `${url} is not a valid URL`;
    }
  },
  email: email => {
    if (!validator.isEmail(email)) {
      return `${email} is not a valid email address`;
    }
  },
  password: password => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
  }
}

let middleware = module.exports.middleware = (loc, name) => {
  return (req, res, next) => {
    let message = validators[name](req[loc][name]);
    if (message) {
     return sendError(res, message);
    } else {
      next();
    }
  }
}

module.exports.namespace = middleware('params', 'namespace');
module.exports.typeID = middleware('params', 'typeID');
module.exports.itemID = middleware('params', 'itemID');

module.exports.type = (req, res, next) => {
  if (!req.body) return sendError(res, "You must include a body in your request");
  let message = validators.data(req.body.data, req.type.schema) || validators.acl(req.body.acl);
  if (message) return sendError(res, message);
  next();
}

module.exports.getRefSchema = (namespace, type) => {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['$ref'],
    properties: {
      $ref: {
        type: 'string',
        pattern: `^(https?:\\/\\/(\\w+\\.)*\\w+(:\\d+)?)?/data/${namespace}/${type}/\\w+$`,
      },
    },
  }
}
