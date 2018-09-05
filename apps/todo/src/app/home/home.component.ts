import {Component, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {FreeDBService} from '../services/freedb.service';

declare let window:any;
declare let require:any;

@Component({
    selector: 'home',
    templateUrl: './home.pug',
})
export class HomeComponent {
  @ViewChild('logInModal') logInModal;
  lists:any[];
  error:string;
  constructor(public freedb:FreeDBService) {
    this.freedb.onLogin.subscribe(host => {
      if (host === this.freedb.client.hosts.primary) {
        if (host.user) {
          this.loadTodoLists();
        } else {
          this.lists = [];
        }
      }
    });
    this.initialize();
  }

  async initialize() {
    if (this.freedb.user) this.loadTodoLists();
  }

  async loadTodoLists() {
    this.error = null;
    try {
      this.lists = (await this.freedb.client.list('alpha_todo', 'list')).items;
    } catch (e) {
      this.error = e.message;
    }
  }
}
