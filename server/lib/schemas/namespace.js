module.exports = {
  type: 'object',
  properties: {
    id: {type: 'string'},
    versions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          version: {type: 'string'},
          schemas: {
            type: 'object',
            additionalProperties: {$ref: '#/core/schema/schema'}
          }
        }
      }
    },
  },
  additionalProperties: false,
}

