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
  constructor(public onedb:OneDBService) {}
}
