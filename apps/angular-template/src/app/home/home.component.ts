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
  error:string;
  constructor(public freedb:FreeDBService) {
    this.freedb.onLogin.subscribe(user => {
      console.log(user);
    });
  }
}
