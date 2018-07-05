const jsonSchemaSchema = JSON.parse(JSON.stringify(require('ajv/lib/refs/json-schema-draft-07.json')));
function fixCoreSchema(schema) {
  if (typeof schema !== 'object') return;
  if (Array.isArray(schema)) return schema.forEach(fixCoreSchema);
  if (schema.$ref === '#') schema.$ref = '#/definitions/jsonSchema';
  for (let key in schema) fixCoreSchema(schema[key]);
}
fixCoreSchema(jsonSchemaSchema);
const jsonSchemaDefinitions = JSON.parse(JSON.stringify(jsonSchemaSchema.definitions));
jsonSchemaDefinitions.jsonSchema = jsonSchemaSchema;
delete jsonSchemaSchema.$id;
delete jsonSchemaSchema.definitions;

module.exports = {
  type: 'object',
  definitions: jsonSchemaDefinitions,
  properties: {
    id: {type: 'string'},
    idField: {type: 'string', default: 'id'},
    schema: jsonSchemaSchema,
  },
  additionalProperties: false,
};

