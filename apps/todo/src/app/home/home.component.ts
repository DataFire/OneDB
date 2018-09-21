import {Component, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {OneDBService} from '../services/onedb.service';

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
  constructor(public onedb:OneDBService) {
    this.onedb.onLogin.subscribe(host => {
      if (host === this.onedb.client.hosts.primary) {
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
    if (this.onedb.user) this.loadTodoLists();
  }

  async loadTodoLists() {
    this.error = null;
    try {
      this.lists = (await this.onedb.client.list('alpha_todo', 'list')).items;
    } catch (e) {
      this.error = e.message;
    }
  }
}
