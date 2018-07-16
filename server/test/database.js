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
    return Promise.reject(new Error("Expected an error: " + regex));
  }, err => {
    expect(err instanceof Error).to.equal(true);
    if (regex) {
      expect(regex.test(err.message)).to.equal(true, "Expected " + regex + ", got " + err.message);
    }
  })
}

describe('Database', () => {
  before(async function() {
    this.timeout(60000)
    const uri = await mongod.getConnectionString();
    database = new Database(uri);
    await database.initialize();
    systemDB = await database.user('_system');
  });

  it('should have core schemas', async () => {
    let user = await systemDB.get('core', 'schema', 'schema');
    expect(user.acl.owner).to.equal('_system');
    expect(user.acl.read).to.deep.equal(['_all']);
    expect(user.data.type).to.deep.equal(['object', 'boolean']);

    let schema = await systemDB.get('core', 'schema', 'user');
    expect(schema.acl).to.deep.equal({
      owner: '_system',
      read: ['_all'],
      write: [],
      append: [],
      destroy: [],
      modify_read: [],
      modify_write: [],
      modify_append: [],
      modify_destroy: [],
    });
    expect(schema.acl.read).to.deep.equal(['_all']);
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
    let user = await database.createUser('user1', 'pkey1');
    expect(user.data).to.deep.equal({publicKey: ''});
    USERS.push(user);
    USERS.push(await database.createUser('user2', 'pkey2'));
    USERS.push(await database.createUser('user3', 'pkey3'));
  });

  it('should not allow duplicate email', async () => {
    await expectError(database.createUser('user1', 'pkey4'), /A user with that email address already exists/)
  });

  it('should not allow updating or destroying core type', async () => {
    const userDB = await database.user(USERS[0].id);
    await expectError(userDB.destroy('core', 'schema', 'namespace'), /User .* cannot destroy core\/schema\/namespace/);
    await expectError(userDB.destroy('core', 'namespace', 'core'), /User .* cannot destroy core\/namespace\/core/);
    await expectError(userDB.update('core', 'namespace', 'core', {versions: []}), /User .* cannot update core\/namespace\/core/);
    await expectError(userDB.update('core', 'schema', 'namespace', {type: 'string'}), /User .* cannot update core\/schema\/namespace/);
  });

  it('should allow creating new namespace', async () => {
    const userDB = await database.user(USERS[0].id);
    const ns = {
      versions: [{
        version: '0',
        types: {
          'thing': {schema: {$ref: '/data/core/schema/thing'}},
        }
      }]
    }
    await userDB.create('core', 'namespace', ns, 'foo');
  });

  it('should allow creating schema', async () => {
    const userDB = await database.user(USERS[0].id);
    const schema = {type: 'string'};
    const created = await userDB.create('core', 'schema', schema, 'thing');
    expect(created.data.id).to.equal(schema.id);
    expect(created.data.schema).to.deep.equal(schema.schema);
  });

  it('should not allow destroying schema', async () => {
    const userDB = await database.user(USERS[0].id);
    return expectError(userDB.destroy('core', 'schema', 'thing'), /User .* cannot destroy core\/schema\/thing/)
  });

  it('should not allow destroying namespace', async () => {
    const userDB = await database.user(USERS[0].id);
    return expectError(userDB.destroy('core', 'namespace', 'foo'), /User .* cannot destroy core\/namespace\/foo/)
  });

  it('should not allow other user to add duplicate namespace', async () => {
    const userDB = await database.user(USERS[1].id);
    return expectError(userDB.create('core', 'namespace', {}, 'foo'), /Item core\/namespace\/foo already exists/);
  });

  it('should not allow other user to publish namespace', async () => {
    const userDB = await database.user(USERS[1].id);
    const ns = {
      versions: [{
        version: '0',
        types: {
          'thing': {schema: {$ref: '/data/core/schema/thing'}},
        }
      }]
    }
    return expectError(userDB.update('core', 'namespace', 'foo', ns), /User .* cannot update core\/namespace\/foo/)
  });

  it('should allow owner to alter namespace', async () => {
    const userDB = await database.user(USERS[0].id);
    const ns = {
      versions: [{
        version: '0',
        types: {
          'thing': {schema: {$ref: '/data/core/schema/thing'}, initial_acl: {destroy: []}},
        }
      }]
    }
    return expectError(userDB.update('core', 'namespace', 'foo', ns), /User .* cannot update core\/namespace\/foo/);
  });

  it('should allow user to create thing', async () => {
    const userDB = await database.user(USERS[0].id);
    let item = await userDB.create('foo', 'thing', "Hello world!", 'thing1');
    expect(item.data).to.equal("Hello world!");
    item = await userDB.get('foo', 'thing', item.id);
    expect(item.data).to.equal("Hello world!");
  });

  it('should allow other user to create thing', async () => {
    const userDB = await database.user(USERS[1].id);
    let item = await userDB.create('foo', 'thing', "Goodbye world!", 'thing2');
    expect(item.data).to.equal("Goodbye world!");
    item = await userDB.get('foo', 'thing', item.id);
    expect(item.data).to.equal("Goodbye world!");
  });

  it('should not allow first user to access or alter second thing', async () => {
    const userDB = await database.user(USERS[0].id);
    let thing = await userDB.get('foo', 'thing', 'thing2');
    expect(thing).to.equal(undefined);
    await expectError(userDB.update('foo', 'thing', 'thing2', "This is a new string"), /User .* cannot update foo\/thing\/thing2/);
    await expectError(userDB.setACL('foo', 'thing', 'thing2', {read: ['_all']}), /User .* cannot update ACL for foo\/thing\/thing2/);
    await expectError(userDB.destroy('foo', 'thing', 'thing2'), /User .* cannot destroy foo\/thing\/thing2/);
  });

  it('should not allow second user to access or alter first thing', async () => {
    const userDB = await database.user(USERS[1].id);
    let thing = await userDB.get('foo', 'thing', 'thing1');
    expect(thing).to.equal(undefined);
    await expectError(userDB.update('foo', 'thing', 'thing1', "This is a new string"), /User .* cannot update foo\/thing\/thing1/);
    await expectError(userDB.setACL('foo', 'thing', 'thing1', {read: ['_all']}), /User .* cannot update ACL for foo\/thing\/thing1/);
    await expectError(userDB.destroy('foo', 'thing', 'thing1'), /User .* cannot destroy foo\/thing\/thing1/);
  });

  it('should allow user to retrieve all things', async () => {
    const userDB = await database.user(USERS[0].id);
    let items = await userDB.getAll('foo', 'thing');
    expect(items.length).to.equal(1);
    expect(items[0].data).to.equal("Hello world!");
  });

  it('should allow user to destroy thing', async () => {
    const userDB = await database.user(USERS[0].id);
    let item = await userDB.get('foo', 'thing', 'thing1');
    expect(typeof item).to.equal('object');
    await userDB.destroy('foo', 'thing', 'thing1');
    item = await userDB.get('foo', 'thing', 'thing1');
    expect(item).to.equal(undefined);
  });

  it('should not allow invalid ACL', async () => {
    const userDB = await database.user(USERS[1].id);
    return expectError(userDB.setACL('foo', 'thing', 'thing2', {read: {}}), /ACL is invalid. data.read should be array/);
  });

  it('should allow other user to update ACL', async () => {
    const userDB = await database.user(USERS[1].id);
    await userDB.setACL('foo', 'thing', 'thing2', {read: ['_all']});
  });

  it('should allow first user to retrieve thing2 after updated ACL', async () => {
    const userDB = await database.user(USERS[0].id);
    const item = await userDB.get('foo', 'thing', 'thing2');
    expect(item.data).to.equal('Goodbye world!');

    const list = await userDB.getAll('foo', 'thing');
    expect(list.length).to.equal(1);
    expect(list[0].data).to.equal("Goodbye world!");
  });

  it('should not allow first user to alter thing2 after updated ACL', async () => {
    const userDB = await database.user(USERS[0].id);
    await expectError(userDB.update('foo', 'thing', 'thing2', "This is a new string"), /User .* cannot update foo\/thing\/thing2/);
    await expectError(userDB.setACL('foo', 'thing', 'thing2', {read: ['_all']}), /User .* cannot update ACL for foo\/thing\/thing2/);
    await expectError(userDB.destroy('foo', 'thing', 'thing2'), /User .* cannot destroy foo\/thing\/thing2/);
  });

  it('should allow transfer of ownership', async () => {
    const userDB = await database.user(USERS[1].id);
    await userDB.setACL('foo', 'thing', 'thing2', {owner: USERS[0].id, read: ['_all']});
    const item = await userDB.get('foo', 'thing', 'thing2');
    expect(item.acl.owner).to.equal(USERS[0].id);
  });

  it('should not allow second user to alter thing2 after owner transfer', async () => {
    const userDB = await database.user(USERS[1].id);
    await expectError(userDB.update('foo', 'thing', 'thing2', "This is a new string"), /User .* cannot update foo\/thing\/thing2/);
    await expectError(userDB.setACL('foo', 'thing', 'thing2', {read: ['_all']}), /User .* cannot update ACL for foo\/thing\/thing2/);
    await expectError(userDB.destroy('foo', 'thing', 'thing2'), /User .* cannot destroy foo\/thing\/thing2/);
  });

  it('should allow first user to alter thing2 after owner transfer', async () => {
    const userDB = await database.user(USERS[0].id);
    await userDB.update('foo', 'thing', 'thing2', "This is a new string");
    const item = await userDB.get('foo', 'thing', 'thing2');
    expect(item.data).to.equal("This is a new string");
  });

  it('should allow namespace with default_acl', async () => {
    const userDB = await database.user(USERS[0].id);
    const ns = {versions: [{
      version: '0',
      types: {
        thing: {
          schema: {$ref: '/data/core/schema/thing'},
          initial_acl: {
            owner: 'flooob',
            read: ['_all'],
            destroy: [],
            modify_destroy: [],
          },
        }
      }
    }]}
    await userDB.create('core', 'namespace', ns, 'foo2');
    let created = await userDB.create('foo2', 'thing', "Hi there");
    expect(created.acl).to.deep.equal({
      owner: USERS[0].id,
      read: ['_all'],
      write: ['_owner'],
      append: ['_owner'],
      destroy: [],
      modify_read: ['_owner'],
      modify_write: ['_owner'],
      modify_append: ['_owner'],
      modify_destroy: [],
    })
  });

  /** TODO:
   *  Should not allow removing version from namespace
   *  Should not allow changing schema/namespace ID
   *  Should validate against different versions
   */
});

