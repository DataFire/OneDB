import {Component, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {OneDBService} from '../services/onedb.service';

declare let window:any;
declare let require:any;

@Component({
    selector: 'home',
    templateUrl: './home.pug',
    styles: [`
      ul {
        padding-left: 0px;
        list-style: none;
      }
      .col {
        min-width: 250px;
      }
    `]
})
export class HomeComponent {
  @ViewChild('logInModal') logInModal;
  error:string;
  usage:any;
  allNamespaces:any[];

  constructor(public onedb:OneDBService) {
    this.loadNamespaces();
    onedb.onLogin.subscribe(instance => {
      this.loadUsage();
    })
  }

  async loadUsage() {
    if (!this.onedb.client.hosts.primary.user) {
      this.usage = null;
      return;
    }
    this.usage = await this.onedb.client.get('system', 'usage', this.onedb.client.hosts.primary.user.$.id);

    // TODO: remove this block - just for a few legacy users
    if (!this.usage && this.onedb.client.hosts.primary.user.namespaces) {
      this.usage = this.onedb.client.hosts.primary.user;
    }
  }

  async loadNamespaces() {
    this.allNamespaces = (await this.onedb.client.list('core', 'namespace')).items;
  }
}
