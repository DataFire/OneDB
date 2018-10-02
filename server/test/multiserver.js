const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
const fs = require('fs');
const expect = require('chai').expect;
const axios = require('axios');
const Server = require('../lib/server');
const dbUtil = require('../lib/db-util');

axios.interceptors.response.use(
    (response) => response,
	function (error) {
		return Promise.reject(error.response ? error.response.data : error);
	});

const USER_1 = {
  username: 'me@example.com',
  password: 'thisisasecret',
  id: 'foobar',
}

const SERVERS = {
  core: {
    port: 3333,
    config: {
      host: 'http://localhost:3333',
      email: {
        file: __dirname + '/email1.txt',
      },
      namespaces: {
        allow: ['core', 'system'],
      }
    },
  },
  alt: {
    port: 3334,
    config: {
      host: 'http://localhost:3334',
      email: {
        file: __dirname + '/email2.txt',
      },
      namespaces: {
        proxy: {
          core: 'http://localhost:3333',
        },
        disallow: ['bar'],
      }
    }
  }
}

describe("Multiple Servers", () => {
  beforeEach(async function() {
    this.timeout(5000);
    for (let key in SERVERS) {
      const server = SERVERS[key];
      server.mongod = new MongoMemoryServer();
      server.config.mongodb = await server.mongod.getConnectionString();
      server.server = new Server(server.config);
      await server.server.listen(server.port)
      const url = server.config.host + '/users/register/' + USER_1.id;
      const resp = await axios.post(url, {}, {auth: USER_1});
    }
    const fooNS = {
      versions: [{
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
    const barNS = {
      versions: [fooNS.versions[0]]
    }
    await axios.post(SERVERS.core.config.host + '/data/core/namespace/foo', fooNS, {auth: USER_1});
    await axios.post(SERVERS.core.config.host + '/data/core/namespace/bar', barNS, {auth: USER_1});
  });

  afterEach(() => {
    for (let key in SERVERS) {
      let server = SERVERS[key];
      server.mongod.stop();
      server.server.close();
      if (fs.existsSync(server.config.email.file)) {
        fs.unlinkSync(server.config.email.file);
      }
    }
  })

  it('should respond with info', async () => {
    let response = await axios.get(SERVERS.core.config.host + '/info');
    expect(response.status).to.equal(200);
    expect(response.data.version).to.be.a('string')

    response = await axios.get(SERVERS.alt.config.host + '/info');
    expect(response.status).to.equal(200);
    expect(response.data.version).to.be.a('string')
  });

  it('should proxy from alt to core', async () => {
    let response = await axios.get(SERVERS.core.config.host + '/data/core/namespace/foo');
    expect(response.status).to.equal(200);
    expect(response.data.versions.length).to.equal(1);

    const message = {message: 'hi'}
    response = await axios.post(SERVERS.alt.config.host + '/data/foo/message/hi', message, {auth: USER_1});
    expect(response.status).to.equal(200);

    const messageBack = await axios.get(SERVERS.alt.config.host + '/data/foo/message/hi', {auth: USER_1});
    delete messageBack.data.$;
    expect(messageBack.data).to.deep.equal({message: 'hi'});
  })

  it('should respect namespace whitelist', async () => {
    const message = {message: 'hi'};
    const opts = {auth: USER_1, validateStatus: () => true};
    response = await axios.post(SERVERS.core.config.host + '/data/foo/message/hi', message, opts);
    expect(response.status).to.equal(501);
  });

  it('should respect namespace blacklist', async () => {
    const message = {message: 'hi'};
    const opts = {auth: USER_1, validateStatus: () => true};
    response = await axios.post(SERVERS.alt.config.host + '/data/bar/message/hi', message, opts);
    expect(response.status).to.equal(501);
  })
});
