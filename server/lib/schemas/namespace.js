module.exports = {
  type: 'object',
  additionalProperties: false,
  properties: {
    versions: {
      type: 'array',
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
                schema: {$ref: '/data/core/schema/schema'},
                initial_acl: require('./acl'),
              }
            }
          }
        }
      }
    },
  },
  additionalProperties: false,
}

