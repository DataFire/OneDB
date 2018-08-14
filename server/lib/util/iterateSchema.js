const iterateSchema = module.exports = function(schema, fn) {
  fn(schema);
  if (schema.items) iterateSchema(schema.items, fn);
  for (let key in schema.properties) {
    iterateSchema(schema.properties[key], fn);
  }
  if (typeof schema.additionalProperties === 'object') {
    iterateSchema(schema.additionalProperties, fn);
  }
  if (schema.not) iterateSchema(schema.not, fn);
  for (let sub of schema.oneOf || []) {
    iterateSchema(sub, fn);
  }
  for (let sub of schema.anyOf || []) {
    iterateSchema(sub, fn);
  }
  for (let sub of schema.allOf || []) {
    iterateSchema(sub, fn);
  }
  for (let key in schema.definitions || {}) {
    iterateSchema(schema.definitions[key], fn);
  }
}
