import {Component, Input, Output, EventEmitter, ViewChild} from '@angular/core';

import {util} from './util';

declare let window:any;

@Component({
    selector: 'json-schema-editor',
    templateUrl: './json-schema-editor.pug',
    styles: [`
      .nested-editor {
        padding-left: 20px;
      }
      .type-choice {
        display: inline;
      }
    `],
})
export class JSONSchemaEditorComponent {
  @Input() label;
  @Input('schema') inputSchema;
  schema:any;
  @Input() refBase;
  @Input('value') inputValue;
  value:any;
  @Input() nested:boolean;
  @Input() depth:number;
  @Input() required:boolean;
  @Input() showRemove:boolean;
  @Output() valueChange = new EventEmitter();
  @ViewChild('labelComponent') labelComponent;
  allProperties:string[] = [];
  removableProperties:string[];
  additionalPropertyName:string;
  additionalPropertyType:string;

  numItems = 0;

  util = util;

  ngOnChanges() {
    this.setSchema(this.inputSchema);
    if (this.value !== this.inputValue) {
      this.value = this.inputValue;
      if (Array.isArray(this.value)) {
        this.numItems = this.value.length;
      }
    }
  }

  ngAfterViewInit() {
    setTimeout(() => this.setDefaultValue());
  }

  setSchema(schema) {
    if (this.depth === 3) window.jc = this;
    this.schema = schema;
    this.setDefaultValue();
    this.setProperties();
  }

  setProperties() {
    this.allProperties = util.getSchemaProperties(this.schema || {}, this.refBase, this.value);
    let nonRemovable = util.getSchemaProperties(this.schema || {}, this.refBase);
    this.removableProperties = this.allProperties.filter(p => nonRemovable.indexOf(p) === -1);
  }

  setDefaultValue(arg='') {
    if (!this.labelComponent) return;
    if (!this.labelComponent.expand) {
      this.value = undefined;
    } else if (this.labelComponent.type === 'object' && (!this.value || typeof this.value !== 'object')) {
      this.value = {};
      this.setProperties();
    } else if (this.labelComponent.type === 'array' && !Array.isArray(this.value)) {
      this.value = [];
    } else {
      return;
    }
    this.valueChange.emit(this.value);
  }

  nestedValueChange(propOrIdx, val) {
    if (val === undefined) {
      if (Array.isArray(this.value)) {
        this.value.splice(propOrIdx, 1);
        this.numItems = this.value.length;
      } else {
        delete this.value[propOrIdx];
      }
    } else {
      this.value[propOrIdx] = val;
    }
    if (!Array.isArray(this.value)) {
      this.setProperties();
    }
    this.valueChange.emit(this.value);
  }

  addProperty() {
    if (!this.additionalPropertyName) return;
    let val = util.getDefaultValueForType(this.additionalPropertyType || 'string');
    this.nestedValueChange(this.additionalPropertyName, val);
    this.additionalPropertyName = this.additionalPropertyType = null;
  }
}
