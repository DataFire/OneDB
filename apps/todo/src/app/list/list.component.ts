import {Component, Input} from '@angular/core';
import {FreeDBService} from '../services/freedb.service';

@Component({
    selector: 'list',
    templateUrl: './list.pug',
})
export class ListComponent {
  @Input() list:any = {
    title: 'My List',
    description: 'This is a list of things I need to do.',
    items: [],
  };
  @Input() editing:boolean = false;

  constructor(private freedb:FreeDBService) {}

  newItem() {
    return {title: "Do something", done: false}
  }

  async save() {
    if (this.list._id) {
      const itemIDs = []
      for (let item of this.list.items) {
        itemIDs.push(await this.freedb.create('alpha_todo', 'item', item));
      }
      
      await this.freedb.create('alpha_todo', 'list'
    }
  }
}
