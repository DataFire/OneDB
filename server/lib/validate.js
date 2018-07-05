const Ajv = require('ajv');
const WORDY_REGEX = /^[a-zA-Z0-9]\w{1,29}$/; // starts with a letter, 2-30 characters

const REGEX = {
  typeID: WORDY_REGEX,
  itemID: WORDY_REGEX,
  namespace: WORDY_REGEX,
}

const IDENTITY_SCHEMA = {
  type: 'string',
  minLength: 2,
  maxLength: 100,
}

const ACL_LIST_SCHEMA = {
  type: 'array',
  items: IDENTITY_SCHEMA,
}

const ACL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['owner'],
  properties: {
    owner: IDENTITY_SCHEMA,
    read:  ACL_LIST_SCHEMA,
    write: ACL_LIST_SCHEMA,
    append: ACL_LIST_SCHEMA,
    destroy: ACL_LIST_SCHEMA,
    acl: ACL_LIST_SCHEMA,
  },
}

let ajvForACL = new Ajv();
let validateACL = ajvForACL.compile(ACL_SCHEMA);

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
    let ajv = new Ajv() // TODO: a single ajv instance will cache schemas, but the cache could grow unbounded...
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
    if (!isValid) return "ACL is invalid. " + ajvForACL.errorsText(validateACL.errors);
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

module.exports.type = (req, res, next) => {
  if (!req.body) return sendError(res, "You must include a body in your request");
  let message = validators.data(req.body.data, req.type.schema) || validators.acl(req.body.acl);
  if (message) return sendError(res, message);
  next();
};
