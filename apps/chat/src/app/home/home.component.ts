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
  listingChats:boolean;
  error:string;
  chatRoomName:string;

  userChats:any[];
  publicChats:any[];

  constructor(public freedb:FreeDBService, private router:Router) {
    this.freedb.onLogin.subscribe(user => {
      this.listChats();
    });
    this.listChats();
  }

  async listChats() {
    if (this.listingChats) return setTimeout(this.listChats.bind(this), 100);
    this.listingChats = true;
    this.publicChats = (await this.freedb.client.list('alpha_chat', 'conversation')).items;
    let userMessages = await this.freedb.client.list('alpha_chat', 'message');
    let chatIDs = [];
    for (let message of userMessages.items) {
      if (chatIDs.indexOf(message.conversationID) === -1) {
        chatIDs.push(message.conversationID);
      }
    }
    this.userChats = [];
    for (let chatID of chatIDs) {
      this.userChats.push(await this.freedb.client.get('alpha_chat', 'conversation', chatID));
    }
    this.listingChats = false;
  }

  async startChat() {
    this.error = null;
    let chatID = this.chatRoomName.replace(/\W+/g, '_');
    try {
      const chat = {title: this.chatRoomName || ''};
      chatID = await this.freedb.client.create('alpha_chat', 'conversation', chat, chatID);
    } catch (e) {
      this.error = e.message;
      return;
    }
    this.router.navigate(['/chat', chatID])
  }
}
