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
      {owner: 'me', allow: {read: ['you']}},
      {owner: 'me', modify: {read: [], write: [], delete: [], append: []}},
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
      {read: 'abc'},
      {owner: 'me', read: [1]},
      {owner: 'me', foo: []},
    ];
    let errors = acls.map(validate.validators.acl);
    errors.forEach((err, idx) => {
      expect(err).to.be.a('string', JSON.stringify(acls[idx]));
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
  });

  it('should create valid ref schema', () => {
    const schema = validate.getRefSchema('foo', 'bar');
    const regex = new RegExp(schema.properties.$ref.pattern);

    expect(regex.test('/data/foo/bar/xyz')).to.equal(true);
    expect(regex.test('http://example.com/data/foo/bar/xyx')).to.equal(true);
    expect(regex.test('https://example.com/data/foo/bar/xyx')).to.equal(true);
    expect(regex.test('https://example.com:3000/data/foo/bar/xyx')).to.equal(true);
    expect(regex.test('https://example.co.uk/data/foo/bar/xyx')).to.equal(true);
    expect(regex.test('https://foo.bar.example.co.uk/data/foo/bar/xyx')).to.equal(true);
    expect(regex.test('https://localhost:3000/data/foo/bar/xyx')).to.equal(true);

    expect(regex.test('https://example.com/data/foo/nope/abc')).to.equal(false)
    expect(regex.test('https://example.com/data/nope/bar/abc')).to.equal(false)
    expect(regex.test('http://foo%bar/data/foo/bar/xyx')).to.equal(false);
    expect(regex.test('abc')).to.equal(false);
    expect(regex.test('/data/foo/bar/^%$')).to.equal(false);
    expect(regex.test('http://example.com/foo')).to.equal(false);
    expect(regex.test('abc')).to.equal(false);
  });

  it('should validate scopes', () => {
    expect(validate.validators.scope()).to.be.a('string');
    // TODO: disallow empty scope
    //expect(validate.validators.scope('')).to.be.a('string');
    expect(validate.validators.scope('foo')).to.be.a('string');
    expect(validate.validators.scope('foo:bar')).to.be.a('string');
    expect(validate.validators.scope('foo:bar:baz')).to.be.a('string');
    expect(validate.validators.scope('foo bar')).to.be.a('string');
    expect(validate.validators.scope('foo:bar baz:quux')).to.be.a('string');

    expect(validate.validators.scope('foo:read')).to.equal(undefined);
    expect(validate.validators.scope('foo:write')).to.equal(undefined);
    expect(validate.validators.scope('foo:create')).to.equal(undefined);
    expect(validate.validators.scope('foo:append')).to.equal(undefined);
    expect(validate.validators.scope('foo:modify_acl')).to.equal(undefined);
    expect(validate.validators.scope('foo:delete')).to.equal(undefined);
    expect(validate.validators.scope('foo:write foo:read')).to.equal(undefined);
    expect(validate.validators.scope('foo:write bar:delete')).to.equal(undefined);
    expect(validate.validators.scope('foo:write bar:write baz:write')).to.equal(undefined);
  })
})
