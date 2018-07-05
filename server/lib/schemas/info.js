const INFO_SCHEMA = module.exports = {
  type: 'object',
  required: ['created', 'updated', 'created_by'],
  additionalProperties: false,
  properties: {
    created: {type: 'string'},
    updated: {type: 'string'},
    created_by: {type: 'string'},
  },
}

