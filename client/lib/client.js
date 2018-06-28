const cryptico = require('cryptico');
const axios = require('axios');
const packageInfo = require('../package.json');

const KEY_SIZE = 2048;

class Client {
  constructor(options={}) {
    this.host = options.host;
  }

  signIn(passphrase) {
    this.privateKey = cryptico.generateRSAKey(passphrase, KEY_SIZE);
    this.publicKey = cryptico.publicKeyString(this.privateKey);
    return this.publicKey;
  }

  signRequest(method, url, body) {
    if (!this.publicKey || !this.privateKey) throw new Error("You need to sign in first");
    let text = [Date.now(), method.toUpperCase(), url, JSON.stringify(body)].join(' ');
    return cryptico.encrypt(text, this.privateKey);
  }

  async request(method, path, query={}, body=null) {
    Object.keys(query).forEach((key, idx) => {
      path += idx === 0 ? '?' : '&';
      path += encodeURIComponent(key) + '=' + encodeURIComponent(query[key]);
    })
    let url = this.host + path;
    let signature = this.signRequest(method, url, body);
    let headers = {
      'User-Agent': 'FreeDB Client v' + packageInfo.version,
      'X-Signature': signature,
    }
    let response = await axios.request({method, url, headers, data: JSON.stringify(body)});
    if (response.status >= 300) {
      throw new Error("Status code " + response.status + ": " + response.data.error);
    }
    return response.data;
  }

  async createUser(passphrase) {
    let key = this.signIn(passphrase);
    return this.request('post', '/users', {}, {public_key: key});
  }
}

module.exports = Client;
