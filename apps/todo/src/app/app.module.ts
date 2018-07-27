import { NgModule }      from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import {APP_BASE_HREF} from '@angular/common';

import { appRoutes } from './app.routing';
import { AppComponent }       from './app.component';
import { HomeComponent }       from './home/home.component';
import { NavbarComponent }       from './navbar/navbar.component';
import {ListComponent} from './list/list.component'

import {PlatformService} from './services/platform.service';
import {FreeDBService} from './services/freedb.service'

import { environment } from '../environments/environment';

@NgModule({
  imports: [
    BrowserModule.withServerTransition({appId: 'my-app'}),
    RouterModule.forRoot(appRoutes),
    HttpModule,
    FormsModule,
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
  ],
  bootstrap: [ AppComponent ],
})
export class AppModule { }
