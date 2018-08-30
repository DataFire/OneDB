module.exports = {
  type: 'object',
  additionalProperties: false,
  properties: {
    versions: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          version: {type: 'string'},
          types: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              required: ['schema'],
              additionalProperties: false,
              properties: {
                schema: {$ref: '#/definitions/schema'},
                initial_acl: require('./acl'),
              }
            }
          }
        }
      }
    },
  },
}

