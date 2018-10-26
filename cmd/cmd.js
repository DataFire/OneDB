"use strict";

const DEFAULT_HOST = "https://one-db.datafire.io";

const commands = require('./index');

let args = require('yargs')
           .option('v', {alias: 'verbose'})
           .global('v')
           .recommendCommands();

function attempt(fn) {
  return async function(args) {
    try {
      await commands[fn](args);
    } catch (e) {
      console.log(e.message);
    }
  }
}

args = args.command(
    'serve',
    "Start a OneDB server",
    yargs => {
      yargs.option('port', {
        alias: 'p',
        describe: 'The port to listen on',
        default: 3000,
      })
    },
    attempt('serve'),
)
args = args.command(
    'namespace',
    "Create or update a namespace",
    yargs => {
      yargs.option('name', {
        alias: 'n',
        describe: "The ID of the namespace",
        demand: true,
      })
      yargs.option('directory', {
        alias: 'd',
        describe: "The directory containing schema and ACL files",
        default: process.cwd(),
      });
      yargs.option('host', {
        alias: 'h',
        describe: "The OneDB host to send the namespace to",
        default: DEFAULT_HOST,
      })
    },
    attempt('namespace'),
)

args = args.demandCommand(1);
args = args.help('h').alias('h', 'help').strict().argv;
