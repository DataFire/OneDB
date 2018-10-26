# Data Schemas

## Schemas

All the data in OneDB conforms to a particular [JSON Schema](https://json-schema.org/).
This allows you to dictate exactly what your
app's data should look like, as well as define validation parameters,
like regular expressions, max/mins, and required fields.

For example, we might have a `tweet` schema:

```json
{
  "type": "object",
  "required": ["message"],
  "properties": {
    "message": {
      "type": "string",
      "maxLength": 140,
      "minLength": 1
    }
  }
}
```

This tells OneDB that a `tweet` must have a string `message`, which is between 1 and 140 characters.

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

Then use the OneDB CLI to register your namespace:

```bash
npm install -g onedb-cli

export ONEDB_USERNAME=me@example.com
export ONEDB_PASSWORD=thisisasecret
onedb namespace --directory ./types --name my_twitter
# Created namespace my_twitter
```

### Schema Refs
You can reference other schemas within your namespace by using `$ref` pointers.
For example, say we have a `petstore` namespace with a `pet` and `owner` schema:

##### `types/pet.schema.json`
```json
{
  "title": "Pet",
  "type": "object",
  "properties": {
    "name": {"type": "string"},
    "age": {"type": "integer", "minimum": 0}
  }
}
```

##### `types/owner.schema.json`
```json
{
  "title": "Owner",
  "type": "object",
  "properties": {
    "name": {"type": "string"},
    "pets": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/pet"
      }
    }
  }
}
```

Note the `$ref` in the owner schema, under `properties/pets/items`. The `pet` keyword
comes from the name of the file `types/pet.schema.json`.

When an `owner` object is uploaded to OneDB, any `pets` in the array will get broken
out into their own `pet` documents. When an `owner` is retrieved from OneDB, the
OneDB client will populate the `pets` array.

However, if the data is unavailable, the client will leave the `$ref` there.
Learn more about [hosting data across multiple instances](/Create_an_App/Multiple_Instances.md)

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

Of course, the owner would still be able to modify the ACL to make the tweet private.
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
* `delete` - delete the data

## JSON Schema Support
OneDB uses a subset of JSON Schema 7. We also enforce a few key constraints:
* Top-level schemas must be of type `object`
* Top-level schemas must have `additionalProperties` set to `false` (or unspecified)
* Property names must be alphanumeric (including underscores)

OneDB currently supports the following JSON Schema keywords:

* `title`
* `description`
* `type`
* `properties`
* `maxProperties`
* `minProperties`
* `required`
* `additionalProperties`
* `items`
* `maxItems`
* `minItems`
* `default`
* `examples`
* `multipleOf`
* `maximum`
* `exclusiveMaximum`
* `minimum`
* `exclusiveMinimum`
* `maxLength`
* `minLength`
* `pattern`
* `uniqueItems`
* `const`
* `enum`
* `not`

We do not support `oneOf`, `allOf` or `anyOf` due to the potential for computationally expensive validation. We will also attempt to detect and disallow `pattern` regex that are computationally expensive.
