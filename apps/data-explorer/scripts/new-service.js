const args = require('yargs').argv;
const fs = require('fs');

let serviceCode = function(name, filename) {
  return `
import {Injectable} from '@angular/core';

@Injectable()
export class ${name}Service {
  constructor() {}
}
  `.trim()
}

const APP_DIR = __dirname + '/../src/app/';

const filename = args.name.toLowerCase().replace(/\s/g, '-');
const serviceName = args.name.replace(/\s/g, '');
const serviceDir = APP_DIR + 'services/';
const serviceFile = serviceDir + filename + '.service.ts';
const appFile = APP_DIR + 'app.module.ts';

let service = serviceCode(serviceName, filename);

fs.writeFileSync(serviceFile, service);

let app = fs.readFileSync(appFile, 'utf8');
let lines = app.split('\n').reverse();

let insertImportAt = lines.findIndex(l => l.match(/^import .* from '\.\/.*.service'/));
lines.splice(insertImportAt, 0, `import {${serviceName}Service} from './services/${filename}.service'`);

let insertDeclarationAt = lines.findIndex(l => l.match(/^\s+\w+Service,/));
lines.splice(insertDeclarationAt, 0, `    ${serviceName}Service,`)

lines.reverse();
fs.writeFileSync(appFile, lines.join('\n'));
