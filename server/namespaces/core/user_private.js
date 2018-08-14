module.exports = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: {type: 'string'},
    email: {type: 'string'},
    hash: {type: 'string'},
    salt: {type: 'string'},
    email_confirmation: {
      type: 'object',
      additionalProperties: false,
      properties: {
        confirmed: {type: 'boolean'},
        code: {type: 'string'},
        expires: {type: 'string', format: 'date-time'},
      }
    },
    password_reset: {
      type: 'object',
      additionalProperties: false,
      properties: {
        code: {type: 'string'},
        expires: {type: 'string', format: 'date-time'},
      }
    },
  }
}
