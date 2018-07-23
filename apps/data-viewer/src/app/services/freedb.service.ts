import {Injectable} from '@angular/core';
const Client = require('../../../../../client');

@Injectable()
export class FreeDBService {
  client:any;
  constructor() {}

  async initialize(host) {
    this.client = new Client({host});
  }
}
