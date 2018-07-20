const expect = require('chai').expect;
const util = require('../lib/db-util');

describe('Util', () => {
  it('should encode document', () => {
    const schema = {
      foo: 'bar',
      $ref: 'abc',
      nested: {
        $ref: 'qux',
      },
      array: [{
        $ref: 'def',
      }]
    };
    const encoded = util.encodeDocument(schema);
    expect(encoded).to.deep.equal({
      foo: 'bar',
      '\uFF04ref': 'abc',
      nested: {
        '\uFF04ref': 'qux',
      },
      array: [{
        '\uFF04ref': 'def',
      }]
    });
    const decoded = util.decodeDocument(encoded);
    expect(decoded).to.deep.equal(schema);
  })
})
