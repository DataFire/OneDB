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
      textarea {
        font-family: monospace;
      }
    `]
})
export class ItemComponent {
  namespace:string;
  type:string;
  item_id:string;

  namespaceInfo:any;
  schema:any;
  item:any;
  acl:any;
  info:any;
  itemString:string;

  ACCESS_TYPES = ['read', 'write', 'append', 'delete'];
  ACL_TYPES = ['allow', 'disallow', 'modify'];

  loading:boolean;
  error:string;
  editMode:string = 'form';

  constructor(
        public onedb:OneDBService,
        private router:Router,
        private route:ActivatedRoute) {
    window.item = this;
    this.route.params.subscribe(async params => {
      this.namespace = params['namespace'] || this.namespace;
      this.type = params['type'] || this.type;
      this.item_id = params['item_id'] || this.item_id;
      this.getMetadata();
      if (this.namespace && this.type && this.item_id) {
        this.getData();
      } else {
        this.item = {};
        this.itemString = '{}';
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

  async getMetadata() {
    this.namespaceInfo = await this.onedb.client.get('core', 'namespace', this.namespace);
    this.schema = this.namespaceInfo.versions[this.namespaceInfo.versions.length - 1].types[this.type].schema;
  }

  async getData() {
    this.item = await this.onedb.client.get(this.namespace, this.type, this.item_id);
    this.acl = await this.onedb.client.getACL(this.namespace, this.type, this.item_id);
    this.info = this.item.$.info;
    this.itemString = this.stringify(this.item);
  }

  toggleEditMode() {
    if (this.editMode === 'form') {
      this.itemString = this.stringify(this.item);
      this.editMode = 'json';
    } else {
      this.item = JSON.parse(this.itemString);
      this.editMode = 'form';
    }
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
    let item = this.item;
    if (this.editMode === 'json') {
      item = JSON.parse(this.itemString);
    }
    if (this.item_id) {
      await this.onedb.client.update(this.namespace, this.type, this.item_id, item);
      await this.onedb.client.updateACL(this.namespace, this.type, this.item_id, this.acl);
      await this.getData();
    } else {
      let itemID = await this.onedb.client.create(this.namespace, this.type, item);
      this.router.navigate(['/data', this.namespace, this.type, itemID]);
    }
  }

  async delete() {
    await this.onedb.client.delete(this.namespace, this.type, this.item_id);
    this.router.navigate(['/data', this.namespace]);
  }
}
