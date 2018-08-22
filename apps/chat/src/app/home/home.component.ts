import {Component, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {FreeDBService} from '../services/freedb.service';

declare let window:any;
declare let require:any;

@Component({
    selector: 'home',
    templateUrl: './home.pug',
})
export class HomeComponent {
  @ViewChild('logInModal') logInModal;
  error:string;
  chatRoomName:string;
  constructor(public freedb:FreeDBService, private router:Router) {
    this.freedb.onLogin.subscribe(user => {
      console.log(user);
    });
  }

  async startChat() {
    this.error = null;
    let chatID = this.chatRoomName;
    try {
      const chat = {title: this.chatRoomName || ''};
      chatID = await this.freedb.client.create('alpha_chat', 'conversation', chat, this.chatRoomName);
    } catch (e) {
      this.error = e.message;
      return;
    }
    this.router.navigate(['/chat', chatID])
  }
}
