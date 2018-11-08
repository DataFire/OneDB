import {Component, Input, Output, EventEmitter, ViewChild} from '@angular/core';

import {util} from './util';

@Component({
    selector: 'schema-label',
    templateUrl: './schema-label.pug',
    styles: [`
      .type-choice.dropdown {
        display: inline-block;
        margin-left: 5px;
      }
    `]
})
export class SchemaLabelComponent {
  @Input('schema') inputSchema:any;
  schema:any;
  @Input() refBase;
  @Input() label:string;
  @Input() required:boolean;
  @Input() expand:boolean;
  @Input() showRemove:boolean = false;
  @Input() showExpand:boolean;
  @Output() typeChange = new EventEmitter();
  @Output() expandChange = new EventEmitter();
  @Output() schemaChange = new EventEmitter();
  @Output() onRemoved = new EventEmitter();
  @ViewChild('descriptionTooltip') descriptionTooltip;
  type:string;
  typeChoices:string[];
  description:string;

  constructor() {}

  clickRemove() {
    this.onRemoved.emit();
  }

  ngOnChanges() {
    if (!this.inputSchema) return
    this.setSchema(this.inputSchema);
    if (this.expand) this.maybeResolveRef();
  }

  setSchema(schema) {
    if (schema === this.schema) return;
    this.schema = schema;
    let resolved = schema.$ref ? util.resolveReference(schema.$ref, this.refBase) : schema;
    this.label = this.label || resolved.title;
    this.description = resolved.description;
    this.typeChoices = null;
    let type = util.getTypeForSchema(resolved, this.refBase);
    if (Array.isArray(type)) {
      if (resolved.type.length > 1) {
        this.typeChoices = resolved.type;
      }
      this.type = type.filter(t => t !== 'null')[0] || type[0];
    } else {
      this.type = type;
    }
    if (this.type !== 'object' && this.type !== 'array' && !this.expand) {
      this.toggleExpand();
    }
    setTimeout(() => {
      this.typeChange.emit(this.type);
      this.schemaChange.emit(this.schema);
    });
  }

  toggleExpand() {
    this.expand = !this.expand;
    this.maybeResolveRef();
    this.expandChange.emit(this.expand);
  }

  maybeResolveRef() {
    if (!this.schema.$ref) return;
    this.setSchema(util.resolveReference(this.schema.$ref, this.refBase));
  }
}
