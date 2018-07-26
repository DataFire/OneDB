import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {FreeDBService} from '../services/freedb.service';

declare let window:any;
declare let require:any;
const settings = require('../../../../../.server-config.json');

@Component({
    selector: 'home',
    templateUrl: './home.pug',
})
export class HomeComponent {
  host:string = settings.host || 'https://alpha.freedb.io';
  user:any;
  constructor(private freedb:FreeDBService) {}

  signIn() {
    this.freedb.initialize(this.host);
    this.freedb.client.authorize(user => {
      console.log(user);
      this.user = user;
    })
  }
}
