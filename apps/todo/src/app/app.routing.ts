import { Routes, RouterModule } from '@angular/router';
import {HomeComponent} from './home/home.component';
import {ListComponent} from './list/list.component';

export const appRoutes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'new-list', component: ListComponent },
  { path: 'list/:list_id', component: ListComponent },
  { path: '**', redirectTo: '' },
];

