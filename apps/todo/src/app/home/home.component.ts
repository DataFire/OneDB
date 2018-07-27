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
  lists:any[];
  constructor(private freedb:FreeDBService) {
    this.initialize();
  }

  async initialize() {
    await this.freedb.maybeRestore();
    if (this.freedb.user) this.loadTodoLists();
  }

  async signIn() {
    await this.freedb.signIn(this.host);
    this.loadTodoLists();
  }

  async loadTodoLists() {
    this.lists = await this.freedb.client.list('alpha_todo', 'list');
  }
}
