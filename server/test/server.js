const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
const expect = require('chai').expect;
const axios = require('axios');
const config = require('../lib/config');
const Server = require('../lib/server');
config.jwtSecret = 'thisisasecret';

const mongod = new MongoMemoryServer();

const PORT = 3333;
const HOST = 'http://localhost:' + PORT;
const MAX_BYTES = 10000;

const USER_1 = {
  username: 'me@example.com',
  password: 'thisisasecret',
}

describe("Server", () => {
  let oldMaxBytes = config.maxBytesPerItem;

  before(async () => {
    config.maxBytesPerItem = MAX_BYTES;
    const server = new Server({
      host: HOST,
      mongodb: await mongod.getConnectionString(),
      rateLimit: {
        all: {
          windowMs: 2000,
          max: 100,
          delayMs: 0,
        }
      }
    });
    return server.listen(PORT);
  });

  after(() => {
    config.maxBytesPerItem = oldMaxBytes;
  })

  it('should respond with info', async () => {
    let response = await axios.get(HOST + '/info');
    expect(response.status).to.equal(200);
    expect(response.data).to.deep.equal({version: '0.0.1'});
  });

  it('should respond to ping', async () => {
    let response = await axios.get(HOST + '/ping');
    expect(response.status).to.equal(200);
    expect(response.data).to.equal('pong');
  });

  it('should be rate limited', async function() {
    this.timeout(3000);
    const numRequests = 101;
    let response = null;
    for (let i = 0; i < numRequests; ++i) {
      response = await axios.get(HOST + '/ping', {validateStatus: () => true});
    }
    expect(response.status).to.equal(429);
    expect(response.data).to.deep.equal({message: 'Too many requests, please try again later.'});
    return new Promise((resolve) => setTimeout(resolve, 2000));
  });

  it('should allow GET without auth', async () => {
    const resp = await axios.get(HOST + '/data/core/schema/user');
    expect(resp.data.type).to.equal('object');
  });

  it('should GET for acl', async () => {
    const resp = await axios.get(HOST + '/data/core/schema/user/acl');
    expect(resp.data.owner).to.be.a('string');
  })

  it('should give 404 for missing item', async () => {
    const resp = await axios.get(HOST + '/data/core/schema/foo', {validateStatus: () => true});
    expect(resp.status).to.equal(404);
    expect(resp.data).to.deep.equal({message: 'Item core/schema/foo not found'});
  });

  it('should not allow POST without auth', async () => {
    const data = {type: 'string'};
    const resp = await axios.post(HOST + '/data/core/schema/foo', data, {validateStatus: () => true});
    expect(resp.status).to.equal(401);
    expect(resp.data).to.deep.equal({message: 'You need to log in to do that'});
  });

  it('should allow registration', async () => {
    const resp = await axios.post(HOST + '/users/register', {}, {auth: USER_1});
    expect(resp.data).to.be.a('string');
    USER_1.id = resp.data;
  });

  it('should show current user', async () => {
    let resp = await axios.get(HOST + '/users/me', {validateStatus: () => true});
    expect(resp.status).to.equal(401);

    resp = await axios.get(HOST + '/users/me', {auth: USER_1});
    expect(resp.status).to.equal(200);
    expect(resp.data).to.deep.equal({publicKey: "", id: USER_1.id});
  })

  it('should not allow directly adding user', async () => {
    let resp = await axios.post(HOST + '/data/core/user', {}, {auth: USER_1, validateStatus: () => true});
    expect(resp.status).to.equal(401);
    expect(resp.data.message).to.equal('That operation is restricted');
    resp = await axios.post(HOST + '/data/core/user_private', {}, {auth: USER_1, validateStatus: () => true});
    expect(resp.status).to.equal(401);
    expect(resp.data.message).to.equal('That operation is restricted');
  });

  it('should allow POST with auth', async () => {
    const data = {type: 'string'};
    let resp = await axios.post(HOST + '/data/core/schema/foo', data, {auth: USER_1, validateStatus: () => true});
    expect(resp.data).to.equal('foo');

    resp = await axios.get(HOST + '/data/core/schema/foo');
    expect(resp.data).to.deep.equal(Object.assign({_id: 'foo'}, data));
    resp = await axios.get(HOST + '/data/core/schema/foo/acl');
    expect(resp.data).to.deep.equal({
      owner: USER_1.id,
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
    const ns = {
      versions: [{
        version: '0',
        types: {
          foo: {
            schema: {$ref: '/data/core/schema/foo'},
          }
        }
      }]
    }
    resp = await axios.post(HOST + '/data/core/namespace/foo', ns, {auth: USER_1});
    expect(resp.status).to.equal(200);
  });

  it('should not allow DELETE of schema', async () => {
    let resp = await axios.delete(HOST + '/data/core/schema/foo', {auth: USER_1, validateStatus: () => true});
    expect(resp.status).to.equal(401);
    expect(resp.data).to.deep.equal({message: `User ${USER_1.id} cannot destroy core/schema/foo, or core/schema/foo does not exist`});
  });

  it('should have $refs set with host', async () => {
    let resp = await axios.get(HOST + '/data/core/namespace/core');
    let version = resp.data.versions[0];
    expect(version.types.user.schema.$ref).to.equal('http://localhost:3333/data/core/schema/user');
  });

  it('should allow authorization', async () => {
    let resp = await axios.post(HOST + '/users/authorize', {}, {auth: USER_1, validateStatus: () => true});
    expect(resp.data).to.be.a('string');
    let data = {type: 'string'};
    resp = await axios.post(HOST + '/data/core/schema/bar', data, {headers: {Authorization: 'Bearer ' + resp.data}});
    expect(resp.data).to.be.a('string');
  });

  it('should respect max bytes per item', async () => {
    let data = '';
    for (let i = 0; i < MAX_BYTES; ++i) data += 'z';
    const headers = {'Content-Type': 'application/json'};
    const resp = await axios.post(HOST + '/data/foo/foo', JSON.stringify(data), {headers, auth: USER_1, validateStatus: () => true});
    expect(resp.status).to.equal(413);
    expect(resp.data.message).to.equal('request entity too large');
  })
});
