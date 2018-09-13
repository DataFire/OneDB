const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
const randomstring = require('randomstring');
const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const expect = chai.expect;
const Database = require('../lib/database');
const dbUtil = require('../lib/db-util');

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
    this.timeout(5000);
    mongod = new MongoMemoryServer();
    const uri = await mongod.getConnectionString();
    database = new Database(uri);
    await database.initialize();
    systemDB = await database.user('_system');

    USERS = []
    USERS.push(await database.createUser('user1@example.com', 'abcdabcd'));
    USERS.push(await database.createUser('user2@example.com', 'abcdefgh'));
    USERS.push(await database.createUser('user3@example.com', 'abcdefgh'));

    const userDB = await database.user(USERS[0].$.id);
    const thingSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        message: {type: 'string'},
      }
    }
    const listSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        things: {type: 'array', items: {$ref: '#/definitions/thing'}},
      },
    }
    const inlineListSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        things: {type: 'array', items: thingSchema},
      },
    }
    const multiSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: {type: 'string'},
        description: {type: 'string'},
        things: {type: 'array', items: {$ref: '#/definitions/thing'}},
      }
    }
    const ns = {
      versions: [{
        version: '0',
        types: {
          'thing': {schema: thingSchema, initial_acl: {allow: {read: ['_all']}}},
          'list': {schema: listSchema},
          'inline_list': {schema: inlineListSchema},
          'multi': {schema: multiSchema},
        }
      }]
    }
    await userDB.create('core', 'namespace', 'foo', ns);
  })

  afterEach(async function() {
    mongod.stop();
  })

  it('should have core schemas', async () => {
    let ns = await systemDB.get('core', 'namespace', 'core');

    expect(ns.versions.length).to.equal(1);
    let types = ns.versions[0].types;
    expect(Object.keys(types)).to.have.members(['user_private', 'user', 'schema', 'namespace', 'authorization_token']);
    expect(types.user_private).to.deep.equal({
      schema: {$ref: '/data/core/schema/user_private'},
      initial_acl: dbUtil.PRIVATE_ACL_SET,
    });
    expect(types.user).to.deep.equal({
      schema: {$ref: '/data/core/schema/user'},
      initial_acl: {
        allow: {
          read: [dbUtil.USER_KEYS.all],
          write: [dbUtil.USER_KEYS.owner],
        },
        modify: dbUtil.SYSTEM_ACL,
      }
    });
    expect(types.schema).to.deep.equal({
      schema: {$ref: '/data/core/schema/schema'},
      initial_acl: dbUtil.READ_ONLY_ACL_SET,
    });
    expect(types.namespace).to.deep.equal({
      schema: {$ref: '/data/core/schema/namespace'},
      initial_acl: {
        allow: Object.assign({}, dbUtil.READ_ONLY_ACL, {append: ['_owner']}),
        modify: dbUtil.SYSTEM_ACL,
      },
    });

    let schema = await systemDB.get('core', 'schema', 'schema');
    let acl = await systemDB.getACL('core', 'schema', 'schema');
    expect(acl.owner).to.equal('_system');
    expect(acl.allow.read).to.deep.equal(['_all']);
    expect(schema.oneOf[1].type).to.deep.equal(['object', 'boolean']);

    let user = await systemDB.get('core', 'schema', 'user');
    acl = await systemDB.getACL('core', 'schema', 'user');
    expect(acl).to.deep.equal({
      owner: '_system',
      allow: dbUtil.READ_ONLY_ACL,
      modify: dbUtil.SYSTEM_ACL,
    });
    expect(user.type).to.equal('object');
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
    delete user.$;
    expect(user).to.deep.equal({});
  });

  it('should not allow duplicate email', async () => {
    let user = await database.createUser('me@example.com', 'abcdabcd');
    await expectError(database.createUser('me@example.com', 'afsdjklsf'), /A user with that email address already exists/)
  });

  it('should not allow updating or destroying core type', async () => {
    const userDB = await database.user(USERS[0].$.id);
    await expectError(userDB.destroy('core', 'schema', 'namespace'), /User .* cannot destroy core\/schema\/namespace/);
    await expectError(userDB.destroy('core', 'namespace', 'core'), /User .* cannot destroy core\/namespace\/core/);
    await expectError(userDB.update('core', 'namespace', 'core', {versions: [{types: {}}]}), /User .* cannot update core\/namespace\/core/);
    await expectError(userDB.update('core', 'schema', 'namespace', {type: 'string'}), /User .* cannot update core\/schema\/namespace/);
  });

  it('should allow creating new namespace', async () => {
    const userDB = await database.user(USERS[0].$.id);
    const ns = {
      versions: [{
        types: {
          'thing': {schema: {$ref: '/data/core/schema/thing'}},
        }
      }]
    }
    await userDB.create('core', 'namespace', 'foo2', ns);
    const nsBack = await userDB.get('core', 'namespace', 'foo2');
    expect(nsBack.versions.length).to.equal(1);
    expect(nsBack.versions[0].version).to.equal('0.0');
  });

  it('should allow creating a new namespace version', async () => {
    const userDB = await database.user(USERS[0].$.id);
    const ns = {
      versions: [{
        types: {
          'thing': {
            schema: {
              type: 'object',
              properties: {
                message: {type: 'string', maxLength: 5, minLength: 5},
              }
            }
          },
        }
      }]
    }
    await userDB.create('core', 'namespace', 'myns', JSON.parse(JSON.stringify(ns)));
    await userDB.create('myns', 'thing', 'thing0', {message: 'abcde'});
    const thingv0 = await userDB.get('myns', 'thing', 'thing0');
    expect(thingv0.$.info.namespace_version).to.equal('0.0');
    await expectError(userDB.create('myns', 'thing', {message: 'abcdef'}), /should NOT be longer than 5 characters/);

    const v1 = ns.versions[0];
    v1.types.thing.schema.properties.message.minLength = 10;
    v1.types.thing.schema.properties.message.maxLength = 10;
    await userDB.append('core', 'namespace', 'myns', {versions: [v1]});
    const nsBack = await userDB.get('core', 'namespace', 'myns');
    expect(nsBack.versions.length).to.equal(2);
    expect(nsBack.versions[0].version).to.equal('0.0');
    expect(nsBack.versions[1].version).to.equal('1.0');

    await userDB.create('myns', 'thing', 'thing1', {message: 'abcdefghij'});
    await expectError(userDB.create('myns', 'thing', {message: 'abcde'}), /should NOT be shorter than 10 characters/);
    const thing1 = await userDB.get('myns', 'thing', 'thing1');
    expect(thing1.message).to.equal('abcdefghij');
    expect(thing1.$.info.namespace_version).to.equal('1.0');

    let foo = await userDB.create('myns@0.0', 'thing', 'thing02', {message: 'fghij'});
    const thing02 = await userDB.get('myns', 'thing', 'thing02');
    expect(thing02.message).to.equal('fghij');
    expect(thing02.$.info.namespace_version).to.equal('0.0');

    expect(await userDB.get('myns@1.0', 'thing', 'thing02')).to.equal(undefined);

    let list = await userDB.list('myns', 'thing');
    expect(list.length).to.equal(3);
    expect(list.map(i => i.message)).to.deep.equal(['fghij', 'abcdefghij', 'abcde']);

    list = await userDB.list('myns@0.0', 'thing');
    expect(list.length).to.equal(2);
    expect(list.map(i => i.message)).to.deep.equal(['fghij', 'abcde']);

    list = await userDB.list('myns@1.0', 'thing');
    expect(list.length).to.equal(1);
    expect(list.map(i => i.message)).to.deep.equal(['abcdefghij']);

    await userDB.update('myns@0.0', 'thing', 'thing0', {message: '12345'});
    let newThing0 = await userDB.get('myns', 'thing', 'thing0');
    expect(newThing0.$.info.namespace_version).to.equal('0.0');
    expect(newThing0.message).to.equal('12345');

    await userDB.update('myns', 'thing', 'thing0', {message: '1234567890'})
    newThing0 = await userDB.get('myns', 'thing', 'thing0');
    expect(newThing0.$.info.namespace_version).to.equal('1.0');
    expect(newThing0.message).to.equal('1234567890');
  });

  it('should not allow creating namespace with additional properties', async () => {
    const userDB = await database.user(USERS[0].$.id);
    const ns = {
      versions: [{
        version: '0',
        foo: 'bar',
        types: {
          'thing': {schema: {$ref: '/data/core/schema/thing'}},
        }
      }]
    }
    await expectError(userDB.create('core', 'namespace', 'foo2', ns), /Data does not match schema. versions.0 should not have extra property foo/);
  })

  it('should allow creating schema', async () => {
    const userDB = await database.user(USERS[0].$.id);
    const schema = {type: 'object'};
    const created = await userDB.create('core', 'schema', 'thingamajig', schema);
    expect(created.$.id).to.be.a('string');
    delete created.$;
    expect(created).to.deep.equal(schema);
  });

  it('should not allow creating primitive schema', async () => {
    const userDB = await database.user(USERS[0].$.id);
    const schema = {type: 'string'};
    await expectError(userDB.create('core', 'schema', 'thingamajig', schema), /must have type 'object'/);
  })

  it('should not allow destroying schema', async () => {
    const userDB = await database.user(USERS[0].$.id);
    const schema = {type: 'object'};
    const created = await userDB.create('core', 'schema', 'thingamajig', schema);
    return expectError(userDB.destroy('core', 'schema', 'thingamajig'), /User .* cannot destroy core\/schema\/thingamajig/)
  });

  it('should not allow destroying namespace', async () => {
    const userDB = await database.user(USERS[0].$.id);
    const ns = {
      versions: [{
        version: '0',
        types: {
          'thing': {schema: {$ref: '/data/core/schema/thing'}},
        }
      }]
    }
    await userDB.create('core', 'namespace', 'foo2', ns);
    return expectError(userDB.destroy('core', 'namespace', 'foo'), /User .* cannot destroy core\/namespace\/foo/)
  });

  it('should not allow other user to add duplicate namespace', async () => {
    const user0DB = await database.user(USERS[0].$.id);
    const user1DB = await database.user(USERS[1].$.id);
    const ns = {
      versions: [{
        version: '0',
        types: {
          'thing': {schema: {type: 'object'}},
        }
      }]
    }
    await user0DB.create('core', 'namespace', 'foo2', ns);
    return expectError(user1DB.create('core', 'namespace', 'foo2', ns), /Item core\/namespace\/foo2 already exists/);
  });

  it('should not allow other user to publish namespace', async () => {
    const user0DB = await database.user(USERS[0].$.id);
    const user1DB = await database.user(USERS[1].$.id);
    const ns = {
      versions: [{
        version: '0',
        types: {
          'thing': {schema: {type: 'object', properties: {}}},
        }
      }]
    }
    await user0DB.create('core', 'namespace', 'foo2', ns);
    return expectError(user1DB.update('core', 'namespace', 'foo2', ns), /User .* cannot update core\/namespace\/foo2/)
  });

  it('should not allow owner to alter namespace', async () => {
    const user0DB = await database.user(USERS[0].$.id);
    const ns = {
      versions: [{
        version: '0',
        types: {
          'thing': {schema: {type: 'object', properties: {}}},
        }
      }]
    }
    await user0DB.create('core', 'namespace', 'foo2', ns);
    ns.versions[0].version = '1';
    return expectError(user0DB.update('core', 'namespace', 'foo2', ns), /User .* cannot update core\/namespace\/foo/);
  });

  it('should allow new versions of namespace', async () => {
    const user0DB = await database.user(USERS[0].$.id);
  })

  it('should allow user to create thing', async () => {
    const userDB = await database.user(USERS[0].$.id);
    let item = await userDB.create('foo', 'thing', 'thing1', {message: "Hello world!"});
    expect(item.message).to.equal("Hello world!");
    item = await userDB.get('foo', 'thing', item.$.id);
    delete item.$;
    expect(item).to.deep.equal({message: "Hello world!"});
  });

  it('should allow other user to create thing', async () => {
    const userDB = await database.user(USERS[1].$.id);
    let item = await userDB.create('foo', 'thing', 'thing2', {message: "Goodbye world!"});
    expect(item.message).to.equal("Goodbye world!");
    item = await userDB.get('foo', 'thing', item.$.id);
    expect(item.message).to.deep.equal("Goodbye world!");
  });

  it('should allow creation of multi', async () => {
    const userDB = await database.user(USERS[1].$.id);
    let data = {
      title: 'foo',
      description: 'bar',
      things: [{
        message: 'hello',
      }]
    }
    await userDB.create('foo', 'multi', 'mymulti', data);
    let item = await userDB.get('foo', 'multi', 'mymulti');
    delete item.$;
    expect(item).to.deep.equal(data);
  })

  it('should not allow duplicate ID for invisible thing', async () => {
    const user0DB = await database.user(USERS[0].$.id);
    const user1DB = await database.user(USERS[1].$.id);
    const item1 = await user0DB.create('foo', 'thing', 'unique', {message: "hello"});
    await user0DB.modifyACL('foo', 'thing', 'unique', {disallow: {read: [USERS[1].$.id]}});

    const item1ForUser1 = await user1DB.get('foo', 'thing', 'unique');
    expect(item1ForUser1).to.equal(undefined);

    await expectError(user1DB.create('foo', 'thing', 'unique', {message: 'goodbye'}), /already exists/);
  })

  it('should not allow one user to access or alter another user\'s thing', async () => {
    const user0DB = await database.user(USERS[0].$.id);
    const user1DB = await database.user(USERS[1].$.id);
    await user0DB.create('foo', 'thing', 'thing2', {message: "Hello!"});
    await user0DB.modifyACL('foo', 'thing', 'thing2', {allow: {read: ['_owner']}});
    let thing = await user1DB.get('foo', 'thing', 'thing2');
    expect(thing).to.equal(undefined);
    await expectError(user1DB.update('foo', 'thing', 'thing2', {message: "This is a new string"}), /User .* cannot update foo\/thing\/thing2/);
    await expectError(user1DB.modifyACL('foo', 'thing', 'thing2', {allow: {read: ['_all']}}), /User .* cannot update ACL for foo\/thing\/thing2/);
    await expectError(user1DB.destroy('foo', 'thing', 'thing2'), /User .* cannot destroy foo\/thing\/thing2/);
  });

  it('should allow user to retrieve all things', async () => {
    const user0DB = await database.user(USERS[0].$.id);
    const user1DB = await database.user(USERS[1].$.id);
    await user0DB.create('foo', 'thing', {message: "Hello"});
    await user1DB.create('foo', 'thing', 'thing2', {message: "Goodbye"});
    await user1DB.modifyACL('foo', 'thing', 'thing2', {allow: {read: ['_all']}});
    let items = await user0DB.getAll('foo', 'thing');
    expect(items.length).to.equal(2);
    items.forEach(item => delete item.$);
    expect(items[0]).to.deep.equal({message: "Goodbye"});
    expect(items[1]).to.deep.equal({message: "Hello"});
  });

  it('should allow filtering and sorting', async () => {
    const user0DB = await database.user(USERS[0].$.id);
    const user1DB = await database.user(USERS[1].$.id);
    await user0DB.create('foo', 'thing', 'one', {message: "one"});
    await user0DB.create('foo', 'thing', 'two', {message: "two"});
    const midpoint = new Date().toISOString();
    await user0DB.create('foo', 'thing', 'three', {message: "three"});
    await user0DB.create('foo', 'thing', 'four', {message: "four"});

    let list = (await user0DB.list('foo', 'thing')).map(d => d.message);
    expect(list).to.deep.equal(['four', 'three', 'two', 'one']);

    list = (await user0DB.list('foo', 'thing', {}, {'info.created': 1})).map(d => d.message);
    expect(list).to.deep.equal(['one', 'two', 'three', 'four']);

    list = (await user0DB.list('foo', 'thing', {}, {data: 1})).map(d => d.message);
    expect(list).to.deep.equal(['four', 'one', 'three', 'two']);

    list = (await user0DB.list('foo', 'thing', {}, {data: -1})).map(d => d.message);
    expect(list).to.deep.equal(['two', 'three', 'one', 'four']);

    var {query} = await user0DB.buildListQuery('foo', 'thing', {created_before: midpoint})
    list = (await user0DB.list('foo', 'thing', query)).map(d => d.message);
    expect(list).to.deep.equal(['two', 'one']);

    var {query} = await user0DB.buildListQuery('foo', 'thing', {created_since: midpoint})
    list = (await user0DB.list('foo', 'thing', query)).map(d => d.message);
    expect(list).to.deep.equal(['four', 'three']);

    list = (await user0DB.list('foo', 'thing', {'data.message': 'four'})).map(d => d.message);
    expect(list).to.deep.equal(['four']);

    await user1DB.create('foo', 'thing', 'five', {message: "five"});
    let five = await user1DB.get('foo', 'thing', 'five');
    list = (await user0DB.list('foo', 'thing', {}, {'info.created': 1})).map(d => d.message);
    expect(list).to.deep.equal(['one', 'two', 'three', 'four', 'five']);

    list = (await user0DB.list('foo', 'thing', {'acl.owner': USERS[1].$.id})).map(d => d.message);
    expect(list).to.deep.equal(['five']);

    list = (await user0DB.list('foo', 'thing', {'acl.owner': USERS[0].$.id}, {'info.created': 1})).map(d => d.message);
    expect(list).to.deep.equal(['one', 'two', 'three', 'four']);

    const beforeModify = new Date().toISOString();
    var {query} = await user0DB.buildListQuery('foo', 'thing', {updated_since: beforeModify})
    await user0DB.update('foo', 'thing', 'two', {message: "TWO"});
    list = (await user0DB.list('foo', 'thing', query)).map(d => d.message);
    expect(list).to.deep.equal(['TWO']);

    list = (await user0DB.list('foo', 'thing')).map(d => d.$.info);

    var {query} = await user0DB.buildListQuery('foo', 'thing', {updated_before: beforeModify})
    list = (await user0DB.list('foo', 'thing', query, {'info.created': 1})).map(d => d.message);
    expect(list).to.deep.equal(['one', 'three', 'four', 'five']);
  });

  it('should allow user to destroy thing', async () => {
    const userDB = await database.user(USERS[0].$.id);
    await userDB.create('foo', 'thing', 'thing1', {message: "Hello"});
    let item = await userDB.get('foo', 'thing', 'thing1');
    expect(item.message).to.equal('Hello');
    await userDB.destroy('foo', 'thing', 'thing1');
    item = await userDB.get('foo', 'thing', 'thing1');
    expect(item).to.equal(undefined);
  });

  it('should allow append', async () => {
    const userDB = await database.user(USERS[0].$.id);
    await userDB.create('foo', 'inline_list', 'mylist', {things: [{message: 'foo'}]});
    let item = await userDB.get('foo', 'inline_list', 'mylist');
    expect(item.things).to.deep.equal([{message: 'foo'}]);
    await expectError(userDB.append('foo', 'inline_list', 'mylist', {things: [3]}), /should be object/);
    await expectError(userDB.append('foo', 'inline_list', 'mylist', {widgets: [{message: 'bar'}]}), /Schema not found for key widgets/);
    await userDB.append('foo', 'inline_list', 'mylist', {things: [{message: 'bar'}]});
    item = await userDB.get('foo', 'inline_list', 'mylist');
    expect(item.things.length).to.equal(2);
    expect(item.things).to.deep.equal([{message: 'foo'}, {message: 'bar'}]);
  });

  it('should not allow invalid ACL', async () => {
    const userDB = await database.user(USERS[0].$.id);
    await userDB.create('foo', 'thing', 'thing2', {message: "Hello"})
    await expectError(userDB.modifyACL('foo', 'thing', 'thing2', {allow: {read: {}}}), /ACL is invalid. allow.read should be array/);
  });

  it('should allow user to update ACL', async () => {
    const user0DB = await database.user(USERS[0].$.id);
    const user1DB = await database.user(USERS[1].$.id);
    await user0DB.create('foo', 'thing', 'thing2', {message: "Hello"})
    await user0DB.modifyACL('foo', 'thing', 'thing2', {allow: {read: ['_all'], write: ['_all']}});
    await user1DB.update('foo', 'thing', 'thing2', {message: "Goodbye"});
    let thing = await user0DB.get('foo', 'thing', 'thing2');
    expect(thing.message).to.equal("Goodbye");
  });

  it('should not allow other user to alter thing after updated ACL', async () => {
    const user0DB = await database.user(USERS[0].$.id);
    const user1DB = await database.user(USERS[1].$.id);
    await user0DB.create('foo', 'thing', 'thing2', {message: "Hello"})
    await user0DB.modifyACL('foo', 'thing', 'thing2', {allow: {read: ['_all']}});
    await expectError(user1DB.update('foo', 'thing', 'thing2', {message: "This is a new string"}), /User .* cannot update foo\/thing\/thing2/);
    await expectError(user1DB.modifyACL('foo', 'thing', 'thing2', {allow: {read: ['_all']}}), /User .* cannot update ACL for foo\/thing\/thing2/);
    await expectError(user1DB.destroy('foo', 'thing', 'thing2'), /User .* cannot destroy foo\/thing\/thing2/);
  });

  it('should allow blacklisting access to thing2', async () => {
    const user1DB = await database.user(USERS[1].$.id);
    await user1DB.create('foo', 'thing', 'thing2', {message: "Hello"});
    await user1DB.modifyACL('foo', 'thing', 'thing2', {
      allow: {read: ['_all']},
      disallow: {read: [USERS[2].$.id]}
    });
    let item = await user1DB.get('foo', 'thing', 'thing2');
    let acl = await user1DB.getACL('foo', 'thing', 'thing2');
    expect(acl.disallow).to.deep.equal({read: [USERS[2].$.id]});

    const user2DB = await database.user(USERS[2].$.id);
    item = await user2DB.get('foo', 'thing', 'thing2');
    expect(item).to.equal(undefined)

    const user0DB = await database.user(USERS[0].$.id);
    item = await user0DB.get('foo', 'thing', 'thing2');
    expect(item.message).to.equal('Hello');
  })

  it('should allow transfer of ownership', async () => {
    const userDB = await database.user(USERS[1].$.id);
    await userDB.create('foo', 'thing', 'thing2', {message: "Hello"});
    await userDB.modifyACL('foo', 'thing', 'thing2', {owner: USERS[0].$.id, allow: {read: ['_all']}});
    const itemACL = await userDB.getACL('foo', 'thing', 'thing2');
    expect(itemACL.owner).to.equal(USERS[0].$.id);
  });

  it('should not allow updates from original owner after owner transfer', async () => {
    const userDB = await database.user(USERS[1].$.id);
    await userDB.create('foo', 'thing', 'thing2', {message: "Hello"});
    await userDB.modifyACL('foo', 'thing', 'thing2', {owner: USERS[0].$.id});
    await expectError(userDB.update('foo', 'thing', 'thing2', {message: "This is a new string"}), /User .* cannot update foo\/thing\/thing2/);
    await expectError(userDB.modifyACL('foo', 'thing', 'thing2', {allow: {read: ['_all']}}), /User .* cannot update ACL for foo\/thing\/thing2/);
    await expectError(userDB.destroy('foo', 'thing', 'thing2'), /User .* cannot destroy foo\/thing\/thing2/);
  });

  it('should allow updates from new owner after owner transfer', async () => {
    const user1DB = await database.user(USERS[1].$.id);
    await user1DB.create('foo', 'thing', 'thing2', {message: "Hello"});
    await user1DB.modifyACL('foo', 'thing', 'thing2', {owner: USERS[0].$.id});
    const user0DB = await database.user(USERS[0].$.id);
    await user0DB.update('foo', 'thing', 'thing2', {message: "This is a new string"});
    const item = await user0DB.get('foo', 'thing', 'thing2');
    expect(item.message).to.equal("This is a new string");
  });

  it('should support token based auth', async () => {
    const token = randomstring.generate(64);
    await database.addToken('user1@example.com', token, {});

    const user = await database.signInWithToken(token)
    expect(user.id).to.equal(USERS[0].$.id);
    expect(user.permissions).to.deep.equal({});

    await expectError(database.signInWithToken('foob'), /The provided token is invalid/);
  });

  it('should respect permissions', async () => {
    let permissions = {};
    let userDB = await database.user(USERS[1].$.id, permissions)
    const schema = await userDB.get('core', 'schema', 'user');
    expect(schema.type).to.equal('object');
    await expectError(userDB.create('foo', 'thing', {message: 'hello'}), /This app does not have permission to create items in foo\/thing/);

    permissions = {foo: ['create']}
    userDB = await database.user(USERS[1].$.id, permissions);
    await userDB.create('foo', 'thing', 'mything', {message: 'hello'});
    let thing = await userDB.get('foo', 'thing', 'mything');
    expect(thing.message).to.equal('hello');

    await expectError(userDB.create('core', 'schema', {type: 'object'}), /This app does not have permission to create items in core\/schema/);
    await expectError(userDB.modifyACL('foo', 'thing', 'mything', {allow: {read: ['_owner']}}), /This app does not have permission to modify ACL for foo\/thing/)

    permissions = {foo: ['modify_acl']}
    userDB = await database.user(USERS[1].$.id, permissions);
    thing = await userDB.get('foo', 'thing', 'mything');
    expect(thing.message).to.equal('hello');
    await userDB.modifyACL('foo', 'thing', 'mything', {allow: {read: ['_owner']}});
    thing = await userDB.get('foo', 'thing', 'mything');
    expect(thing).to.equal(undefined);

    permissions = {foo: ['read']};
    userDB = await database.user(USERS[1].$.id, permissions);
    thing = await userDB.get('foo', 'thing', 'mything');
    expect(thing.message).to.equal('hello');
    await expectError(userDB.destroy('foo', 'thing', 'mything'), /This app does not have permission to destroy foo\/thing/);

    permissions = {foo: ['destroy', 'read']}
    userDB = await database.user(USERS[1].$.id, permissions);
    await userDB.destroy('foo', 'thing', 'mything');
    thing = await userDB.get('foo', 'thing', 'mything');
    expect(thing).to.equal(undefined);
  })

  it('should allow namespace with initial_acl', async () => {
    const userDB = await database.user(USERS[0].$.id);
    const ns = {versions: [{
      version: '0',
      types: {
        thing: {
          schema: {
            type: 'object',
            properties: {
              message: {type: 'string'},
            }
          },
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
    await userDB.create('core', 'namespace', 'foo2', ns);
    let created = await userDB.create('foo2', 'thing', {message: "Hi there"});
    expect(created.$.acl).to.deep.equal({
      owner: USERS[0].$.id,
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
    const userDB = await database.user(USERS[2].$.id);
    let thing1 = await userDB.create('foo', 'thing', {message: "test"});
    let user = await userDB.get('core', 'user', USERS[2].$.id);
    expect(user.items).to.equal(1);
    expect(user.namespaces).to.deep.equal(['foo']);

    let thing2 = await userDB.create('foo', 'thing', {message: "test"});
    user = await userDB.get('core', 'user', USERS[2].$.id);
    expect(user.items).to.equal(2);
    expect(user.namespaces).to.deep.equal(['foo']);

    await userDB.create('core', 'schema', {type: 'object'});
    user = await userDB.get('core', 'user', USERS[2].$.id);
    expect(user.items).to.equal(3);
    expect(user.namespaces).to.deep.equal(['foo', 'core']);

    await userDB.destroy('foo', 'thing', thing2.$.id)
    user = await userDB.get('core', 'user', USERS[2].$.id);
    expect(user.items).to.equal(2);
    expect(user.namespaces).to.deep.equal(['foo', 'core']);
  });

  it('should hit a limit for number of items per user', async () => {
    const userDB = await database.user(USERS[2].$.id);
    const oldMaxItems = userDB.config.maxItemsPerUser;
    userDB.config.maxItemsPerUser = 10;
    for (let i = 0; i < userDB.config.maxItemsPerUser; ++i) {
      await userDB.create('foo', 'thing', {message: 'foobar'});
    }
    await expectError(userDB.create('foo', 'thing', {message: 'foobar'}), /You have hit your maximum of 10 items. Please destroy something to create a new one/);
    userDB.config.maxItemsPerUser = oldMaxItems;
  });

  it('should respect the maximum number of bytes per item in append', async function() {
    this.timeout(10000);
    const userDB = await database.user(USERS[0].$.id);
    const oldMaxBytes = userDB.config.maxBytesPerItem;
    userDB.config.maxBytesPerItem = 1000;
    const list = await userDB.create('foo', 'list', {things: []});
    // each message is {"$ref":"/data/foo/list/12345678"}, = 36 bytes
    // top level is {"things":[...]} = 13 bytes
    // +1 for one item missing a comma
    const iterations = Math.floor((userDB.config.maxBytesPerItem - 12) / 36);
    for (let i = 0; i < iterations; ++i) {
      await userDB.append('foo', 'list', list.$.id, {things: [{message: 'a'}]});
    }
    await expectError(userDB.append('foo', 'list', list.$.id, {things: [{message: 'a'}]}), /would exceed the maximum of 1000 bytes/);
    userDB.config.maxBytesPerItem = oldMaxBytes;
  });

  it('should allow ref to external item', async () => {
    const userDB = await database.user(USERS[0].$.id);
    const data = {
      $ref: 'https://example.com/data/foo/thing/abc',
    };
    const item = await userDB.create('foo', 'thing', data);
    delete item.$;
    expect(item).to.deep.equal(data);
  });

  it('should disassemble data', async () => {
    const userDB = await database.user(USERS[0].$.id);
    const list = {
      things: [{
        message: 'hello',
      }]
    }

    const listID = (await userDB.create('foo', 'list', list)).$.id;
    let listBack = await userDB.get('foo', 'list', listID);
    expect(listBack.things[0].$ref).to.be.a('string');
    expect(Object.keys(listBack.things[0]).length).to.equal(1);
    let [dummy1, dummy2, namespace, type, message0ID] = listBack.things[0].$ref.split('/');
    expect(namespace).to.equal('foo');
    expect(type).to.equal('thing');
    const message0 = await userDB.get(namespace, type, message0ID);
    delete message0.$;
    expect(message0).to.deep.equal({message: 'hello'});

    await userDB.append('foo', 'list', listID, {things: [{message: 'goodbye'}]});
    listBack = await userDB.get('foo', 'list', listID);
    expect(listBack.things[1].$ref).to.be.a('string');
    expect(Object.keys(listBack.things[1]).length).to.equal(1);
    [dummy1, dummy2, namespace, type, message1ID] = listBack.things[1].$ref.split('/');
    expect(namespace).to.equal('foo');
    expect(type).to.equal('thing');
    const message1 = await userDB.get(namespace, type, message1ID);
    delete message1.$;
    expect(message1).to.deep.equal({message: 'goodbye'});

    const newList = {
      things: [{
        $: {id: message0ID},
        message: "hello",
      }, {
        $: {id: message1ID},
        message: "goodbye2",
      }]
    }
    await userDB.update('foo', 'list', listID, newList);
    const newListBack = await userDB.get('foo', 'list', listID);
    delete newListBack.$;
    expect(newListBack).to.deep.equal({
      things: [{
        $ref: '/data/foo/thing/' + message0ID,
      }, {
        $ref: '/data/foo/thing/' + message1ID,
      }]
    });
    const message1Updated = await userDB.get('foo', 'thing', message1ID);
    delete message1Updated.$;
    expect(message1Updated).to.deep.equal({message: 'goodbye2'})

    const newList2 = {
      things: [{
        message: 'hello2',
      }, {
        $: {id: message1ID},
        message: 'goodbye2',
      }]
    }
    await userDB.update('foo', 'list', listID, newList2);
    const newListBack2 = await userDB.get('foo', 'list', listID);
    expect(newListBack2.things[1].$ref).to.equal('/data/foo/thing/' + message1ID);
    expect(newListBack2.things[0].$ref).to.be.a('string');
    expect(newListBack2.things[0].$ref).to.not.equal('/data/foo/thing/' + message0ID);
  });

  it('should not disassemble $refs', async () => {
    const userDB = await database.user(USERS[0].$.id);
    const list = {
      things: [{
        message: 'hello',
      }]
    }

    const listID = (await userDB.create('foo', 'list', list)).$.id;
    let listBack = await userDB.get('foo', 'list', listID);
    expect(listBack.things[0].$ref).to.be.a('string');
    expect(Object.keys(listBack.things[0]).length).to.equal(1);

    delete listBack.$;
    await userDB.update('foo', 'list', listID, listBack);
    listBack = await userDB.get('foo', 'list', listID);
    expect(listBack.things[0].$ref).to.be.a('string');
    expect(Object.keys(listBack.things[0]).length).to.equal(1);
  });

  it('should support pagination', async () => {
    const userDB = await database.user(USERS[0].$.id);
    for (let i = 0; i < 20; ++i) {
      let thing = {message: i.toString()};
      await userDB.create('foo', 'thing', thing);
    }

    let page0 = await userDB.list('foo', 'thing', {}, {created: 1}, 2);
    expect(page0.length).to.equal(2);
    expect(page0[0].message).to.equal('0');
    expect(page0[1].message).to.equal('1');

    let page1 = await userDB.list('foo', 'thing', {}, {created: 1}, 2, 2);
    expect(page1.length).to.equal(2);
    expect(page1[0].message).to.equal('2');
    expect(page1[1].message).to.equal('3');

    let lastPage = await userDB.list('foo', 'thing', {}, {created: 1}, 2, 18);
    expect(lastPage.length).to.equal(2);
    expect(lastPage[0].message).to.equal('18');
    expect(lastPage[1].message).to.equal('19');

    let emptyPage = await userDB.list('foo', 'thing', {}, {created: 1}, 2, 100);
    expect(emptyPage.length).to.equal(0);
  })

  it('should not allow keys with special characters', async() => {
    const userDB = await database.user(USERS[0].$.id);

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
  });

  it('should not allow a vulnerable regex', async () => {
    const userDB = await database.user(USERS[0].$.id);
    const schema = {
      type: 'object',
      properties: {
        str: {
          type: 'string',
          pattern: '(\\w+)+',
        }
      }
    };
    await expectError(userDB.create('core', 'schema', schema), /Pattern .* is not allowed/)
  })
});

