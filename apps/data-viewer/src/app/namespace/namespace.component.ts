import {Component} from '@angular/core';
import {OneDBService} from '../services/onedb.service';
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
        margin-left: -8px;
      }
      table td, table th {
        padding: 4px 8px;
        max-width: 200px;
      }
      .view-all-form-group label {
        margin-right: 10px;
      }
    `]
})
export class NamespaceComponent {
  namespace:any;
  version:any;
  types:string[];
  data:any;

  error:string;
  viewAllData:boolean = false;

  constructor(
        public onedb:OneDBService,
        private router:Router,
        private route:ActivatedRoute) {
    this.route.params.subscribe(async params => {
      if (params['namespace']) {
        try {
          this.setNamespace(await this.onedb.client.get('core', 'namespace', params['namespace']))
        } catch (e) {
          this.error = e.message;
        }
      }
    })
  }

  async setNamespace(ns) {
    this.namespace = ns;
    this.data = {};
    this.version = ns.versions[ns.versions.length - 1];
    this.types = Object.keys(this.version.types);
    for (let type of this.types) {
      let dataset = await this.getDataset(type);
      this.data[type] = dataset;
    }
  }

  async getDataset(type, skip=0) {
    const query:any = {skip};
    if (!this.viewAllData) {
      query.owner = this.onedb.client.hosts.primary.user.$.id
    }
    let dataset = null;
    try {
      dataset = await this.onedb.client.list(this.namespace.$.id, type, query);
    } catch (e) {
      this.error = e.message;
      return;
    }
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

  async goToPage(type, skip) {
    this.data[type] = await this.getDataset(type, skip);
  }

  async setViewAllData(viewAll) {
    this.viewAllData = viewAll;
    this.setNamespace(this.namespace);
  }
}
