import {Component} from '@angular/core';
import {FreeDBService} from '../services/freedb.service';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
    selector: 'namespace',
    templateUrl: './namespace.pug',
    styles: [`
      .space {
        margin-top: 20px;
      }
    `]
})
export class NamespaceComponent {
  namespace:any;
  version:any;
  data:any[];
  constructor(
        public freedb:FreeDBService,
        private router:Router,
        private route:ActivatedRoute) {
    this.route.params.subscribe(async params => {
      if (params['namespace']) {
        this.setNamespace(await this.freedb.client.get('core', 'namespace', params['namespace']))
      }
    })
  }

  async setNamespace(ns) {
    this.namespace = ns;
    this.data = [];
    console.log(ns);
    this.version = ns.versions[ns.versions.length - 1];
    let types = Object.keys(this.version.types);
    for (let type of types) {
      let query = {owner: this.freedb.client.hosts.primary.user._id}
      let dataset = await this.freedb.client.list(ns._id, type, query);
      this.data.push({type, dataset});
    }
  }
}
