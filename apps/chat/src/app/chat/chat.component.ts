import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {FreeDBService} from '../services/freedb.service';

const RELOAD_INTERVAL = 2000;

declare const require:any;
const marked = require('marked');

@Component({
    selector: 'chat',
    templateUrl: './chat.pug',
})
export class ChatComponent {
  public marked = marked;

  public error:string;
  public chatID:string;
  public chat:any;
  public acl:any;
  public messages:any[] = [];
  public message:string;

  private interval:any;

  constructor(private route:ActivatedRoute, private freedb:FreeDBService) {
    this.route.params.subscribe(params => {
      if (params['chat_id']) {
        this.load(params['chat_id'])
      }
    })
  }

  async load(id) {
    this.chatID = id;
    this.error = null;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    try {
      this.chat = await this.freedb.client.get('alpha_chat', 'conversation', id);
      this.acl = await this.freedb.client.getACL('alpha_chat', 'conversation', id);
      this.loadMessages();
    } catch (e) {
      this.error = e.message;
      return;
    }
    this.interval = setInterval(() => this.loadMessages(), RELOAD_INTERVAL);
  }

  async loadMessages() {
    const query = {'data.conversationID': this.chatID};
    let newMessages = (await this.freedb.client.list('alpha_chat', 'message', query)).items;
    let lastMessage = this.messages[this.messages.length - 1];
    if (!lastMessage || (newMessages.length && lastMessage._id !== newMessages[0]._id)) {
      this.messages = newMessages.reverse();
    }
  }

  onKey(evt) {
    if (evt.keyCode == 13 && !evt.shiftKey) {
      evt.preventDefault();
      this.sendMessage();
      return false;
    }
  }

  async sendMessage() {
    this.error = null;
    try {
      const message = {message: this.message, conversationID: this.chatID};
      await this.freedb.client.create('alpha_chat', 'message', message);
      await this.loadMessages();
    } catch (e) {
      this.error = e.message;
      return;
    }
    this.message = null;
  }
}
