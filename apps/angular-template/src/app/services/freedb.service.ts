import {Injectable} from '@angular/core';
const Client = require('../../../../../client');
declare let require:any;

const STORAGE_KEY = 'freedb_auth';

@Injectable()
export class FreeDBService {
  client:any;
  user:any;
  constructor() {}

  async initialize(options) {
    this.client = new Client(options);
  }

  async maybeRestore() {
    if (!window.localStorage) return;
    let existing = window.localStorage.getItem(STORAGE_KEY);
    if (!existing) return;
    existing = JSON.parse(existing);
    await this.initialize(existing);
    this.user = await this.client.getUser();
  }

  async signIn(host) {
    await this.initialize(host);
    return new Promise((resolve, reject) => {
      this.client.authorize(user => {
        this.user = user;
        if (window.localStorage) {
          const toStore = {host, token: this.client.options.token};
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
        }
        resolve();
      })
    });
  }
}
