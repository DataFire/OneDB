# OneDB

> The documentation for OneDB is at [docs.one-db.org](https://docs.one-db.org)

OneDB lets you create cloud-enabled apps without having to worry about or pay for backend
infrastructure.

OneDB is an open-source Backend-as-a-Service, similar to [Firebase](https://firebase.google.com/).
Anyone can host a OneDB instance, and end-users can decide where to store their data.

This means end-users have complete control and ownership over their data, while developers can
create cloud-enabled applications for free.

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
npm install -g onedb
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


