const inquirer = require('inquirer');
const files = require('./files');
const fs = require('fs');
const Client = require('onedb-client').Client;

const USERNAME_QUESTION = {type: 'string', name: 'username', message: "Your OneDB username or email address"};
const PASSWORD_QUESTION = {type: 'password', name: 'password', message: "Your OneDB password"};

module.exports = async function(args) {
  if (!fs.existsSync(files.ONEDB_DIR)) {
    fs.mkdirSync(files.ONEDB_DIR);
  }
  if (!fs.existsSync(files.CREDENTIALS_FILE)) {
    fs.writeFileSync(files.CREDENTIALS_FILE, '{}');
  }
  const creds = require(files.CREDENTIALS_FILE);
  const prompt = inquirer.createPromptModule();
  const answers = await prompt([USERNAME_QUESTION, PASSWORD_QUESTION]);
  const client = new Client({hosts: {primary: {
    location: args.host,
    username: answers.username,
    password: answers.password,
  }}});
  const token = await client.generateToken(client.hosts.primary);
  creds[args.host] = {token, username: answers.username};
  fs.writeFileSync(files.CREDENTIALS_FILE, JSON.stringify(creds, null, 2));
}
