const expect = require('chai').expect;
const Client = require('../lib/client');
const Server = require('../../server').Server;
const config = require('../../server/lib/config');
config.email = {file: '/dev/null'}
const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;

const PORT = 3333;
const HOST = 'http://localhost:' + PORT;

const mongod = new MongoMemoryServer();
let server = null;
const client = new Client({
  hosts: {
    core: {location: HOST},
    primary: {location: HOST},
  }
});

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

describe("FreeDB Client", () => {
  before(async () => {
    const mongoURI = await mongod.getConnectionString();
    server = new Server({mongodb: mongoURI, host: HOST});
    return server.listen(PORT);
  });

  it('should work', async () => {
    let resp = await client.request(client.hosts.core, 'get', '/ping');
    expect(resp).to.equal('pong');
  });

  it('should retrieve core types without login', async () => {
    let item = await client.get('core', 'schema', 'user');
    expect(item.$.id).to.equal('user');
    delete item.$;
    expect(item).to.deep.equal({
      type: 'object',
      additionalProperties: false,
      properties: {
        $: {type: 'object'},
        publicKey: {type: 'string'},
      }
    })
  });

  it('should not allow create without login', async () => {
    await expectError(client.create('core', 'schema', {type: 'string'}), /You need to log in to do that/);
  });

  it('should allow creating user', async () => {
    await client.createUser(client.hosts.primary, 'user1@example.com', 'password');
    let token = await client.request(client.hosts.primary, 'post', '/users/authorize')
    client.hosts.primary.token = token;
  })

  it('should allow creating type after login', async () => {
    let schema = {
      type: 'object',
      properties: {
        message: {type: 'string'},
      }
    }
    await client.create('core', 'schema', 'message', schema);
    let item = await client.get('core', 'schema', 'message');
    expect(item.$.id).to.equal('message');
    delete item.$;
    schema.properties.$ = {type: 'object'};
    schema.additionalProperties = false;
    expect(item).to.deep.equal(schema);
  });

  it('should allow creating namespace', async () => {
    const ns = {
      versions: [{
        version: '0',
        types: {
          message: {
            schema: {
              type: 'object',
              properties: {
                message: {type: 'string'},
              }
            }
          },
          conversation: {
            schema: {
              type: 'object',
              properties: {
                messages: {
                  type: 'array',
                  items: {$ref: '#/definitions/message'},
                }
              }
            }
          }
        }
      }]
    }
    await client.create('core', 'namespace', 'messages', ns);
  });

  it('should allow creating message', async () => {
    let id = await client.create('messages', 'message', {message: "Hello world!"});
    expect(id).to.be.a('string');
    let msg = await client.get('messages', 'message', id);
    expect(msg.message).to.equal("Hello world!");
  });

  it('should allow updating message', async () => {
    let id = await client.create('messages', 'message', {message: "Hello world"});
    expect(id).to.be.a('string');
    let msg = await client.get('messages', 'message', id);
    expect(msg.message).to.equal("Hello world");
    await client.update('messages', 'message', id, {message: "Hi world"});
    msg = await client.get('messages', 'message', id);
    expect(msg.message).to.equal("Hi world");
  });

  it('should allow destroying message', async () => {
    let id = await client.create('messages', 'message', {message: "Hello world"});
    expect(id).to.be.a('string');
    let msg = await client.get('messages', 'message', id);
    expect(msg.message).to.equal("Hello world");
    await client.destroy('messages', 'message', id);
    await expectError(client.get('messages', 'message', id), /Item messages\/message\/.* not found/);
  });

  it('should resolve refs', async () => {
    const message = {message: 'hello world'};
    const messageID = await client.create('messages', 'message', message);
    const conversation = {messages: [{$ref: '/data/messages/message/' + messageID}]};
    const convoID = await client.create('messages', 'conversation', conversation);
    const conversationBack = await client.get('messages', 'conversation', convoID);
    expect(conversationBack.$.id).to.equal(convoID);
    delete conversationBack.$;
    delete conversationBack.messages[0].$;
    expect(conversationBack).to.deep.equal({messages: [message]});
  })

  it('should allow pagination', async function() {
    this.timeout(5000);
    let timeStart = new Date().toISOString();
    for (let i = 0; i < 10; ++i) {
      await client.create('messages', 'message', {message: i.toString()});
    }
    let params = {pageSize: 4, skip: 0, sort: 'info.created:ascending', created_since: timeStart};
    let page = await client.list('messages', 'message', params);
    expect(page.items.length).to.equal(4);
    expect(page.total).to.equal(10);
    expect(page.items[0].message).to.equal('0');
    expect(page.items[1].message).to.equal('1');
    expect(page.items[2].message).to.equal('2');
    expect(page.items[3].message).to.equal('3');
    expect(page.hasNext).to.equal(true);

    params.skip += params.pageSize;
    page = await client.list('messages', 'message', params);
    expect(page.items.length).to.equal(4);
    expect(page.total).to.equal(10);
    expect(page.items[0].message).to.equal('4');
    expect(page.items[1].message).to.equal('5');
    expect(page.items[2].message).to.equal('6');
    expect(page.items[3].message).to.equal('7');
    expect(page.hasNext).to.equal(true);

    params.skip += params.pageSize;
    page = await client.list('messages', 'message', params);
    expect(page.items.length).to.equal(2);
    expect(page.total).to.equal(10);
    expect(page.items[0].message).to.equal('8');
    expect(page.items[1].message).to.equal('9');
    expect(page.hasNext).to.equal(false);
  })
})
