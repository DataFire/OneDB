module.exports = {
  type: 'object',
  additionalProperties: false,
  properties: {
    username: {type: 'string'},
    token: {type: 'string'},
    expires: {type: 'string', format: 'date-time'},
    permissions: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['read', 'write', 'append', 'destroy', 'modify_acl', 'create'],
        }
      }
    }
  }
}
