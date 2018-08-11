import {Component} from '@angular/core';
import {FreeDBService} from '../services/freedb.service';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
    selector: 'item',
    templateUrl: './item.pug',
})
export class ItemComponent {
  namespace:string;
  type:string;
  item_id:string;

  item:any;
  acl:any;
  info:any;

  constructor(
        public freedb:FreeDBService,
        private router:Router,
        private route:ActivatedRoute) {
    this.route.params.subscribe(async params => {
      console.log(params);
      this.namespace = params['namespace'] || this.namespace;
      this.type = params['type'] || this.type;
      this.item_id = params['item_id'] || this.item_id;
      if (this.namespace && this.type && this.item_id) {
        let item = await this.freedb.client.get(this.namespace, this.type, this.item_id);
        let acl = await this.freedb.client.getACL(this.namespace, this.type, this.item_id);
        let info = await this.freedb.client.getInfo(this.namespace, this.type, this.item_id);
        this.setItem(item, acl, info);
      }
    })
  }

  setItem(item, acl, info) {
    this.item = item;
    this.acl = acl;
    this.info = info;
  }

  stringify(item) {
    return JSON.stringify(item, null, 2);
  }
}
