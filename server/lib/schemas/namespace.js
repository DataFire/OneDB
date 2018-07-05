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
          types: {
            type: 'object',
            additionalProperties: {$ref: '#/core/type/type'}
          }
        }
      }
    },
  },
  additionalProperties: false,
}

