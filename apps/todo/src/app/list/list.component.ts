import {Component, Input} from '@angular/core';
import {OneDBService} from '../services/onedb.service';
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
      input.missing {
        font-style: italic;
      }
      input.done {
        text-decoration: line-through;
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
  listID:string;

  constructor(
        private onedb:OneDBService,
        private router:Router,
        private route:ActivatedRoute) {
    this.route.params.subscribe(params => {
      if (params['list_id']) {
        this.load(params['list_id'])
      }
    });
    this.onedb.onLogin.subscribe(instance => {
      if (instance === this.onedb.client.hosts.primary) {
        if (!instance.user) {
          this.router.navigate(['/']);
        } else if (this.listID) {
          this.load(this.listID);
        }
      }
    })
  }

  newItem() {
    return {title: "", done: false}
  }

  async load(id:string) {
    this.listID = id;
    this.list = null;
    this.error = null;
    try {
      this.list = await this.onedb.client.get('todo', 'list', id);
    } catch (e) {
      this.error = e.message;
    }
  }

  async save() {
    let id = null;
    this.error = null;
    this.saving = true;
    try {
      if (!this.list.$) {
        id = await this.onedb.client.create('todo', 'list', this.list);
        await this.router.navigate(['/list', id]);
      } else {
        id = this.list.$.id;
        await this.onedb.client.update('todo', 'list', this.list.$.id, this.list);
        await this.load(this.list.$.id);
      }
    } catch (e) {
      this.error = e.message;
      this.saving = false;
      return;
    }
    this.saving = false;
  }

  async deleteItem(item) {
    this.error = null;
    if (item.$) {
      try {
        await this.onedb.client.delete('todo', 'item', item.$.id);
      } catch (e) {
        this.error = e.message;
        return;
      }
    }
    this.list.items = this.list.items.filter(i => i !== item);
    await this.save();
  }

  async delete() {
    this.error = null;
    if (this.list.$) {
      try {
        await this.onedb.client.delete('todo', 'list', this.list.$.id);
      } catch (e) {
        this.error = e.message;
        return;
      }
    }
    await this.router.navigate(['/home']);
  }
}
