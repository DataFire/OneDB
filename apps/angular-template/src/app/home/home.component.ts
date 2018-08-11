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
    this.freedb.onUser.subscribe(user => {
      console.log(user);
    });
  }
}
