module.exports = {
  type: 'object',
  additionalProperties: false,
  properties: {
    versions: {
      type: 'array',
      items: {
        type: 'object',
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
                initial_acl: {$ref: '/data/core/schema/acl'},
              }
            }
          }
        }
      }
    },
  },
  additionalProperties: false,
}

