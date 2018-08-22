import {Component, ViewChild} from '@angular/core';
import {FreeDBService} from '../services/freedb.service';
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
      private freedb:FreeDBService,
      private modals: NgbModal,
      private sanitizer:DomSanitizer) {
    this.refreshForm();
    this.freedb.onLogin.subscribe(host => this.refreshForm())
  }

  open() {
    this.modals.open(this.content);
  }

  refreshForm() {
    this.formContent = this.sanitizer.bypassSecurityTrustHtml(this.freedb.client.loginForm());
  }
}
