import {Component, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {OneDBService} from '../services/onedb.service';

declare let window:any;
declare let require:any;

@Component({
    selector: 'rooms',
    templateUrl: './rooms.pug',
    styles: [`
      .btn-success {
        width: 100%;
      }
    `]
})
export class RoomsComponent {
  @ViewChild('logInModal') logInModal;
  listingChats:boolean;
  error:string;
  chatRoomName:string;

  userChats:any[];
  ownedChats:any[];
  publicChats:any[];

  constructor(public onedb:OneDBService, private router:Router) {
    this.onedb.onLogin.subscribe(instance => {
      if (instance === this.onedb.client.hosts.primary && instance.user) {
        this.listChats();
      }
    });
    if (this.onedb.client.hosts.primary.user) {
      this.listChats();
    }
  }

  async listChats() {
    if (this.listingChats) return setTimeout(this.listChats.bind(this), 100);
    this.listingChats = true;
    const userID = this.onedb.client.hosts.primary.user.$.id;
    this.publicChats = (await this.onedb.client.list('chat', 'conversation')).items;
    this.ownedChats = (await this.onedb.client.list('chat', 'conversation', {owner: userID})).items;
    let userMessages = await this.onedb.client.list('chat', 'message', {owner: userID});
    let chatIDs = [];
    for (let message of userMessages.items) {
      if (chatIDs.indexOf(message.conversationID) === -1) {
        chatIDs.push(message.conversationID);
      }
    }
    this.userChats = await Promise.all(chatIDs.map(id => this.onedb.client.get('chat', 'conversation', id)))
    this.listingChats = false;
  }

  async startChat() {
    this.error = null;
    let chatID = this.chatRoomName ? this.chatRoomName.replace(/\W+/g, '_') : undefined;
    try {
      const chat = {title: this.chatRoomName || ''};
      chatID = await this.onedb.client.create('chat', 'conversation', chatID, chat);
    } catch (e) {
      this.error = e.message;
      return;
    }
    this.router.navigate(['/chat', chatID])
  }
}
