module.exports = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {type: 'integer', minimum: 0},
    namespaces: {
      type: 'array',
      items: {type: 'string'},
    }
  }
}
