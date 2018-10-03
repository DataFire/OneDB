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
    `]
})
export class HomeComponent {
  @ViewChild('logInModal') logInModal;
  error:string;
  usage:any;
  constructor(public onedb:OneDBService) {
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
  }
}
