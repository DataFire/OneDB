import {ViewChild, Component} from '@angular/core';
import {Router} from '@angular/router';
import {OneDBService} from '../services/onedb.service';

@Component({
    selector: 'navbar',
    templateUrl: './navbar.pug',
})
export class NavbarComponent {
  @ViewChild('logInModal') logInModal;
  constructor(public router: Router, public onedb:OneDBService) {}
}
