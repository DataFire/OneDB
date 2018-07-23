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
import {ReadmeComponent} from './readme/readme.component'

import {PlatformService} from './services/platform.service';

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
  ],
  declarations: [
    AppComponent,
    HomeComponent,
    NavbarComponent,
    ReadmeComponent,
  ],
  bootstrap: [ AppComponent ],
})
export class AppModule { }
