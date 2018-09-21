import {Component} from '@angular/core';
import {OneDBService} from '../services/onedb.service';
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

  ACCESS_TYPES = ['read', 'write', 'append', 'delete'];
  ACL_TYPES = ['allow', 'disallow', 'modify'];

  loading:boolean;
  error:string;

  constructor(
        public onedb:OneDBService,
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
    return JSON.stringify(item, (key, val) => key === '$' ? undefined : val, 2);
  }

  datestr(date) {
    const m = moment(date);
    return m.format('MMMM Do YYYY, h:mm:ss a') + ' (' + m.fromNow() + ')';
  }

  async getData() {
    this.item = await this.onedb.client.get(this.namespace, this.type, this.item_id);
    this.acl = await this.onedb.client.getACL(this.namespace, this.type, this.item_id);
    this.info = this.item.$.info;
    this.itemString = this.stringify(this.item);
  }

  setACLString(str, aclType, accessType) {
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
    await this.onedb.client.update(this.namespace, this.type, this.item_id, item);
    await this.onedb.client.updateACL(this.namespace, this.type, this.item_id, this.acl);
    this.getData();
  }

  async delete() {
    await this.onedb.client.delete(this.namespace, this.type, this.item_id);
    this.router.navigate(['/data', this.namespace]);
  }
}
