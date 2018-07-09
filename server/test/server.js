const expect = require('chai').expect;
const axios = require('axios');
const Server = require('../lib/server');

const server = new Server({
  rateLimit: {
    all: {
      windowMs: 2000,
      max: 10,
      delayMs: 0,
    }
  }
});

const PORT = 3333;
const HOST = 'http://localhost:' + PORT;

describe("Server", () => {
  before(() => {
    return server.listen(PORT);
  });

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

  it('should be rate limited', async () => {
    const numRequests = 11;
    let response = null;
    for (let i = 0; i < numRequests; ++i) {
      response = await axios.get(HOST + '/ping', {validateStatus: () => true});
    }
    expect(response.status).to.equal(429);
    expect(response.data).to.deep.equal({message: 'Too many requests, please try again later.'});
  });
})
