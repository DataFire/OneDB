# FreeDB

FreeDB is a decentralized backend-as-a-service.

```bash
npm i -g freedb-cli
```

## Operations

To follow the examples below, set the FreeDB environment variable to your preferred FreeDB server
```bash
export FreeDB=https://alpha.freedb.io
```

### Server info
```bash
curl $FreeDB/info

# {version: '0.0.1'}
```

### Create a User

To interact with a FreeDB instance, you'll need to create a new user. Users are managed with public-key cryptography rather than
the traditional username/password flow.

Because of this, **be sure to choose a strong passphrase**.

Create a new user:
```bash
freedb register
# Passphrase: thisisasecretpassphrase
```

or log into an existing account:
```bash
freedb login
# Passphrase: thisisasecretpassphrase
```

Both commands will store your passphrase in ~/.freedb.session

### Register a namespace

Namespaces are versioned sets of datatypes. To start storing your own data types in FreeDB, you need to start by creating a namespace.

```bash
freedb namespace petstore
```

### Register types

FreeDB uses [JSON Schema](http://json-schema.org) to validate types. Every type must have a valid JSON schema.

```bash
freedb type petstore/pet --schema '{"type": "object", "properties": {"name": {"type": "string"}, "age": {"type": "integer"}}}'
# Registered type petstore/pet

freedb type petstore/owner --schema '{"type": "object", "properties": {"pets": {"type": "array", "items": {"$ref": "petstore/pet"}}}}'
# Registered type petstore/owner
```

### Publish your namespace
You won't be able to post data until your namespace is published.

```bash
freedb publish petstore
# Published petstore@0.0
```

### Add some data

We're ready to start adding some data to FreeDB!

```bash
freedb create petstore/pet --data '{"name": "Lucy", "age": 5}'
# {"id": "petstore/pet/ZH9d8f7x", "name": "Lucy", "age": 5}

freedb create petstore/owner --data '{"pets": [{"$ref": "petstore/pet/ZH9d8f7"}]}'
# {"id": "petstore/owner/8yIl6hs4", "pets": [{"$ref": "https://alpha.freedb.io/petstore/pet/ZH9d8f7"}]}
```

### Retrieve your data

```bash
freedb retrieve petstore/owner/8yIl6hs4
```
