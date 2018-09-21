import {Component, ViewChild} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {OneDBService} from '../services/onedb.service';

const RELOAD_INTERVAL = 5000;

declare const require:any;
declare const window:any;
const marked = require('marked');
const moment = require('moment');

@Component({
    selector: 'chat',
    templateUrl: './chat.pug',
    styles: [`
      .info {
        color: #999;
        font-size: 75%;
      }
      .message-list {
        overflow: scroll;
      }
    `]
})
export class ChatComponent {
  @ViewChild('messageList') messageList;

  public marked = marked;

  public error:string;
  public saving:boolean = false;
  public loading:boolean = false;
  public editingTitle:boolean = false;
  public sendingMessage:boolean = false;
  public loadingMessages:boolean = false;
  public hasEarlierMessages:boolean = false;

  public chatID:string;
  public chat:any;
  public acl:any;
  public messages:any[] = [];
  public message:string;

  private interval:any;
  public maxChatHeight = 1000;

  constructor(private route:ActivatedRoute, private onedb:OneDBService) {
    this.route.params.subscribe(params => {
      if (params['chat_id']) {
        this.load(params['chat_id'])
      }
    })
    this.maxChatHeight = window.innerHeight * 2 / 3;
  }

  ngOnDestroy() {
    clearInterval(this.interval);
  }

  prettyDate(date) {
    return moment(date).fromNow();
  }

  scrollDown() {
    if (!this.messageList) return;
    const el = this.messageList.nativeElement;
    el.scrollTop = el.scrollHeight;
  }

  async save() {
    this.error = null;
    this.saving = true;
    try {
      await this.onedb.client.update('alpha_chat', 'conversation', this.chatID, this.chat);
    } catch (e) {
      this.error = e;
      this.saving = false;
      return;
    }
    this.editingTitle = false;
    this.saving = false;
  }

  async load(id) {
    this.chatID = id;
    this.error = null;
    this.loading = true;
    this.editingTitle = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    try {
      this.chat = await this.onedb.client.get('alpha_chat', 'conversation', id);
      this.acl = await this.onedb.client.getACL('alpha_chat', 'conversation', id);
      this.messages = [];
      this.loadMessages(true);
    } catch (e) {
      this.error = e.message;
      return;
    }
    this.interval = setInterval(() => this.loadMessages(), RELOAD_INTERVAL);
    this.loading = false;
  }

  async loadEarlierMessages() {
    let firstMessage = this.messages[0];
    if (!firstMessage) return;
    const query:any = {
      'data.conversationID': this.chatID,
      sort: 'info.created:descending',
      created_before: firstMessage.$.info.created,
    };
    let newMessages = await this.onedb.client.list('alpha_chat', 'message', query);
    this.hasEarlierMessages = newMessages.hasNext;
    this.messages = newMessages.items.reverse().concat(this.messages);
  }

  async loadMessages(doScroll=false) {
    if (this.loadingMessages) return setTimeout(() => this.loadMessages(doScroll), 100);
    this.loadingMessages = true;
    const query:any = {'data.conversationID': this.chatID, sort: 'info.created:descending'};
    let lastMessage = this.messages[this.messages.length - 1];
    if (lastMessage) {
      query.created_since = lastMessage.$.info.created;
    }
    let newMessages = await this.onedb.client.list('alpha_chat', 'message', query);
    if (!lastMessage) {
      this.hasEarlierMessages = newMessages.hasNext;
    }
    this.messages = this.messages.concat(newMessages.items.reverse());
    if (doScroll) setTimeout(() => this.scrollDown(), 100);
    this.loadingMessages = false;
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
    this.sendingMessage = true;
    try {
      const message = {message: this.message, conversationID: this.chatID};
      await this.onedb.client.create('alpha_chat', 'message', message);
      await this.loadMessages(true);
    } catch (e) {
      this.error = e.message;
      this.sendingMessage = false;
      return;
    }
    this.message = null;
    this.sendingMessage = false;
  }
}
