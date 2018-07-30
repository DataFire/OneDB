import {Component, Input} from '@angular/core';
import {FreeDBService} from '../services/freedb.service';
import { Router, ActivatedRoute } from '@angular/router';


@Component({
    selector: 'list',
    templateUrl: './list.pug',
    styles: [`
      .item {
        display: flex;
      }
      .checkbox {
        width: 40px;
        line-height: 54px;
      }
      .item-title {
        flex-grow: 1;
      }
      input[type="text"] {
        border-left: none;
        border-right: none;
        border-top: none;
      }
    `]
})
export class ListComponent {
  @Input() list:any = {
    title: 'My List',
    items: [],
  };
  @Input() editing:boolean = false;
  error:string;
  saving:boolean;

  constructor(
        private freedb:FreeDBService,
        private router:Router,
        private route:ActivatedRoute) {
    this.route.params.subscribe(params => {
      if (params['list_id']) {
        this.load(params['list_id'])
      }
    })
  }

  newItem() {
    return {title: "", done: false}
  }

  async load(id:string) {
    this.list = null;
    this.error = null;
    try {
      this.list = await this.freedb.client.get('alpha_todo', 'list', id);
    } catch (e) {
      this.error = e.message;
    }
  }

  async save() {
    let id = null;
    this.error = null;
    this.saving = true;
    try {
      if (!this.list._id) {
        id = await this.freedb.client.create('alpha_todo', 'list', this.list);
      } else {
        id = this.list._id;
        await this.freedb.client.update('alpha_todo', 'list', this.list._id, this.list);
      }
    } catch (e) {
      this.error = e.message;
      this.saving = false;
      return;
    }
    this.saving = false;
    await this.router.navigate(['/list', id]);
  }

  async destroyItem(item) {
    this.error = null;
    if (item._id) {
      try {
        await this.freedb.client.destroy('alpha_todo', 'item', item._id);
      } catch (e) {
        this.error = e.message;
        return;
      }
    }
    this.list.items = this.list.items.filter(i => i !== item);
    if (item._id) {
      await this.save();
    }
  }

  async destroy() {
    this.error = null;
    try {
      await this.freedb.client.destroy('alpha_todo', 'list', this.list._id);
    } catch (e) {
      this.error = e.message;
      return;
    }
    await this.router.navigate(['/home']);
  }
}
