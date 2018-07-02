const expect = require('chai').expect;
const validate = require('../lib/validate');

describe('Validation', () => {
  it('should allow valid namespaces', () => {
    let namespaces = ['abc', 'ABC', 'a12', 'a_b_c', 'a2b3', '123', 'abcdefghijklmnopqrstuvwxyz'];
    let errors = namespaces.map(validate.validators.namespace);
    errors.forEach((err, idx) => {
      expect(err).to.equal(undefined, namespaces[idx]);
    })
  });

  it('should not allow invalid namespaces', () => {
    let namespaces = [undefined, null, '', 'a', '_ab', 'ab&', 'abΩ', 'aaaaabbbbbcccccdddddeeeeefffffg', {}, [], 123];
    let errors = namespaces.map(validate.validators.namespace);
    errors.forEach((err, idx) => {
      expect(err).to.be.a('string');
      expect(err.length).to.not.equal(0);
    })
  });

  it('should allow valid type IDs', () => {
    let types = ['abc', 'ABC', 'a12', 'a_b_c', 'a2b3', '123', 'abcdefghijklmnopqrstuvwxyz'];
    let errors = types.map(validate.validators.typeID);
    errors.forEach((err, idx) => {
      expect(err).to.equal(undefined, types[idx]);
    })
  });

  it('should not allow invalid type IDs', () => {
    let types = [undefined, null, '', 'a', '_ab', 'ab&', 'abΩ', 'aaaaabbbbbcccccdddddeeeeefffffg', {}, [], 123];
    let errors = types.map(validate.validators.typeID);
    errors.forEach((err, idx) => {
      expect(err).to.be.a('string');
      expect(err.length).to.not.equal(0);
    })
  });

  it('should allow valid ACL', () => {
    let acls = [
      {owner: 'me'},
      {owner: 'me', read: ['you']},
      {owner: 'me', read: [], write: [], destroy: [], append: []},
    ];
    let errors = acls.map(validate.validators.acl);
    errors.forEach((err, idx) => {
      expect(err).to.equal(undefined, JSON.stringify(acls[idx]));
    })
  });

  it('should not allow invalid ACL', () => {
    let acls = [
      null,
      undefined,
      'foo',
      123,
      [],
      {},
      {read: []},
      {owner: 'me', read: [1]},
      {owner: 'me', foo: []},
    ];
    let errors = acls.map(validate.validators.acl);
    errors.forEach((err, idx) => {
      expect(err).to.be.a('string');
      expect(err.length).to.not.equal(0);
    })
  });

  it('should allow valid data for schemas', () => {
    let tests = [
      {data: 'foo', schema: {type: 'string'}},
      {data: 'foo', schema: {}},
      {data: ['a'], schema: {type: 'array'}},
      {data: {foo: 'bar'}, schema: {type: 'object', properties: {foo: {type: 'string'}}}},
    ];
    let errors = tests.map(test => validate.validators.data(test.data, test.schema));
    errors.forEach((err, idx) => {
      expect(err).to.equal(undefined, JSON.stringify(tests[idx]));
    })
  });

  it('should not allow invalid data for schemas', () => {
    let tests = [
      {data: 'foo', schema: {type: 'number'}},
      {data: 'foo', schema: {type: 'string', maxLength: 2}},
      {data: ['a'], schema: {type: 'object'}},
      {data: {foo: 'bar'}, schema: {type: 'object', properties: {foo: {type: 'number'}}}},
    ];
    let errors = tests.map(test => validate.validators.data(test.data, test.schema));
    errors.forEach((err, idx) => {
      expect(err).to.be.a('string');
      expect(err.length).to.not.equal(0);
    })
  });

  it('should not allow invalid schemas', () => {
    let schemas = [
      {type: 'foo'},
      {type: 'string', foo: 'bar'},
    ];
    let errors = schemas.map(schema => validate.validators.data({}, schema));
    errors.forEach((err, idx) => {
      expect(err).to.be.a('string');
      expect(err.length).to.not.equal(0);
    })
  })
})
