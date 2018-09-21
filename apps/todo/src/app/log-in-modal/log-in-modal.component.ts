import {Component, ViewChild} from '@angular/core';
import {OneDBService} from '../services/onedb.service';
import {NgbModal, ModalDismissReasons} from '@ng-bootstrap/ng-bootstrap';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser'

@Component({
    selector: 'log-in-modal',
    templateUrl: './log-in-modal.pug',
})
export class LogInModalComponent {
  @ViewChild('content') content;
  formContent:SafeHtml;

  constructor(
      private onedb:OneDBService,
      private modals: NgbModal,
      private sanitizer:DomSanitizer) {
    this.refreshForm();
    this.onedb.onLogin.subscribe(host => this.refreshForm())
  }

  open() {
    this.modals.open(this.content);
  }

  refreshForm() {
    this.formContent = this.sanitizer.bypassSecurityTrustHtml(this.onedb.client.loginForm());
  }
}
