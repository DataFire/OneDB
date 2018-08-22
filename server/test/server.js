const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
const fs = require('fs');
const expect = require('chai').expect;
const axios = require('axios');
const config = require('../lib/config');
const Server = require('../lib/server');
const dbUtil = require('../lib/db-util');
config.jwtSecret = 'thisisasecret';


axios.interceptors.response.use(
    (response) => response,
	function (error) {
		return Promise.reject(error.response.data);
	});

const mongod = new MongoMemoryServer();

const PORT = 3333;
const HOST = 'http://localhost:' + PORT;
const MAX_BYTES = 10000;
const EMAIL_FILE = __dirname + '/email.txt';
const USER_1 = {
  username: 'me@example.com',
  password: 'thisisasecret',
}

let server = null;

describe("Server", () => {
  const oldMaxBytes = config.maxBytesPerItem;

  before(async () => {
    config.maxBytesPerItem = MAX_BYTES;
    config.email = {file: EMAIL_FILE};
    config.host = HOST;
    server = new Server({
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
    fs.unlinkSync(EMAIL_FILE);
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
    expect(response.data).to.deep.equal({message: "You're doing that too much. Please wait and try again later"});
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

  it('should GET for info', async () => {
    const resp = await axios.get(HOST + '/data/core/schema/user/info');
    expect(resp.data.created).to.be.a('string');
  });

  it('should list schemas', async () => {
    let resp = await axios.get(HOST + '/data/core/schema');
    expect(resp.data.total).to.equal(5);
    expect(resp.data.items.length).to.equal(5);

    resp = await axios.get(HOST + '/data/core/schema?pageSize=3');
    expect(resp.data.total).to.equal(5);
    expect(resp.data.items.length).to.equal(3);
    expect(resp.data.hasNext).to.equal(true);

    resp = await axios.get(HOST + '/data/core/schema?pageSize=3&skip=3');
    expect(resp.data.total).to.equal(5);
    expect(resp.data.items.length).to.equal(2);
    expect(resp.data.hasNext).to.equal(false);
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
    const username = 'foobar';
    const resp = await axios.post(HOST + '/users/register/' + username, {}, {auth: USER_1});
    expect(resp.data).to.be.a('string');
    expect(resp.data).to.equal(username);
    USER_1.id = resp.data;
  });

  it('should confirm email', async () => {
    const userQuery = {'data.email': USER_1.username}
    let user = await server.database.db.collection('core-user_private').findOne(userQuery);
    expect(user.data.email_confirmation.confirmed).to.not.equal(true);
    expect(user.data.email_confirmation.code).to.be.a('string');
    const email = fs.readFileSync(EMAIL_FILE, 'utf8');
    const link = email.match(/href="(http.*)"/)[1];
    let resp = await axios.get(link);
    user = await server.database.db.collection('core-user_private').findOne(userQuery);
    expect(user.data.email_confirmation.confirmed).to.equal(true);
    expect(user.data.email_confirmation.code).to.equal(null);
  });

  it('should allow password reset', async () => {
    let resp = await axios.post(HOST + '/users/start_reset_password?email=' + USER_1.username);
    const email = fs.readFileSync(EMAIL_FILE, 'utf8');
    const code = email.match(/code=(\w+)/)[1];

    const newPassword = 'thisisadifferentsecret';
    resp = await axios.post(HOST + '/users/reset_password', {code, newPassword});

    resp = await axios.get(HOST + '/users/me', {auth: USER_1, validateStatus: () => true});
    expect(resp.status).to.equal(401);

    USER_1.password = newPassword;
    resp = await axios.get(HOST + '/users/me', {auth: USER_1});
    expect(resp.status).to.equal(200);
    expect(resp.data._id).to.equal(USER_1.id);
  })

  it('should suggest usernames', async () => {
    let resp = await axios.get(HOST + '/users/register');
    expect(resp.data).to.be.a('string');
    expect(resp.data.length > 3).to.equal(true);

    const availableName = 'barbaz';
    resp = await axios.get(HOST + '/users/register/' + availableName);
    expect(resp.data).to.be.a('string');
    expect(resp.data).to.equal(availableName);

    resp = await axios.get(HOST + '/users/register/' + USER_1.id);
    expect(resp.data).to.be.a('string');
    expect(resp.data).to.not.equal(USER_1.id);
  })

  it('should show current user', async () => {
    let resp = await axios.get(HOST + '/users/me', {validateStatus: () => true});
    expect(resp.status).to.equal(401);

    resp = await axios.get(HOST + '/users/me', {auth: USER_1});
    expect(resp.status).to.equal(200);
    expect(resp.data).to.deep.equal({_id: USER_1.id});
  })

  it('should not allow directly adding user', async () => {
    let resp = await axios.post(HOST + '/data/core/user', {}, {auth: USER_1, validateStatus: () => true});
    expect(resp.status).to.equal(401);
    expect(resp.data.message).to.equal('That operation is restricted');
    resp = await axios.post(HOST + '/data/core/user_private', {}, {auth: USER_1, validateStatus: () => true});
    expect(resp.status).to.equal(401);
    expect(resp.data.message).to.equal('That operation is restricted');
  });

  it('should not allow directly adding token', async () => {
    const token = {
      token: 'abcd',
      permissions: {},
    }
    const resp = await axios.post(HOST + '/data/core/authorization_token', token, {auth: USER_1, validateStatus: () => true});
    expect(resp.status).to.equal(401);
    expect(resp.data.message).to.equal('That operation is restricted');
  })

  it('should allow POST with auth', async () => {
    const data = {type: 'object'};
    let resp = await axios.post(HOST + '/data/core/schema/foo', data, {auth: USER_1, validateStatus: () => true});
    expect(resp.data).to.equal('foo');

    resp = await axios.get(HOST + '/data/core/schema/foo');
    expect(resp.data).to.deep.equal(Object.assign({
      $cache: {},
      _id: 'foo',
      properties: {_id: {type: 'string'}}
    }, data));
    resp = await axios.get(HOST + '/data/core/schema/foo/acl');
    expect(resp.data).to.deep.equal({
      owner: USER_1.id,
      allow: dbUtil.READ_ONLY_ACL,
      modify: dbUtil.SYSTEM_ACL,
      disallow: {},
    });
    const ns = {
      versions: [{
        version: '0',
        types: {
          foo: {
            schema: {$ref: '/data/core/schema/foo'},
          },
          foo_set: {
            schema: {
              type: 'object',
              properties: {
                foos: {
                  type: 'array',
                  items: {$ref: '#/definitions/foo'},
                }
              }
            }
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
    expect(version.types.user.schema.$ref).to.equal('/data/core/schema/user');
  });

  it('should allow authorization', async () => {
    let resp = await axios.post(HOST + '/users/authorize?scope=core:create', {}, {auth: USER_1});
    expect(resp.data).to.be.a('string');
    let data = {type: 'object'};
    resp = await axios.post(HOST + '/data/core/schema/bar', data, {headers: {Authorization: 'Bearer ' + resp.data}});
    expect(resp.data).to.be.a('string');
    resp = await axios.post(HOST + '/data/core/schema/bar', data, {validateStatus: () => true, headers: {Authorization: 'Bearer foo'}});
    expect(resp.status).to.equal(401);
  });

  it('should respect max bytes per item', async () => {
    let data = {message: ''};
    for (let i = 0; i < MAX_BYTES; ++i) data.message += 'z';
    const headers = {'Content-Type': 'application/json'};
    const resp = await axios.post(HOST + '/data/foo/foo', JSON.stringify(data), {headers, auth: USER_1, validateStatus: () => true});
    expect(resp.status).to.equal(413);
    expect(resp.data.message).to.equal('request entity too large');
  });

  it('should pre-cache refs', async () => {
    const foo = {message: 'hi'};
    const set = {foos: [foo]};
    const headers = {'Content-Type': 'application/json'};
    let resp = await axios.post(HOST + '/data/foo/foo_set', JSON.stringify(set), {headers, auth: USER_1});
    expect(resp.data).to.be.a('string');

    resp = await axios.get(HOST + '/data/foo/foo_set/' + resp.data, {auth: USER_1});
    expect(resp.data.foos).to.be.an('array');
    expect(resp.data.foos.length).to.equal(1);
    expect(resp.data.foos[0].$ref).to.be.a('string');
    const fooID = resp.data.foos[0].$ref.replace(/.*\/(\w+)$/, '\$1');
    expect(resp.data.$cache).to.be.an('object');
    expect(resp.data.$cache.foo).to.be.an('object');
    expect(resp.data.$cache.foo.foo).to.be.an('object');
    expect(resp.data.$cache.foo.foo[fooID]).to.deep.equal(foo);
  })
});
