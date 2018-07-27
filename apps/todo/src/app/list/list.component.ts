import {Component, Input} from '@angular/core';
import {FreeDBService} from '../services/freedb.service';
import { ActivatedRoute } from '@angular/router';


@Component({
    selector: 'list',
    templateUrl: './list.pug',
})
export class ListComponent {
  @Input() list:any = {
    title: 'My List',
    items: [],
  };
  @Input() editing:boolean = false;

  constructor(
        private freedb:FreeDBService,
        private route:ActivatedRoute) {
    this.route.params.subscribe(params => {
      if (params['list_id']) {
        this.load(params['list_id'])
      }
    })
  }

  newItem() {
    return {title: "Do something", done: false}
  }

  async load(id:string) {
    this.list = await this.freedb.client.get('alpha_todo', 'list', id);
  }

  async save() {
    let id = null;
    if (!this.list._id) {
      id = await this.freedb.client.create('alpha_todo', 'list', this.list);
    } else {
      id = this.list._id;
      await this.freedb.client.update('alpha_todo', 'list', this.list._id, this.list);
    }
    await this.load(id);
  }
}
