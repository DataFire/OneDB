import {Injectable, NgZone} from '@angular/core';
import {BehaviorSubject} from 'rxjs';

declare let window:any;
declare let require:any;
const Client = require('onedb-client').Client;
const CORE_HOST = 'https://one-db.datafire.io';

const STORAGE_KEY = 'onedb_auth';

@Injectable()
export class OneDBService {
  client:any;

  onLogin = new BehaviorSubject(null);

  constructor(private zone:NgZone) {
    window.onedbService = this;
    this.client = new Client({
      hosts: {
        core: {
          location: CORE_HOST,
        }
      },
      onLogin: instance => {
        this.zone.run(_ => this.onLogin.next(instance));
      },
    });
    this.maybeRestore();
    this.onLogin.subscribe(instance => {
      if (!window.localStorage) return
      const toStore = {
        hosts: this.client.hosts,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
    })
  }

  async maybeRestore() {
    if (!window.localStorage) return;
    let existing:any = window.localStorage.getItem(STORAGE_KEY);
    if (!existing) return;
    existing = JSON.parse(existing);
    if (!existing || !existing.hosts) return;
    await this.client.setHosts(existing.hosts);
  }
}
