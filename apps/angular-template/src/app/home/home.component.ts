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
  error:string;
  constructor(public onedb:OneDBService) {
    this.onedb.onLogin.subscribe(user => {
      console.log(user);
    });
  }
}
