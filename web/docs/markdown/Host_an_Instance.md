## Hosting a OneDB Instance

You might want to host your own OneDB instance for a number of reasons:
* As a place to host your own private data
* To keep data inside your company's intranet
* To help expand the network of public OneDB instances
* To give your app's users a free place to store their data

These instructions will help you get started.

### Installation
You can download the latest server from npm:
```bash
npm install -g onedb-cli@latest
```

You'll also need to [install MongoDB](https://docs.mongodb.com/manual/installation/), or
get a hosted MongoDB instance using a service like [mLab](https://mlab.com/).

### Setup
You can set your server configuration using a YAML file, called `OneDB.yml`. You'll need
to set your MongoDB location at the least.
```yml
mongodb: "mongodb://localhost:27017"
jwtSecret: "thisisasecret"
host: "https://onedb.example.com"
```

### Running
You can start the server with the `onedb` CLI. Run this command from the directory
containing `OneDB.yml`:

```bash
onebd serve --port 3000
```

### Customization
All customization is done in the `OneDB.yml` configuration file.

#### Namespaces
You can whitelist or blacklist particular namespaces which you want to support:

```yaml
namespaces:
  allowed:
    - chat
    - todo
```

```yaml
namespaces:
  disallowed:
    - chat
```

By default, OneDB will use the core instance at `https://core.onedb.datafire.io` when retrieving
schemas for validation purposes. You can disable this by setting:
```yaml
namespaces:
  proxy:
    core: null
```

#### Data Limits
OneDB will default to sensible rate limits and data size limits. You can override these options:

```yaml
maxBytesPerItem: 100 * 1000, // 100 kiB
maxItemsPerUser: 10 * 1000,  // 1 GiB total
rateLimit:
  all:
    windowMs: 900000
    max: 900
    delayMs: 0
  users:
    windowMs: 900000
    max: 900
    delayMs: 0
  createUser:
    windowMs: 900000
    max: 15
    delayMs: 3 * 1000
    delayAfter: 10
  getData:
    windowMs: 900000
    max: 900
    delayMs: 0
  mutateData:
    windowMs: 900000
    max: 225
    delayMs: 500
    delayAfter: 100
```

Rate limit options are passed directly to
[express-rate-limit](https://www.npmjs.com/package/express-rate-limit)

#### Email
Email is used for confirming users' email addresses and password resets.
Options are passed directly to [nodemailer](https://nodemailer.com/transports/).

You can:

* Send via `sendmail`:
```yaml
email:
  sendmail: true
  newline: unix
  path: '/usr/bin/sendmail'
```
* Send via Amazon's SES:
```yaml
email:
  SES:
    region: us-west-2
    accessKeyId: ABCDE
    secretAccessKey: FGHIJ
```
* Write emails to a local file (for testing/debugging):
```yaml
email:
  file: './email.txt'
```
