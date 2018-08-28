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
      table {
        margin-bottom: 15px;
      }
      table td {
        padding: 4px;
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
    this.version = ns.versions[ns.versions.length - 1];
    const types = Object.keys(this.version.types);
    for (let type of types) {
      let dataset = await this.getDataset(type);
      this.data.push({type, dataset});
    }
  }

  async getDataset(type, skip=0) {
    const query = {skip, owner: this.freedb.client.hosts.primary.user.$.id}
    const dataset = await this.freedb.client.list(this.namespace.$.id, type, query);
    if (dataset.total > dataset.items.length) {
      dataset.pages = [];
      const numPages = Math.ceil(dataset.total / dataset.pageSize);
      const curPage = Math.floor(dataset.skip / dataset.pageSize);
      dataset.pages.push({
        label: 'Previous',
        skip: Math.max(0, dataset.skip - dataset.pageSize),
        disabled: curPage === 0,
      });
      for (let i = 0; i < numPages; ++i) {
        dataset.pages.push({
          label: (i + 1).toString(),
          skip: i * dataset.pageSize,
          active: i === curPage,
        });
      }
      dataset.pages.push({
        label: 'Next',
        skip: dataset.skip + dataset.pageSize,
        disabled: curPage === numPages - 1,
      })
    }
    return dataset;
  }

  async goToPage(idx, skip) {
    const datum = this.data[idx];
    datum.dataset = await this.getDataset(datum.type, skip);
  }
}
