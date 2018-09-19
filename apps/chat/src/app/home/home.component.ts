import {Component} from '@angular/core';

const SMALL_SIDEBAR_WIDTH = 72;
const LARGE_SIDEBAR_WIDTH = 300;

@Component({
    selector: 'home',
    templateUrl: './home.pug',
    styles: [`
      .content {
        width: 100%;
        position: absolute;
        top: 56px;
        bottom: 0px;
      }
      .sidebar, .main-content {
        padding: 15px;
      }
      .sidebar {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        border-right: 1px solid #32334a;
      }
      .main-content {
        min-width: 300px;
      }
    `]
})
export class HomeComponent {
  public collapsed:boolean;
  public sidebarWidth:number;

  constructor() {
    if (typeof window !== 'undefined' && window.innerWidth < 600) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  collapse() {
    this.collapsed = true;
    this.sidebarWidth = SMALL_SIDEBAR_WIDTH;
  }

  expand() {
    this.collapsed = false;
    this.sidebarWidth = LARGE_SIDEBAR_WIDTH;
  }
}
