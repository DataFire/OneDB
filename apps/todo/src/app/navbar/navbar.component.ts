import {Component} from '@angular/core';
import {Router} from '@angular/router';

@Component({
    selector: 'navbar',
    templateUrl: './navbar.pug',
})
export class NavbarComponent {
  constructor(public router: Router) {}
}
