"use strict";

const DEFAULT_HOST = "https://one-db.datafire.io";

const commands = require('./index');

let args = require('yargs')
           .option('v', {alias: 'verbose'})
           .global('v')
           .recommendCommands();

function attempt(fn) {
  return async function(args) {
    // TODO: why are these not set by yargs defaults?
    args.host = args.host || DEFAULT_HOST;
    args.directory = args.directory || process.cwd();
    try {
      await commands[fn](args);
    } catch (e) {
      console.log(e.message);
    }
  }
}

args = args.command(
    'login',
    "Start a OneDB session",
    yargs => {
      return yargs.option('host', {
        alias: 'h',
        default: DEFAULT_HOST,
        describe: "The OneDB instance to log into",
      })
    },
    attempt('login'));

args = args.command(
    'serve',
    "Start a OneDB server",
    yargs => {
      return yargs.option('port', {
        alias: 'p',
        describe: 'The port to listen on',
        default: 3000,
      })
    },
    attempt('serve'),
);
args = args.command(
    'namespace',
    "Create or update a namespace",
    yargs => {
      yargs = yargs.option('name', {
        alias: 'n',
        describe: "The ID of the namespace",
        demand: true,
      })
      yargs = yargs.option('directory', {
        alias: 'd',
        describe: "The directory containing schema and ACL files",
        default: process.cwd(),
      });
      yargs = yargs.option('host', {
        alias: 'h',
        describe: "The OneDB host to send the namespace to",
        default: DEFAULT_HOST,
        type: 'string',
      })
      yargs = yargs.option('username', {
        alias: 'u',
        describe: "Your username",
      })
      yargs = yargs.option('password', {
        alias: 'p',
        describe: "Your password",
      })
      return yargs;
    },
    attempt('namespace'),
)

args = args.demandCommand(1);
args = args.help('h').alias('h', 'help').strict().argv;
