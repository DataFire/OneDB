import { NgModule }      from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import {APP_BASE_HREF} from '@angular/common';

import {NgbModule} from '@ng-bootstrap/ng-bootstrap';

import { appRoutes } from './app.routing';
import { AppComponent }       from './app.component';
import { HomeComponent }       from './home/home.component';
import { NavbarComponent }       from './navbar/navbar.component';
import {ListComponent} from './list/list.component'
import {LogInModalComponent} from './log-in-modal/log-in-modal.component'

import {PlatformService} from './services/platform.service';
import {FreeDBService} from './services/freedb.service'

import { environment } from '../environments/environment';
import { AutofocusDirective } from './autofocus.directive';

@NgModule({
  imports: [
    BrowserModule.withServerTransition({appId: 'my-app'}),
    RouterModule.forRoot(appRoutes),
    HttpModule,
    FormsModule,
    NgbModule.forRoot(),
  ],
  providers: [
    {provide: APP_BASE_HREF, useValue: environment.baseHref || '/'},
    PlatformService,
    FreeDBService,
  ],
  declarations: [
    AppComponent,
    HomeComponent,
    NavbarComponent,
    ListComponent,
    LogInModalComponent,
    AutofocusDirective,
  ],
  bootstrap: [ AppComponent ],
})
export class AppModule { }
