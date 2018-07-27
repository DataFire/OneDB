const expect = require('chai').expect;
const Client = require('../lib/client');
const Server = require('../../server').Server;
const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;

const PORT = 3333;
const HOST = 'http://localhost:' + PORT;

const mongod = new MongoMemoryServer();
let server = null;
const client = new Client(HOST);

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
    let resp = await client.request('get', '/ping');
    expect(resp).to.equal('pong');
  });

  it('should retrieve core types without login', async () => {
    let item = await client.get('core', 'schema', 'user');
    expect(item).to.deep.equal({
      _id: 'user',
      type: 'object',
      additionalProperties: false,
      properties: {
        _id: {type: 'string'},
        publicKey: {type: 'string'},
      }
    })
  });

  it('should not allow create without login', async () => {
    await expectError(client.create('core', 'schema', {type: 'string'}), /You need to log in to do that/);
  });

  it('should allow creating user', async () => {
    await client.createUser('user1@example.com', 'password');
  })

  it('should allow creating type after login', async () => {
    let schema = {
      type: 'object',
      properties: {
        _id: {type: 'string'},
        message: {type: 'string'},
      }
    }
    await client.create('core', 'schema', schema, 'message');
    let item = await client.get('core', 'schema', 'message');
    expect(item).to.deep.equal(Object.assign({_id: 'message'}, schema));
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
          }
        }
      }]
    }
    await client.create('core', 'namespace', ns, 'messages');
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
  })
})
