const fs = require('fs');

const npath = require('path');
const Client = require('onedb-client').Client;

module.exports = async function(args) {
  const host = {
    location: args.host,
    username: args.username || process.env.ONEDB_USERNAME,
    password: args.password || process.env.ONEDB_PASSWORD,
  }
  const client = new Client({
    hosts: {
      primary: host,
      core: host,
    }
  });

  const DIR = npath.join(process.cwd(), args.directory);

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
    versions: [{types}]
  }
  let existing = null;
  try {
    existing = await client.get('core', 'namespace', args.name);
  } catch (e) {
    if (e.statusCode !== 404) throw e;
  }
  if (existing) {
    await client.append('core', 'namespace', args.name, ns);
    console.log("Updated namespace " + args.name);
  } else {
    await client.create('core', 'namespace', args.name, ns);
    console.log("Created namespace " + args.name);
  }
  process.exit(0);
}

;(async () => {
  if (require.main === module) {
    try {
      await module.exports({})
    } catch (e) {
      console.error(e.message);
    }
  }
})();
