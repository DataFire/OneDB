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
  constructor(private freedb:FreeDBService) {
    this.freedb.onUser.subscribe(user => {
      if (user) this.loadTodoLists();
    });
  }

  async initialize() {
    if (this.freedb.user) this.loadTodoLists();
  }

  async loadTodoLists() {
    this.error = null;
    try {
      this.lists = await this.freedb.client.list('alpha_todo', 'list');
    } catch (e) {
      this.error = e.message;
    }
  }
}
