const expect = require('chai').expect;
const Client = require('../lib/client');
const Server = require('../../server').Server;
const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;

const PORT = 3333;
const HOST = 'http://localhost:' + PORT;

const mongod = new MongoMemoryServer();
let server = null;
const client = new Client(HOST);

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
      type: 'object',
      additionalProperties: false,
      properties: {
        publicKey: {type: 'string'},
      }
    })
  });
})
