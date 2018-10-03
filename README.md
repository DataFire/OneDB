# OneDB

[![Travis][travis-image]][travis-link]
[![NPM version][npm-image]][npm-link]
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://www.npmjs.com/package/onedb-cli)

> The documentation for OneDB is at [docs.one-db.org](https://docs.one-db.org)

![OneDB Logo](web/img/Logo.svg)

OneDB lets you create cloud-enabled apps without having to worry about or pay for backend
infrastructure.

OneDB is an open-source Backend-as-a-Service, similar to [Firebase](https://firebase.google.com/).
Anyone can host a OneDB instance, and end-users can decide where to store their data.
This means end-users have complete control and ownership over their data.

OneDB takes care of authentication, data validation,
and storage, so you can focus on building great user experiences. And by utilizing
the existing network of OneDB instances, you can deploy your app for free, forever.

We provide a OneDB instance at `one-db.datafire.io` which is free for developers. End-users can
store up to 10MB of data before getting charged.

You can
[read more about OneDB](https://medium.com/@bbrennan/announcing-onedb-a-platform-for-federated-apps-bc3cc7ff86e6),
[check out the documentation](https://docs.one-db.org),
or continue reading to learn more about the code in this repository.

## Repository Contents

This repository contains:
* `./server`: The OneDB NodeJS server
* `./client`: The OneDB JavaScript client
* `./apps`: A few sample applications

## Build an App
Building apps on OneDB is free and easy. Just create a data model, write your frontend,
and the existing network of OneDB instances will take care of all the data validation and storage.

Check out the [Hello World documentation](https://docs.one-db.org/Hello_World) or the
[sample apps](apps) to get started.

If you build an app, let us know and we'll add you to the [list of OneDB apps](Apps.md)

## Host an Instance
> The full documentation for hosting an instance is on [docs.one-db.org](https://docs.one-db.org/Host_an_Instance)

Help us expand the OneDB network by hosting an instance. You'll need:
* A server to host OneDB
* The OneDB server (this repository)
* A MongoDB instance

If you hosta public instance, let us know and we'll add you to the [list of known hosts](Hosts.md)

### Installation and Setup
Install the server:
```bash
npm install -g onedb-cli
```

Create your settings in `OneDB.yml`:
```yml
mongodb: "mongodb://localhost:27017"
jwtSecret: "thisisasecret"
host: "https://onedb.example.com"
```

And start the server:
```bash
onedb serve --port 3000
```

## Contribute
Contributions are welcome! Check out the [roadmap](ROADMAP.md) to learn how you can help,
or open an issue if there's a feature you'd like to see.

If you're working on a major change, be sure to let us know ahead of time.



[downloads-image]: https://img.shields.io/npm/dm/datafire.svg
[twitter-image]: https://img.shields.io/badge/Share-on%20Twitter-blue.svg
[twitter-link]: https://twitter.com/intent/tweet?text=OneDB+-+build+cloud+apps+without+worrying+about+backends&url=http%3A%2F%2Fgithub.com%2FDataFire%2FOneDB
[gitter-image]: https://img.shields.io/badge/Chat-on%20Gitter-blue.svg
[gitter-link]: https://gitter.im/DataFire/Lobby
[npm-image]: https://img.shields.io/npm/v/onedb-cli.svg
[npm-link]: https://npmjs.org/package/onedb-cli
[travis-image]: https://travis-ci.org/DataFire/OneDB.svg?branch=master
[travis-link]: https://travis-ci.org/DataFire/OneDB
[climate-image]: https://codeclimate.com/github/DataFire/OneDB.png
[climate-link]: https://codeclimate.com/github/DataFire/OneDB
[deps-image]: https://img.shields.io/david/DataFire/OneDB.svg
[deps-link]: https://david-dm.org/DataFire/OneDB
[devdeps-image]: https://img.shields.io/david/dev/DataFire/OneDB.svg
[devdeps-link]: https://david-dm.org/DataFire/OneDB#info=devDependencies
[blog-image]: https://img.shields.io/badge/Read-on%20Medium-blue.svg
[blog-link]: https://medium.com/datafire-io
[mail-image]: https://img.shields.io/badge/Subscribe-on%20MailChimp-blue.svg
[mail-link]: https://eepurl.com/c3t10T
