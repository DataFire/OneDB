export const util:any = {};

util.underscoreName = (str, allowCaps=false) => {
  if (!str) return str;
  str = str.replace(/\W+/g, '_')
  if (!allowCaps) str = str.toLowerCase();
  return str;
}

util.isObject = (obj) => {
  return typeof obj === 'object' && !Array.isArray(obj);
}

util.removeUndefined = obj => {
  if (typeof obj !== 'object') return obj;
  for (let key in obj) {
    if (typeof obj[key] === 'undefined') {
      delete obj[key];
    } else {
      obj[key] = util.removeUndefined(obj[key]);
    }
  }
  return obj;
}

util.copyObject = (from, to) => {
  if (!util.isObject(from)) {
    console.log('from:', from);
    throw new Error("from is not an object, but a " + typeof from);
  }
  if (!util.isObject(to)) {
    console.log('to:', to);
    throw new Error("to is not an object, but a " + typeof to);
  }
  let keys = Object.keys(from).concat(Object.keys(to));
  keys.forEach(key => {
    if (from[key] === undefined) {
      delete to[key];
    } else if (Array.isArray(from[key])) {
      to[key] = to[key] || [];
      if (!from[key].length || from[key].length !== to[key].length || typeof from[key][0] !== 'object') {
        to[key] = from[key];
      } else {
        to[key].forEach((obj, idx) => {
          try {
            util.copyObject(from[key][idx], to[key][idx]);
          } catch (e) {
            e.message = idx + ':' + e.message;
            throw e;
          }
        })
      }
    } else if (util.isObject(from[key])) {
      to[key] = to[key] || {};
      if (!util.isObject(to[key])) {
        to[key] = from[key];
      } else {
        try {
          util.copyObject(from[key], to[key]);
        } catch (e) {
          e.message = key + ':' + e.message;
          throw e;
        }
      }
    } else {
      to[key] = from[key]
    }
  })
}

util.getPathID = function(method, path) {
  return method.toUpperCase() + path.replace(/\W+/g, '_');
}

util.resolveReference = function(ref, base) {
  var keys = ref.split('/');
  keys.shift();
  var cur = base;
  keys.forEach(k => cur = cur[k]);
  return cur;
}

util.maybeResolveRef = function(schema, base) {
  if (!schema || !schema.$ref) return schema;
  return util.resolveReference(schema.$ref, base);
}

util.decodeFilename = function(str) {
  return str.replace(/%2E/g, '.');
}

util.encodeFilename = function(str) {
  return str.replace(/\./g, '%2E');
}

util.range = function(num) {
  return new Array(num);
}

util.getRelativeFilename = function(filename, relativeTo) {
  let fParts = filename.split('/');
  let rParts = relativeTo.split('/');
  let firstDifferentIdx = -1;
  fParts = fParts.filter((part, idx) => {
    if (firstDifferentIdx > -1) return true;
    if (part === rParts[idx]) return false;
    firstDifferentIdx = idx;
    return true;
  })
  fParts.unshift('.');
  return fParts.join('/');
}

util.getSchemaProperties = function(schema, refBase, value={}) {
  if (schema.$ref) schema = util.resolveReference(schema.$ref, refBase);
  let props = Object.keys(schema.properties || {});
  (schema.allOf || []).forEach(subschema => {
    let subprops = util.getSchemaProperties(subschema, refBase);
    props = props.concat(subprops);
  });
  if (util.isObject(value)) {
    let valueProperties = Object.keys(value).filter(k => props.indexOf(k) === -1);
    props = props.concat(valueProperties);
  }
  props = props.filter(p => p !== '$');
  let req = schema.required || [];
  return props.sort((p1, p2) => {
    let i1 = (req.indexOf(p1) + 1) || req.length + 1;
    let i2 = (req.indexOf(p2) + 1) || req.length + 1;
    if (i1 === i2) return 0;
    return i1 < i2 ? -1 : 1;
  });
}

util.getDefaultValueForType = function(type:string) {
  if (type === 'object') return {};
  else if (type === 'array') return [];
  else if (type === 'string') return '';
  else if (type === 'boolean') return false;
  else if (type === 'number' || type === 'integer') return 0;
}

util.getSchemaFromValue = function(val) {
  if (typeof val === undefined) return {};
  let type = Array.isArray(val) ? 'array' : typeof val;
  return {type};
}

util.getTypeForSchema = function(schema, refBase) {
  if (schema.$ref) schema = util.resolveReference(schema.$ref, refBase);
  if (schema.type) return schema.type;
  if (schema.properties) return 'object';
  if (schema.items) return 'array';
  if (!schema.allOf) return null;
  for (let i = 0; i < schema.allOf.length; ++i) {
    let subtype = util.getTypeForSchema(schema.allOf[i], refBase);
    if (subtype) return subtype;
  }
}

util.getPropertySchema = function(prop, schema, refBase) {
  if (schema.$ref) schema = util.resolveReference(schema.$ref, refBase);
  if (schema.properties && schema.properties[prop]) {
    return schema.properties[prop];
  }
  if (schema.allOf) {
    for (let i = 0; i < schema.allOf.length; ++i) {
      let sub = util.getPropertySchema(prop, schema.allOf[i], refBase);
      if (sub) return sub;
    }
  }
}

util.findType = function(schema, type, baseSchema=null, key='') {
  if (!schema) return;
  if (key) key += '.';
  baseSchema = baseSchema || schema;
  schema = util.maybeResolveRef(schema, baseSchema);
  if (schema.type === type) return {schema, key};
  for (let subkey in schema.properties || {}) {
    let subschema = util.maybeResolveRef(schema.properties[subkey], baseSchema);
    if (subschema.type === type) {
      return {schema: subschema, path: key + subkey};
    }
  }
  for (let subkey in schema.properties || {}) {
    let subschema = util.maybeResolveRef(schema.properties[subkey], baseSchema);
    let ret = util.findType(subschema, type, baseSchema, key + subkey);
    if (ret) return ret;
  }
}

util.SCHEMA_TYPES = ['string', 'number', 'boolean', 'array', 'object'];

