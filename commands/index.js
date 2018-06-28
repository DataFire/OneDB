const npath = require('path');
const fs = require('fs');
const read = require('read')

const Client = require('freedb-client');

const homedir = require('os').homedir();
const SESSION_FILE = npath.join(homedir, '.freedb.session.json');
const DEFAULT_HOST = 'https://alpha.freedb.io';

const promptForPassphrase = () => {
  return new Promise((resolve, reject) => {
    read({ prompt: 'Passphrase: ', silent: true }, (err, pw) => {
      if (err) throw err;
      resolve(pw);
    })
  });
}

let session = fs.existsSync(SESSION_FILE) ? require(SESSION_FILE) : null;

let args = require('yargs')
           .recommendCommands();

args = args.option('host', {alias: 'h', default: (session && session.host) || DEFAULT_HOST, global: true, required: true});

args = args.command('register', "Registers a new user", async yargs => {
  let argv = yargs.argv;
  let client = new Client({host: argv.host});
  let passphrase = await promptForPassphrase();
  try {
    await client.createUser(passphrase);
  } catch (e) {
    console.error("Error creating user: " + e.message);
    return;
  }
  fs.writeFileSync(SESSION_FILE, JSON.stringify({host: argv.host, passphrase: argv.passphrase}));
  console.log("Success");
})

args = args.command('login', "Logs the user in by storing passphrase to a local file", async yargs => {
  let argv = yargs.argv;
  let passphrase = await promptForPassphrase();
  fs.writeFileSync(SESSION_FILE, JSON.stringify({host: argv.host, passphrase: passphrase}));
  console.log("Success");
})

args = args.command('logout', "Kills the current FreeDB session", async yargs => {
  let argv = yargs.argv;
  if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
  console.log("Success");
});

args = args.argv;
