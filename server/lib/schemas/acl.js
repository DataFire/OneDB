const IDENTITY_SCHEMA = {
  type: 'string',
  minLength: 2,
  maxLength: 100,
}

const ACL_LIST_SCHEMA = {
  type: 'array',
  items: IDENTITY_SCHEMA,
}

const ACL_LIST_WITH_DEFAULT_SCHEMA = Object.assign({default: ['_owner']}, ACL_LIST_SCHEMA);

const ACL_SET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    owner: IDENTITY_SCHEMA,
    read:  ACL_LIST_SCHEMA,
    write: ACL_LIST_SCHEMA,
    append: ACL_LIST_SCHEMA,
    destroy: ACL_LIST_SCHEMA,
  }
}
const ACL_SET_WITH_DEFAULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    owner: IDENTITY_SCHEMA,
    read:  ACL_LIST_WITH_DEFAULT_SCHEMA,
    write: ACL_LIST_WITH_DEFAULT_SCHEMA,
    append: ACL_LIST_WITH_DEFAULT_SCHEMA,
    destroy: ACL_LIST_WITH_DEFAULT_SCHEMA,
  }
}

const ACL_SCHEMA = module.exports = {
  type: 'object',
  additionalProperties: false,
  required: ['owner'],
  properties: {
    owner: IDENTITY_SCHEMA,
    allow: ACL_SET_WITH_DEFAULT_SCHEMA,
    disallow: ACL_SET_SCHEMA,
    modify: ACL_SET_WITH_DEFAULT_SCHEMA,
  },
}


