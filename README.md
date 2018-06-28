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

Let's create a `pet` type, where each pet will have a name and an age:

```bash
freedb type petstore/pet --schema '{"type": "object", "properties": {"name": {"type": "string"}, "age": {"type": "integer"}}}'
# Registered type petstore/pet
```

We'll also create an `owner` type, where each owner has multiple pets. We use `$ref` to indicate a reference to the `petstore/pet` type.
```bash
freedb type petstore/owner --schema '{"type": "object", "properties": {"pets": {"type": "array", "items": {"$ref": "petstore/pet"}}}}'
# Registered type petstore/owner
```

### Publish your namespace
You won't be able to post data until your namespace is published.

```bash
freedb publish petstore
# Published petstore@0.0
```

#### Versioning
If you make changes to your types and call `freedb publish` again, FreeDB will automatically update the version.

Backward compatible changes will increment the minor version. Here we add a "name" field for owners:
```bash
freedb type petstore/owner --schema '{"type": "object", "properties": {"name": {"type": "string"}, "pets": {"type": "array", "items": {"$ref": "petstore/pet"}}}}'
freedb publish petstore
# Published petstore@0.1
```

Breaking changes will increment the major version. Here we add validation to the pet's age:
```bash
freedb type petstore/pet --schema '{"type": "object", "properties": {"name": {"type": "string"}, "age": {"type": "integer", minimum: 0}}}'
freedb publish petstore
# Published petstore@1.1
```

You can always reference old versions by adding `@x.x` to the namespace.

### Add some data

We're ready to start adding some data to FreeDB!

First let's add a pet to the petstore:
```bash
freedb create petstore/pet --data '{"name": "Lucy", "age": 5}'
# {"id": "petstore/pet/ZH9d8f7x", "name": "Lucy", "age": 5}
```

Now let's add an owner. We use `$ref` to reference the ID of the pet we just created.
```bash
freedb create petstore/owner --data '{"pets": [{"$ref": "petstore/pet/ZH9d8f7"}]}'
# {"id": "petstore/owner/8yIl6hs4", "pets": [{"$ref": "https://alpha.freedb.io/data/petstore/pet/ZH9d8f7"}]}
```

### Retrieve your data

```bash
freedb retrieve petstore/owner/8yIl6hs4 --resolve
# {"id": "petstore/owner/8yIl6hs4", "pets": [{"name": "Lucy": "age" 5}]}
```

### Modify data
```bash
freedb modify petstore/pet/ZH9d8f7x --data '{"name": "Lucy", "age": 6}'
# {"id": "petstore/pet/ZH9d8f7x", "name": "Lucy", "age": 6}
```

### Destroy data
```bash
freedb destroy petstore/pet/ZH9d8f7x
# Successfully destroyed petstore/pet/ZH9d8f7x
```

#### Missing data
FreeDB will attempt to resolve any `$refs` in the data, but since data is stored across
many different FreeDB instances, it's possible that a `$ref` will be unresolvable.

Above, we deleted a pet. Let's see what happens when we retrieve its owner:

```bash
freedb retrieve petstore/owner/8yIl6hs4 --resolve
# {"id": "petstore/owner/8yIl6hs4", "pets": [{"$ref": "https://alpha.freedb.io/petstore/pet/ZH9d8f7", "missing": true}]}
```

## Working with Multiple Servers
Let's say we have the type `chat/conversation`, which contains an array of `chat/message`s. Alice and Bob
want to use this interface to have a conversation, but being privacy conscious people, neither
wants their messages hosted on a server they don't own.

Here's what will happen:
* Alice will create a `chat/conversation` on FreeDB Core, at `https://alpha.freedb.io`. She'll give Bob `append` access.
* Alice will create a `chat/message` on his own FreeDB instance at `https://bob.com`.
* At the same time, Alice will post a `$ref` to his `chat/message` on FreeDB Core
* Bob will check for any new conversations he has access to
* Bob will see the message `$ref` on FreeDB core and retrieve the contents from `https://freedb.alice.com`.
* Bob will post his reponse to `https://freedb.bob.com`, and post a `$ref` on FreeDB Core

Note: for this example, we'll assume Bob's user ID is just `bob`, but in reality it would be a longer ID

First Alice will run:
```bash
alice> freedb -h alpha.freedb.io create chat/conversation --acl '{"read": ["bob"], "append": ["bob"]}'
# {"id": "chat/conversation/a8dJsfbn", "messages": []}

alice> freedb -h freedb.alice.com create chat/message --data '{"message": "Hi Bob!"}'
# {"id": "chat/message/9sIzjYs8", "message": "Hi Bob!"}

alice> freedb -h alpha.freedb.io append chat/conversation/a8dJsfbn --data '{"messages": [{"$ref": "https://freedb.alice.com/chat/message/9sIzjYs8"}]}'
# {"id": "chat/conversation/a8dJsfbn", "messages": [{"$ref": "https://freedb.alice.com/chat/message/9sIzjYs8"}]}
```


```bash
bob> freedb -h alpha.freedb.io retrieve chat/conversation --q.sort created:descending -q.since "2018-06-28T21:14:48" --resolve
# [{"id": "chat/conversation/a8dJsfbn", "messages": [{"id": "chat/message/9sIzjYs8", "message": "Hi Bob!"}]}]

bob> freedb -h freedb.bob.com create chat/message --data '{"message": "Hello Alice"}'
# {"id": "chat/message/9sjfUiQf", "message": "Hello Alice"}

bob> freedb -h alpha.freedb.io append chat/conversation/a8dJsfbn --data '{"messages": [{"$ref": "https://freedb.bob.com/chat/message/9sIzjYs8"}]}'
# {"id": "chat/conversation/a8dJsfbn", "messages": [{"$ref": "https://freedb.alice.com/chat/message/9sIzjYs8"}, {"$ref": "https://freedb.bob.com/chat/message/9sjfUiQf"}]}
```

Since Alice has set a strict ACL for this conversation (other than her, only Bob can read or append messages), no one will be able to
see this conversation on `alpha.freedb.io`. But even if an attacker did gain access to `alpha.freedb.io`, all they would be
able to see is that a conversation took place between Alice and Bob, as well as the number of messages. Since the actual messages
are stored on Alice's and Bob's computers, the content of the conversation is totally safe!
