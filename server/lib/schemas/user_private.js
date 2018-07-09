module.exports = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: {type: 'string'},
    email: {type: 'string'},
    hash: {type: 'string'},
    salt: {type: 'string'},
    verificationID: {type: 'string'},
  }
}
