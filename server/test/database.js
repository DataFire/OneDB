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

  it('should have core types', async () => {
    let user = await systemDB.get('core', 'type', 'core/type');
    expect(user.acl).to.deep.equal({owner: '_system', read: ['_all']});
    expect(user.data.versions[0].schema.type).to.equal('object');

    let type = await systemDB.get('core', 'type', 'core/user');
    expect(type.acl).to.deep.equal({owner: '_system', read: ['_all']});
    expect(type.data.versions[0].schema.type).to.equal('object');
  });

  it('should not create item for missing namespace', () => {
    return expectError(systemDB.create('foo', 'user', {str: 'baz'}), /Type foo\/user not found/);
  });

  it('should not create item for missing type', () => {
    return expectError(systemDB.create('core', 'foo', {name: 'alice'}), /Type core\/foo not found/);
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

  it('should not allow creating new core type', async () => {
    const userDB = await database.user(USERS[0].id);
    const type = {schema: {type: 'string'}, type: 'foo', namespace: 'core'};
    return expectError(userDB.create('core', 'type', type), /User .* does not own namespace core/);
  });

  it('should not allow creating type for missing namespace', async () => {
    const userDB = await database.user(USERS[0].id);
    const type = {schema: {type: 'string'}, type: 'bar', namespace: 'foo'};
    return expectError(userDB.create('core', 'type', type), /Namespace foo not found/);
  });

  it('should allow creating new namespace', async () => {
    const userDB = await database.user(USERS[0].id);
    const ns = await userDB.create('core', 'namespace', {id: 'foo'});
    expect(ns.data.id).to.equal('foo');
  });

  it('should allow adding type to namespace', async () => {
    const userDB = await database.user(USERS[0].id);
    const type = {schema: {type: 'string'}, type: 'bar', namespace: 'foo'};
    const created = await userDB.create('core', 'type', type);
    expect(created.data.type).to.equal(type.type);
    expect(created.data.namespace).to.equal(type.namespace);
    expect(created.data.versions[0].schema).to.deep.equal(type.schema);
  });

  it('should not allow other user to add type to namespace', async () => {
    const userDB = await database.user(USERS[1].id);
    const type = {schema: {type: 'string'}, type: 'baz', namespace: 'foo'};
    return expectError(userDB.create('core', 'type', type), /User .* does not own namespace foo/);
  });

  it('should not allow other user to add duplicate namespace', async () => {
    const userDB = await database.user(USERS[1].id);
    return expectError(userDB.create('core', 'namespace', {id: 'foo'}), /Item core\/namespace\/foo already exists/);
  });

  it('should not allow other user to publish namespace', async () => {
    const userDB = await database.user(USERS[1].id);
    return expectError(userDB.publishNamespace('foo'), /User .* does not own namespace foo/);
  });

  it('should allow user to publish namespace', async () => {
    const userDB = await database.user(USERS[0].id);
    await userDB.publishNamespace('foo');
  })
});

