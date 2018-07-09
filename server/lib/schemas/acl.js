const IDENTITY_SCHEMA = {
  type: 'string',
  minLength: 2,
  maxLength: 100,
}

const ACL_LIST_SCHEMA = {
  type: 'array',
  items: IDENTITY_SCHEMA,
}

const ACL_SCHEMA = module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['owner'],
  properties: {
    owner: IDENTITY_SCHEMA,
    read:  ACL_LIST_SCHEMA,
    write: ACL_LIST_SCHEMA,
    append: ACL_LIST_SCHEMA,
    destroy: ACL_LIST_SCHEMA,
    modify_read: ACL_LIST_SCHEMA,
    modify_write: ACL_LIST_SCHEMA,
    modify_append: ACL_LIST_SCHEMA,
    modify_destroy: ACL_LIST_SCHEMA,
  },
}


