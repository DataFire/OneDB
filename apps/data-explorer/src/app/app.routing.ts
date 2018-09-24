import { Routes, RouterModule } from '@angular/router';
import {HomeComponent} from './home/home.component';
import {NamespaceComponent} from './namespace/namespace.component'
import {ItemComponent} from './item/item.component'

export const appRoutes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'data/:namespace', component: NamespaceComponent },
  { path: 'data/:namespace/:type/:item_id', component: ItemComponent },
  { path: '**', redirectTo: '' },
];

