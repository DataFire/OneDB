import {ViewChild, Component} from '@angular/core';
import {Router} from '@angular/router';
import {FreeDBService} from '../services/freedb.service';

@Component({
    selector: 'navbar',
    templateUrl: './navbar.pug',
})
export class NavbarComponent {
  @ViewChild('logInModal') logInModal;
  constructor(public router: Router, public freedb:FreeDBService) {}
}
