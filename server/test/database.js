const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const expect = chai.expect;
const config = require('../lib/config');
const Database = require('../lib/database');

let database = null;
let systemDB = null;
let USERS = [];

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
  let mongod = null;

  beforeEach(async function() {
    mongod = new MongoMemoryServer();
    const uri = await mongod.getConnectionString();
    database = new Database(uri);
    await database.initialize();
    systemDB = await database.user('_system');

    USERS = []
    USERS.push(await database.createUser('user1@example.com', 'abcdabcd'));
    USERS.push(await database.createUser('user2@example.com', 'abcdefgh'));
    USERS.push(await database.createUser('user3@example.com', 'abcdefgh'));

    const userDB = await database.user(USERS[0].id);
    const thingSchema = {type: 'string'};
    const listSchema = {
      type: 'object',
      properties: {
        things: {type: 'array', items: {type: 'string'}},
      },
    }
    await userDB.create('core', 'schema', thingSchema, 'thing');
    await userDB.create('core', 'schema', listSchema, 'list');
    const ns = {
      versions: [{
        version: '0',
        types: {
          'thing': {schema: {$ref: '/data/core/schema/thing'}, initial_acl: {allow: {read: ['_all']}}},
          'list': {schema: {$ref: '/data/core/schema/list'}},
        }
      }]
    }
    await userDB.create('core', 'namespace', ns, 'foo');
  })

  afterEach(async function() {
    mongod.stop();
  })

  it('should have core schemas', async () => {
    let user = await systemDB.get('core', 'schema', 'schema');
    expect(user.acl.owner).to.equal('_system');
    expect(user.acl.allow.read).to.deep.equal(['_all']);
    expect(user.data.type).to.deep.equal(['object', 'boolean']);

    let schema = await systemDB.get('core', 'schema', 'user');
    expect(schema.acl).to.deep.equal({
      owner: '_system',
      allow: {
        read: ['_all'],
        write: [],
        append: [],
        destroy: [],
      },
      modify: {
        read: [],
        write: [],
        append: [],
        destroy: [],
      },
      disallow: {},
    });
    expect(schema.acl.allow.read).to.deep.equal(['_all']);
    expect(schema.data.type).to.equal('object');
  });

  it('should not create item for missing namespace', () => {
    return expectError(systemDB.create('floob', 'user', {str: 'baz'}), /Namespace floob not found/);
  });

  it('should not create item for missing schema', () => {
    return expectError(systemDB.create('core', 'foo', {name: 'alice'}), /Schema core\/foo not found/);
  });

  it('should not allow initalizing for missing user', () => {
    return expectError(database.user('foo'), /User foo not found/);
  });

  it('should allow creating users', async () => {
    let user = await database.createUser('me@example.com', 'abcdabcd');
    expect(user.data).to.deep.equal({publicKey: ''});
  });

  it('should not allow duplicate email', async () => {
    let user = await database.createUser('me@example.com', 'abcdabcd');
    await expectError(database.createUser('me@example.com', 'afsdjklsf'), /A user with that email address already exists/)
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
    await userDB.create('core', 'namespace', ns, 'foo2');
  });

  it('should not allow creating namespace with additional properties', async () => {
    const userDB = await database.user(USERS[0].id);
    const ns = {
      versions: [{
        version: '0',
        foo: 'bar',
        types: {
          'thing': {schema: {$ref: '/data/core/schema/thing'}},
        }
      }]
    }
    await expectError(userDB.create('core', 'namespace', ns, 'foo2'), /Data does not match schema. data.versions\[0\] should NOT have additional properties/);
  })

  it('should allow creating schema', async () => {
    const userDB = await database.user(USERS[0].id);
    const schema = {type: 'string'};
    const created = await userDB.create('core', 'schema', schema, 'thingamajig');
    expect(created.data.id).to.equal(schema.id);
    expect(created.data.schema).to.deep.equal(schema.schema);
  });

  it('should not allow destroying schema', async () => {
    const userDB = await database.user(USERS[0].id);
    const schema = {type: 'string'};
    const created = await userDB.create('core', 'schema', schema, 'thingamajig');
    return expectError(userDB.destroy('core', 'schema', 'thingamajig'), /User .* cannot destroy core\/schema\/thingamajig/)
  });

  it('should not allow destroying namespace', async () => {
    const userDB = await database.user(USERS[0].id);
    const ns = {
      versions: [{
        version: '0',
        types: {
          'thing': {schema: {$ref: '/data/core/schema/thing'}},
        }
      }]
    }
    await userDB.create('core', 'namespace', ns, 'foo2');
    return expectError(userDB.destroy('core', 'namespace', 'foo'), /User .* cannot destroy core\/namespace\/foo/)
  });

  it('should not allow other user to add duplicate namespace', async () => {
    const user0DB = await database.user(USERS[0].id);
    const user1DB = await database.user(USERS[1].id);
    const ns = {
      versions: [{
        version: '0',
        types: {
          'thing': {schema: {$ref: '/data/core/schema/thing'}},
        }
      }]
    }
    await user0DB.create('core', 'namespace', ns, 'foo2');
    return expectError(user1DB.create('core', 'namespace', {}, 'foo2'), /Item core\/namespace\/foo2 already exists/);
  });

  it('should not allow other user to publish namespace', async () => {
    const user0DB = await database.user(USERS[0].id);
    const user1DB = await database.user(USERS[1].id);
    const ns = {
      versions: [{
        version: '0',
        types: {
          'thing': {schema: {$ref: '/data/core/schema/thing'}},
        }
      }]
    }
    await user0DB.create('core', 'namespace', ns, 'foo2');
    return expectError(user1DB.update('core', 'namespace', 'foo2', ns), /User .* cannot update core\/namespace\/foo2/)
  });

  it('should not allow owner to alter namespace', async () => {
    const user0DB = await database.user(USERS[0].id);
    const ns = {
      versions: [{
        version: '0',
        types: {
          'thing': {schema: {$ref: '/data/core/schema/thing'}, initial_acl: {allow: {destroy: []}}},
        }
      }]
    }
    await user0DB.create('core', 'namespace', ns, 'foo2');
    ns.versions[0].version = '1';
    return expectError(user0DB.update('core', 'namespace', 'foo2', ns), /User .* cannot update core\/namespace\/foo/);
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

  it('should not allow duplicate ID for invisible thing', async () => {
    const user0DB = await database.user(USERS[0].id);
    const user1DB = await database.user(USERS[1].id);
    const item1 = await user0DB.create('foo', 'thing', "hello", "unique");
    await user0DB.setACL('foo', 'thing', 'unique', {disallow: {read: [USERS[1].id]}});

    const item1ForUser1 = await user1DB.get('foo', 'thing', 'unique');
    expect(item1ForUser1).to.equal(undefined);

    await expectError(user1DB.create('foo', 'thing', 'goodbye', 'unique'), /already exists/);
  })

  it('should not allow one user to access or alter another user\'s thing', async () => {
    const user0DB = await database.user(USERS[0].id);
    const user1DB = await database.user(USERS[1].id);
    await user0DB.create('foo', 'thing', "Hello!", 'thing2');
    await user0DB.setACL('foo', 'thing', 'thing2', {allow: {read: ['_owner']}});
    let thing = await user1DB.get('foo', 'thing', 'thing2');
    expect(thing).to.equal(undefined);
    await expectError(user1DB.update('foo', 'thing', 'thing2', "This is a new string"), /User .* cannot update foo\/thing\/thing2/);
    await expectError(user1DB.setACL('foo', 'thing', 'thing2', {allow: {read: ['_all']}}), /User .* cannot update ACL for foo\/thing\/thing2/);
    await expectError(user1DB.destroy('foo', 'thing', 'thing2'), /User .* cannot destroy foo\/thing\/thing2/);
  });

  it('should allow user to retrieve all things', async () => {
    const user0DB = await database.user(USERS[0].id);
    const user1DB = await database.user(USERS[1].id);
    await user0DB.create('foo', 'thing', "Hello");
    await user1DB.create('foo', 'thing', "Goodbye", 'thing2');
    await user1DB.setACL('foo', 'thing', 'thing2', {allow: {read: ['_all']}});
    let items = await user0DB.getAll('foo', 'thing');
    expect(items.length).to.equal(2);
    expect(items[0].data).to.equal("Hello");
    expect(items[1].data).to.equal("Goodbye");
  });

  it('should allow filtering and sorting', async () => {
    const user0DB = await database.user(USERS[0].id);
    const user1DB = await database.user(USERS[1].id);
    await user0DB.create('foo', 'thing', "one", "one");
    await user0DB.create('foo', 'thing', "two", "two");
    const midpoint = new Date().toISOString();
    await user0DB.create('foo', 'thing', "three", "three");
    await user0DB.create('foo', 'thing', "four", "four");

    let list = (await user0DB.list('foo', 'thing')).map(d => d.data);
    expect(list).to.deep.equal(['one', 'two', 'three', 'four']);

    list = (await user0DB.list('foo', 'thing', {}, {'info.created': -1})).map(d => d.data);
    expect(list).to.deep.equal(['four', 'three', 'two', 'one']);

    list = (await user0DB.list('foo', 'thing', {}, {data: 1})).map(d => d.data);
    expect(list).to.deep.equal(['four', 'one', 'three', 'two']);

    list = (await user0DB.list('foo', 'thing', {}, {data: -1})).map(d => d.data);
    expect(list).to.deep.equal(['two', 'three', 'one', 'four']);

    list = (await user0DB.list('foo', 'thing', {created_before: midpoint})).map(d => d.data);
    expect(list).to.deep.equal(['one', 'two']);

    list = (await user0DB.list('foo', 'thing', {created_since: midpoint})).map(d => d.data);
    expect(list).to.deep.equal(['three', 'four']);

    list = (await user0DB.list('foo', 'thing', {data: 'four'})).map(d => d.data);
    expect(list).to.deep.equal(['four']);

    await user1DB.create('foo', 'thing', "five", 'five');
    let five = await user1DB.get('foo', 'thing', 'five');
    list = (await user0DB.list('foo', 'thing')).map(d => d.data);
    expect(list).to.deep.equal(['one', 'two', 'three', 'four', 'five']);

    list = (await user0DB.list('foo', 'thing', {owner: USERS[1].id})).map(d => d.data);
    expect(list).to.deep.equal(['five']);

    list = (await user0DB.list('foo', 'thing', {owner: USERS[0].id})).map(d => d.data);
    expect(list).to.deep.equal(['one', 'two', 'three', 'four']);

    const beforeModify = new Date().toISOString();
    await user0DB.update('foo', 'thing', 'two', "TWO");
    list = (await user0DB.list('foo', 'thing', {updated_since: beforeModify})).map(d => d.data);
    expect(list).to.deep.equal(['TWO']);

    list = (await user0DB.list('foo', 'thing')).map(d => d.info);

    list = (await user0DB.list('foo', 'thing', {updated_before: beforeModify})).map(d => d.data);
    expect(list).to.deep.equal(['one', 'three', 'four', 'five']);
  });

  it('should allow user to destroy thing', async () => {
    const userDB = await database.user(USERS[0].id);
    await userDB.create('foo', 'thing', "Hello", 'thing1');
    let item = await userDB.get('foo', 'thing', 'thing1');
    expect(item.data).to.equal('Hello');
    await userDB.destroy('foo', 'thing', 'thing1');
    item = await userDB.get('foo', 'thing', 'thing1');
    expect(item).to.equal(undefined);
  });

  it('should allow append', async () => {
    const userDB = await database.user(USERS[0].id);
    await userDB.create('foo', 'list', {things: ['foo']}, 'mylist');
    let item = await userDB.get('foo', 'list', 'mylist');
    expect(item.data.things).to.deep.equal(['foo']);
    await expectError(userDB.append('foo', 'list', 'mylist', {things: [3]}), /should be string/);
    await expectError(userDB.append('foo', 'list', 'mylist', {widgets: ['bar']}), /Schema not found for key widgets/);
    await userDB.append('foo', 'list', 'mylist', {things: ['bar']});
    item = await userDB.get('foo', 'list', 'mylist');
    expect(item.data.things).to.deep.equal(['foo', 'bar']);
  })

  it('should not allow invalid ACL', async () => {
    const userDB = await database.user(USERS[0].id);
    await userDB.create('foo', 'thing', "Hello", 'thing2')
    await expectError(userDB.setACL('foo', 'thing', 'thing2', {allow: {read: {}}}), /ACL is invalid. data.allow.read should be array/);
  });

  it('should allow user to update ACL', async () => {
    const user0DB = await database.user(USERS[0].id);
    const user1DB = await database.user(USERS[1].id);
    await user0DB.create('foo', 'thing', "Hello", 'thing2')
    await user0DB.setACL('foo', 'thing', 'thing2', {allow: {read: ['_all'], write: ['_all']}});
    await user1DB.update('foo', 'thing', 'thing2', "Goodbye");
    let thing = await user0DB.get('foo', 'thing', 'thing2');
    expect(thing.data).to.equal("Goodbye");
  });

  it('should not allow other user to alter thing after updated ACL', async () => {
    const user0DB = await database.user(USERS[0].id);
    const user1DB = await database.user(USERS[1].id);
    await user0DB.create('foo', 'thing', "Hello", 'thing2')
    await user0DB.setACL('foo', 'thing', 'thing2', {allow: {read: ['_all']}});
    await expectError(user1DB.update('foo', 'thing', 'thing2', "This is a new string"), /User .* cannot update foo\/thing\/thing2/);
    await expectError(user1DB.setACL('foo', 'thing', 'thing2', {allow: {read: ['_all']}}), /User .* cannot update ACL for foo\/thing\/thing2/);
    await expectError(user1DB.destroy('foo', 'thing', 'thing2'), /User .* cannot destroy foo\/thing\/thing2/);
  });

  it('should allow blacklisting access to thing2', async () => {
    const user1DB = await database.user(USERS[1].id);
    await user1DB.create('foo', 'thing', "Hello", 'thing2');
    await user1DB.setACL('foo', 'thing', 'thing2', {allow: {read: ['_all']}, disallow: {read: [USERS[2].id]}});
    let item = await user1DB.get('foo', 'thing', 'thing2');
    expect(item.acl.disallow).to.deep.equal({read: [USERS[2].id]});

    const user2DB = await database.user(USERS[2].id);
    item = await user2DB.get('foo', 'thing', 'thing2');
    expect(item).to.equal(undefined)

    const user0DB = await database.user(USERS[0].id);
    item = await user0DB.get('foo', 'thing', 'thing2');
    expect(item.data).to.equal('Hello');
  })

  it('should allow transfer of ownership', async () => {
    const userDB = await database.user(USERS[1].id);
    await userDB.create('foo', 'thing', "Hello", 'thing2');
    await userDB.setACL('foo', 'thing', 'thing2', {owner: USERS[0].id, allow: {read: ['_all']}});
    const item = await userDB.get('foo', 'thing', 'thing2');
    expect(item.acl.owner).to.equal(USERS[0].id);
  });

  it('should not allow updates from original owner after owner transfer', async () => {
    const userDB = await database.user(USERS[1].id);
    await userDB.create('foo', 'thing', "Hello", 'thing2');
    await userDB.setACL('foo', 'thing', 'thing2', {owner: USERS[0].id});
    await expectError(userDB.update('foo', 'thing', 'thing2', "This is a new string"), /User .* cannot update foo\/thing\/thing2/);
    await expectError(userDB.setACL('foo', 'thing', 'thing2', {allow: {read: ['_all']}}), /User .* cannot update ACL for foo\/thing\/thing2/);
    await expectError(userDB.destroy('foo', 'thing', 'thing2'), /User .* cannot destroy foo\/thing\/thing2/);
  });

  it('should allow updates from new owner after owner transfer', async () => {
    const user1DB = await database.user(USERS[1].id);
    await user1DB.create('foo', 'thing', "Hello", 'thing2');
    await user1DB.setACL('foo', 'thing', 'thing2', {owner: USERS[0].id});
    const user0DB = await database.user(USERS[0].id);
    await user0DB.update('foo', 'thing', 'thing2', "This is a new string");
    const item = await user0DB.get('foo', 'thing', 'thing2');
    expect(item.data).to.equal("This is a new string");
  });

  it('should allow namespace with initial_acl', async () => {
    const userDB = await database.user(USERS[0].id);
    const ns = {versions: [{
      version: '0',
      types: {
        thing: {
          schema: {$ref: '/data/core/schema/thing'},
          initial_acl: {
            allow: {
              read: ['_all'],
              destroy: [],
            },
            modify: {
              destroy: [],
            },
          },
        }
      }
    }]}
    await userDB.create('core', 'namespace', ns, 'foo2');
    let created = await userDB.create('foo2', 'thing', "Hi there");
    expect(created.acl).to.deep.equal({
      owner: USERS[0].id,
      allow: {
        read: ['_all'],
        write: ['_owner'],
        append: ['_owner'],
        destroy: [],
      },
      modify: {
        read: ['_owner'],
        write: ['_owner'],
        append: ['_owner'],
        destroy: [],
      },
      disallow: {},
    })
  });

  it('should track namespaces and number of items per user', async () => {
    const userDB = await database.user(USERS[2].id);
    let thing1 = await userDB.create('foo', 'thing', "test");
    let user = await userDB.get('core', 'user', USERS[2].id);
    expect(user.data.items).to.equal(1);
    expect(user.data.namespaces).to.deep.equal(['foo']);

    let thing2 = await userDB.create('foo', 'thing', "test");
    user = await userDB.get('core', 'user', USERS[2].id);
    expect(user.data.items).to.equal(2);
    expect(user.data.namespaces).to.deep.equal(['foo']);

    await userDB.create('core', 'schema', {type: 'string'});
    user = await userDB.get('core', 'user', USERS[2].id);
    expect(user.data.items).to.equal(3);
    expect(user.data.namespaces).to.deep.equal(['foo', 'core']);

    await userDB.destroy('foo', 'thing', thing2.id)
    user = await userDB.get('core', 'user', USERS[2].id);
    expect(user.data.items).to.equal(2);
    expect(user.data.namespaces).to.deep.equal(['foo', 'core']);
  });

  it('should hit a limit for number of items per user', async () => {
    const oldMaxItems = config.maxItemsPerUser;
    config.maxItemsPerUser = 10;
    const userDB = await database.user(USERS[2].id);
    for (let i = 0; i < config.maxItemsPerUser; ++i) {
      await userDB.create('foo', 'thing', 'foobar');
    }
    await expectError(userDB.create('foo', 'thing', 'foobar'), /You have hit your maximum of 10 items. Please destroy something to create a new one/);
    config.maxItemsPerUser = oldMaxItems;
  });

  it('should respect the maximum number of bytes per item in append', async function() {
    this.timeout(10000);
    const oldMaxBytes = config.maxBytesPerItem;
    config.maxBytesPerItem = 1000;
    const userDB = await database.user(USERS[0].id);
    const list = await userDB.create('foo', 'list', {things: []});
    for (let i = 0; i < (config.maxBytesPerItem / 4) - 2; ++i) {
      await userDB.append('foo', 'list', list.id, {things: ['a']});
    }
    await expectError(userDB.append('foo', 'list', list.id, {things: ['a']}), /would exceed the maximum of 1000 bytes/);
    config.maxBytesPerItem = oldMaxBytes;
  });

  it('should allow ref to external item', async () => {
    const userDB = await database.user(USERS[0].id);
    const data = {
      $ref: 'https://example.com/data/foo/thing/abc',
    };
    const item = await userDB.create('foo', 'thing', data);
    expect(item.data).to.deep.equal(data);
  });

  it('should not allow keys with special characters', async() => {
    const userDB = await database.user(USERS[0].id);

    let schema = {
      type: 'object',
      properties: {
        'foo.bar': {type: 'string'},
      }
    }
    await expectError(userDB.create('core', 'schema', schema), /Object key foo.bar is invalid/);

    schema = {
      type: 'object',
      properties: {
        'abc-d': {type: 'string'},
      }
    }
    await expectError(userDB.create('core', 'schema', schema), /Object key abc-d is invalid/);

    schema = {
      type: 'object',
      properties: {
        '_foo': {type: 'string'},
      }
    }
    await expectError(userDB.create('core', 'schema', schema), /Object key _foo is invalid/);

    schema = {
      type: 'object',
      properties: {
        '1foo': {type: 'string'},
      }
    }
    await expectError(userDB.create('core', 'schema', schema), /Object key 1foo is invalid/);

    schema = {
      type: 'object',
      properties: {
        '$foo': {type: 'string'},
      }
    }
    await expectError(userDB.create('core', 'schema', schema), /Object key \$foo is invalid/);
  })
});

