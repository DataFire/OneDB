import {Component} from '@angular/core';
import {FreeDBService} from '../services/freedb.service';
import { Router, ActivatedRoute } from '@angular/router';

declare let window:any;
declare let require:any;
const moment = require("moment");

@Component({
    selector: 'item',
    templateUrl: './item.pug',
    styles: [`
      ul.info {
        list-style: none;
        padding-left: 0px;
      }
      .info-label {
        display: inline-block;
        min-width: 150px;
      }
    `]
})
export class ItemComponent {
  namespace:string;
  type:string;
  item_id:string;

  item:any;
  acl:any;
  info:any;
  itemString:string;

  ACCESS_TYPES = ['read', 'write', 'append', 'destroy'];
  ACL_TYPES = ['allow', 'disallow', 'modify'];

  loading:boolean;
  error:string;

  constructor(
        public freedb:FreeDBService,
        private router:Router,
        private route:ActivatedRoute) {
    window.item = this;
    this.route.params.subscribe(async params => {
      this.namespace = params['namespace'] || this.namespace;
      this.type = params['type'] || this.type;
      this.item_id = params['item_id'] || this.item_id;
      if (this.namespace && this.type && this.item_id) {
        this.getData();
      }
    })
  }

  stringify(item) {
    return JSON.stringify(item, null, 2);
  }

  datestr(date) {
    const m = moment(date);
    return m.format('MMMM Do YYYY, h:mm:ss a') + ' (' + m.fromNow() + ')';
  }

  async getData() {
    this.item = await this.freedb.client.get(this.namespace, this.type, this.item_id);
    this.acl = await this.freedb.client.getACL(this.namespace, this.type, this.item_id);
    this.info = await this.freedb.client.getInfo(this.namespace, this.type, this.item_id);
    this.itemString = this.stringify(this.item);
  }

  setACLString(str, aclType, accessType) {
    console.log('change', str);
    const users = str.split(',').map(s => s.trim());
    this.acl[aclType][accessType] = users;
  }

  async wrapAsync(fn) {
    this.loading = true;
    this.error = null;
    try {
      await this[fn]();
    } catch (e) {
      this.error = e.message;
      this.loading = false;
      return
    }
    this.loading = false;
  }

  async save() {
    let item = JSON.parse(this.itemString);
    await this.freedb.client.update(this.namespace, this.type, this.item_id, item);
    await this.freedb.client.updateACL(this.namespace, this.type, this.item_id, this.acl);
    this.getData();
  }

  async destroy() {
    await this.freedb.client.destroy(this.namespace, this.type, this.item_id);
    this.router.navigate(['/data', this.namespace]);
  }
}
