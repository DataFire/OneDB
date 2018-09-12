# Data Schemas

All the data in FreeDB conforms to a particular schema. For example, we might have a `tweet` schema:

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "maxLength": 140,
      "minLength": 1
    }
  }
}
```

This tells FreeDB that a `tweet` must have a string `message`, which is between 1 and 140 characters.

## Namespaces

A namespace is a set of schemas. When you register a namespace, you become the owner of that namespace.
Only you can update your namespace with new schemas, but anyone else can see and use your namespace.

To create a namespace, you'll need to work on the command line. First create a new folder:

```bash
mkdir types
```

Then create a schema in that folder, e.g. `types/tweet.schema.json`:
```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string"
    }
  }
}
```

Then use the FreeDB CLI to register your namespace:

```bash
export FREEDB_USERNAME=me@example.com
export FREEDB_PASSWORD=thisisasecret
freedb register --directory ./types --name my_twitter
# Created namespace my_twitter
```

## Access Control

By default, new objects created with your schema will only be visible to the creator,
and the creator will be able to modify and delete the object.

You may want to modify the default access control. For example, we can make tweets
readable by everyone. To do this, create `types/tweet.acl.json`:

```json
{
  "allow": {
    "read": ["_all"]
  }
}
```

Of course, the owner would still be able to modify the ACL to make his tweet private.
If you want to disable this, and force all tweets to be public,
you can remove the owner's ability to change the `read` ACL:

```json
{
  "allow": {
    "read": ["_all"]
  },
  "modify": {
    "read": []
  }
}
```

Note that regulations such as GDPR may require instance owners to disable certain
ACL patterns (e.g. not allowing users to delete their data), and that instance owners
will always have full read/write access to the data.

### ACL options
There are three top-level options for access control:
* `allow` - usernames listed here are white-listed for access
* `disallow` - usernames listed here are black-listed from access
* `modify` - usernames listed here can modify `allow`, `disallow`, and `modify`

Within each top-level option, the following access types can be set:
* `read` - view the data
* `write` - modify the data
* `append` - add to arrays in the data
* `destroy` - delete the data
