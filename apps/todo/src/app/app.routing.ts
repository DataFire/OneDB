import { Routes, RouterModule } from '@angular/router';
import {HomeComponent} from './home/home.component';
import {ListComponent} from './list/list.component';

export const appRoutes: Routes = [
  { path: 'home', component: HomeComponent },
  { path: 'new-list', component: ListComponent },
  { path: '**', redirectTo: 'home' },
];

