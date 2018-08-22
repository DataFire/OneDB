import { Routes, RouterModule } from '@angular/router';
import {HomeComponent} from './home/home.component';
import {ChatComponent} from './chat/chat.component';

export const appRoutes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'chat/:chat_id', component: ChatComponent },
  { path: '**', redirectTo: '' },
];

