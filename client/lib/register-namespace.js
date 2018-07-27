const fs = require('fs');
const npath = require('path');
const args = require('yargs').argv;
const Client = require('./client');
const client = new Client(args);

const DIR = npath.join(process.cwd(), args.directory);

;(async () => {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.schema.json'));
  const types = {}
  for (let file of files) {
    const name = file.replace(/\.schema\.json$/, '');
    const schema = require(npath.join(DIR, file));
    types[name] = {schema}
  }
  for (let type in types) {
    const aclFile = npath.join(DIR, type + '.acl.json');
    if (fs.existsSync(aclFile)) {
      types[type].initial_acl = require(aclFile);
    }
  }
  const ns = {
    versions: [{
      version: '0',
      types,
    }]
  }
  const namespaceID = await client.create('core', 'namespace', ns, args.name);
  console.log("Created namespace " + namespaceID);
  process.exit(0);
})();
