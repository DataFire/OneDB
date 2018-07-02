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
    if (schema.$ref === '#') schema.$ref = '/core/type/' + rootID;
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
