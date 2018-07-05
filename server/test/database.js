const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const expect = chai.expect;
const Database = require('../lib/database');

const mongod = new MongoMemoryServer();
let database = null;
let systemDB = null;
const USERS = [];

const expectError = function(prom, regex) {
  return prom.then(() => {
    return Promise.reject(new Error("Expected an error"));
  }, err => {
    expect(err instanceof Error).to.equal(true);
    if (regex) {
      expect(regex.test(err.message)).to.equal(true, err.message);
    }
  })
}

describe('Database', () => {
  before(async function() {
    this.timeout(60000)
    const uri = await mongod.getConnectionString();
    database = new Database(uri);
    await database.initialize();
    console.log('initialized');
    systemDB = await database.user('_system');
  });

  it('should have core schemas', async () => {
    let user = await systemDB.get('core', 'schema', 'schema');
    expect(user.acl).to.deep.equal({owner: '_system', read: ['_all']});
    expect(user.data.type).to.deep.equal(['object', 'boolean']);

    let schema = await systemDB.get('core', 'schema', 'user');
    expect(schema.acl).to.deep.equal({owner: '_system', read: ['_all']});
    expect(schema.data.type).to.equal('object');
  });

  it('should not create item for missing namespace', () => {
    return expectError(systemDB.create('foo', 'user', {str: 'baz'}), /Namespace foo not found/);
  });

  it('should not create item for missing schema', () => {
    return expectError(systemDB.create('core', 'foo', {name: 'alice'}), /Schema core\/foo not found/);
  });

  it('should not allow initalizing for missing user', () => {
    return expectError(database.user('foo'), /User foo not found/);
  });

  it('should allow creating users', async () => {
    let user = await database.createUser('pkey1');
    expect(user.data).to.deep.equal({publicKey: 'pkey1'});
    USERS.push(user);
    USERS.push(await database.createUser('pkey2'));
    USERS.push(await database.createUser('pkey3'));
  });

  it('should not allow duplicate public key', () => {
    return expectError(database.createUser('pkey1'), /Public key already exists/)
  });

  it('should allow creating new namespace', async () => {
    const userDB = await database.user(USERS[0].id);
    const ns = await userDB.create('core', 'namespace', {}, {}, 'foo');
    expect(ns.data).to.deep.equal({});
  });

  it('should allow creating schema', async () => {
    const userDB = await database.user(USERS[0].id);
    const schema = {type: 'string'};
    const created = await userDB.create('core', 'schema', schema);
    expect(created.data.id).to.equal(schema.id);
    expect(created.data.schema).to.deep.equal(schema.schema);
  });

  it('should not allow other user to add duplicate namespace', async () => {
    const userDB = await database.user(USERS[1].id);
    return expectError(userDB.create('core', 'namespace', {}, {}, 'foo'), /Item core\/namespace\/foo already exists/);
  });

  it('should not allow other user to publish namespace', async () => {
    const userDB = await database.user(USERS[1].id);
    const ns = {
      id: 'foo',
      versions: [{
        version: '0',
        schemas: {
          'thing': {$ref: '/core/schema/thing'},
        }
      }]
    }
    return expectError(userDB.update('core', 'namespace', 'foo', ns), /User .* cannot update core\/namespace\/foo/)
  });

  it('should allow user to publish namespace', async () => {
    const userDB = await database.user(USERS[0].id);
    const ns = {
      id: 'foo',
      versions: [{
        version: '0',
        schemas: {
          'thing': {$ref: '/core/schema/thing'},
        }
      }]
    }
  });

  /** TODO:
   *  Should not allow removing version from namespace
   *  Should not allow changing schema/namespace ID
   *  Should validate against different versions
   */
});

