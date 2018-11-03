const Ajv = require('ajv');
const validator = require('validator');
const redos = require('redos');
const util = require('./util');

const MIN_PASSWORD_LENGTH = 8;
const WORDY_REGEX = /^[a-zA-Z0-9]\w{1,29}$/; // starts with a letter, 2-30 characters
const AJV_OPTIONS = {useDefaults: true, allErrors: true, jsonPointers: true};

const REGEX = {
  typeID: WORDY_REGEX,
  itemID: WORDY_REGEX,
  namespace: WORDY_REGEX,
  scope: /^(\w+:(read|write|append|delete|create|modify_acl))( \w+:(read|write|append|delete|create|modify_acl))*$/,
}

const LIST_QUERY_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    pageSize: {type: 'integer', minimum: 1, maximum: 100, default: 20},
    skip: {type: 'integer', minimum: 0, default: 0},
    sort: {type: 'string', pattern: "[\\w\\.]+(:(ascending|descending))"}
  }
}

let ajvCore = new Ajv(AJV_OPTIONS);
let validateACL = ajvCore.compile(require('../namespaces/core/acl'));
let validateInfo = ajvCore.compile(require('../namespaces/core/info'));
let validateListQuery = ajvCore.compile(LIST_QUERY_SCHEMA);

let sendError = module.exports.sendError = (res, message="Unknown error", details=undefined, statusCode=400) => {
  res.status(statusCode).json({error: message, details});
}

let errorsText = function(ajvErrors) {
  let messages = [];
  for (let err of ajvErrors) {
    if (err.schemaPath.startsWith('#/anyOf/1')) continue;
    if (err.keyword === 'anyOf') continue;
    let message = '';
    if (err.dataPath) {
      message = err.dataPath.replace(/^\//, '').replace(/\//g, '.') + ' ';
    }
    if (err.keyword === 'additionalProperties') {
      message += 'should not have extra property ' + err.params.additionalProperty;
    } else {
      message += err.message;
    }
    messages.push(message);
  }
  return messages.join('; ');
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
    let ajv = new Ajv(AJV_OPTIONS);
    let validate = null;
    try {
      validate = ajv.compile(schema);
    } catch (e) {
      return "Error compiling JSON schema: " + e.message;
    }
    let isValid = validate(data);
    if (!isValid) return "Data does not match schema. " + errorsText(validate.errors);
  },
  acl: acl => {
    let isValid = validateACL(acl);
    if (!isValid) return "ACL is invalid. " + errorsText(validateACL.errors);
  },
  info: info => {
    let isValid = validateInfo(info);
    if (!isValid) return "Info is invalid. " + errorsText(validateInfo.errors);
  },
  url: url => {
    if (url.startsWith('file:')) return;
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
  },
  schema: (schema, isNested=false) => {
    if (!isNested) {
      if (!schema || schema.type !== 'object') return "Top-level schema must have type 'object'";
      if (schema.additionalProperties)         return "Top-level schema must not allow additionalProperties";
      schema.additionalProperties = false;
    }
    let err = null;
    util.iterateSchema(schema, subschema => {
      if (err) return;
      if (subschema.pattern) {
        let rx = new RegExp(subschema.pattern);
        let results = redos(rx.toString()).results();
        let badResult = results.filter(r => !r.safe).pop();
        if (badResult) err = "Pattern " + subschema.pattern + " is not allowed";
      }
    });
    return err;
  },
  listQuery: query => {
    if (query.pageSize !== undefined) query.pageSize = +query.pageSize;
    if (query.skip !== undefined) query.skip = +query.skip;
    let isValid = validateListQuery(query);
    if (!isValid) return errorsText(validateListQuery.errors);
  },
  scope: scope => {
    if (typeof scope !== 'string') return "Scope not specified"
    if (scope === '') return; // TODO: disallow empty scope
    if (!REGEX.scope.test(scope)) return "Requested scope is invalid"
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
        pattern: `^(https?:\\/\\/([\\w-]\+\\.)*[\\w-]+(:\\d+)?)?/data/${namespace}/${type}/\\w+$`,
      },
    },
  }
}
