const expect = require('chai').expect;
const Client = require('../lib/client');
const Server = require('../../server').Server;
const config = require('../../server/lib/config');
config.email = {file: '/dev/null'}
const MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;

const INSTANCES = {
  core: {
    port: 3333,
  },
  alice: {
    port: 3334,
  },
  bob: {
    port: 3335,
  },
  public: {
    port: 3336,
  }
}

function getClient(aliceOrBob) {
  const other = aliceOrBob === 'alice' ? 'bob' : 'alice';
  const primaryInstance = INSTANCES[aliceOrBob];
  const otherInstance = INSTANCES[other];
  return new Client({
    hosts: {
      core: {
        location: INSTANCES.core.host,
      },
      primary: {
        location: primaryInstance.host,
        username: primaryInstance.users[aliceOrBob].email,
        password: primaryInstance.users[aliceOrBob].password,
      },
      secondary: [{
        location: otherInstance.host,
        username: otherInstance.users[aliceOrBob].email,
        password: otherInstance.users[aliceOrBob].password,
      }],
      broadcast: [{
        location: INSTANCES.public.host,
        username: INSTANCES.public.users[aliceOrBob].email,
        password: INSTANCES.public.users[aliceOrBob].password,
      }],
    }
  });
}

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

describe("OneDB Client with Multiple Instances", () => {
  beforeEach(async function () {
    this.timeout(100000);
    for (let key in INSTANCES) {
      const instance = INSTANCES[key];
      instance.host = 'http://localhost:' + instance.port;
      instance.mongod = new MongoMemoryServer();
      instance.server = new Server({
        mongodb: await instance.mongod.getConnectionString(),
        host: instance.host,
        namespaces: {
          proxy: {
            core: key === 'core' ? '' : INSTANCES.core.host,
          }
        },
        rateLimit: {
          createUser: {
            windowMs: 1000,
            max: 1500,
            delayMs: 3 * 1000,
            delayAfter: 10,
          },
        }
      });
      await instance.server.listen(instance.port);
      instance.users = {
        alice: {
          password: 'abcdefgh',
        },
        bob: {
          password: 'foobar1234',
        },
      };
      const client = new Client({hosts: {primary: {location: instance.host}}});
      for (let name in instance.users) {
        const user = instance.users[name];
        user.email = `${name}@${name}.com`
        user.username = await client.createUser(client.hosts.primary, user.email, user.password);
      }
      if (key === 'core') {
        client.hosts.primary.username = instance.users.bob.email;
        client.hosts.primary.password = instance.users.bob.password;
        const ns = {
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
        await client.create('core', 'namespace', 'chat', ns);
      }
    }
  })

  afterEach(async () => {
    for (let key in INSTANCES) {
      const instance = INSTANCES[key];
      await instance.mongod.stop();
      await instance.server.close();
    }
  })

  it('should work', async () => {
    const client = getClient('bob');
    let resp = await client.request(client.hosts.core, 'get', '/ping');
    expect(resp).to.equal('pong');

    resp = await client.get('core', 'namespace', 'chat');
    expect(resp.versions.length).to.equal(1);
  });

  it('should allow secure chat', async function() {
    this.timeout(10000);
    const aliceClient = getClient('alice');
    const bobClient = getClient('bob');

    let messageID = await aliceClient.create('chat', 'message', {message: 'Hi Bob!'});
    await aliceClient.updateACL('chat', 'message', messageID, {allow: {read: ['_owner', INSTANCES.alice.users.bob.username]}});
    await aliceClient.updateACL('chat', 'message', messageID, {allow: {read: ['_all']}}, aliceClient.hosts.broadcast[0]);

    let message = await aliceClient.request(aliceClient.hosts.primary, 'get', '/data/chat/message/' + messageID);
    expect(message.message).to.equal('Hi Bob!');
    let refMessageList = await aliceClient.request(aliceClient.hosts.broadcast[0], 'get', '/data/chat/message', {owner: INSTANCES.public.users.alice.username})
    expect(refMessageList.items.length).to.equal(1);
    let refMessage = refMessageList.items[0];
    expect(refMessage.$ref).to.be.a('string');
    expect(refMessage.$ref.startsWith(INSTANCES.alice.host)).to.equal(true);

    let resolvedMessage = await aliceClient.get('chat', 'message', refMessage.$.id, aliceClient.hosts.broadcast[0]);
    expect(resolvedMessage.message).to.equal('Hi Bob!');

    let bobMessages = await bobClient.list('chat', 'message', {}, bobClient.hosts.broadcast[0]);
    expect(bobMessages.items.length).to.equal(1);
    expect(bobMessages.items[0].message).to.equal('Hi Bob!');
  });
});
