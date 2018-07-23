import {Component} from '@angular/core';
import {Router} from '@angular/router';

@Component({
    selector: 'home',
    template: `
      <h1>Home <i class="fa fa-home"></i></h1>
      <readme></readme>
      `,
})
export class HomeComponent {
  constructor() {}
}
