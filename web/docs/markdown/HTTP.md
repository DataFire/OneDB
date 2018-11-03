# HTTP API

While the easiest way to communicate with OneDB is via the JavaScript client,
you may be working in a different programming language. In this case, you can use the HTTP API.

## Authorization
The HTTP API supports both Basic and Bearer authentication.

### Basic auth
Basic auth uses a username and password. You need to base64-encode the username and password -
examples can be [found here](https://gist.github.com/brandonmwest/a2632d0a65088a20c00a)

```
Authorization: Basic abcde
```

### Bearer auth
You can generate a bearer token by sending a request to `POST /users/authorize` using
basic auth. This will return a token that can be put in the Authorization header.

The query parameter `scope` can be used to create a bearer token that is scoped to particular
operations, e.g. `POST /users/authorize?scope=core:create+core:read`

```
Authorization: Bearer abcde
```

## Data
OneDB data operations are available under `/data/:namespace/:type`

### Retrive
To retrieve a single item:

```
GET /data/:namespace/:type/:id
```

### List
To get a list of items:

```
GET /data/:namespace/:type
```

#### Query Parameters
* pageSize - number of items to return
* skip - number of items to skip

All dates are [ISO 8601 encoded](https://en.wikipedia.org/wiki/ISO_8601)
* info.created_before - only return items created before this date
* info.created_since - only return items created since this date
* info.updated_before - only return items updated before this date
* info.updated_since - only return items updated since this date

You can also query based on the data. For example, might have `person` type with an `age` field.
This request will return all people with age 23:
```
GET /data/people/person?age=23
```

If the field is an array, you can query for the contents of the array. This request will
return all people with the tag `athlete`:

```
GET /data/people/person?tags=athlete
```

You can also issue queries that search for items that contain **all** the tags you specify.
This request will return all people with **both** the `athlete` **and** `musician` tags:

```
GET /data/people/person?tags=athlete,musician
```

You can also issue queries that search for items that contain **any** of the tags you specify.
This querest will return all people with **either** the `athlete` **or** `musician` tags:

```
GET /data/people/person?tags=athlete|musician
```

### Create
To create a new item use:
```
POST /data/:namespace/:type
```
This will auto-assign an ID to your new item. You can also specify the ID you want:
```
POST /data/:namespace/:type/:id
```

You must include the header `Content-Type: application/json`. The request body
must be a JSON document that conforms to the type's schema.

### Update
To update an item use:
```
PUT /data/:namespace/:type/:id
```

You must include the header `Content-Type: application/json`. The request body
must be a JSON document that conforms to the type's schema.

### Append
To add data to an array use:
```
PUT /data/:namespace/:type/:id
```
You must include the header `Content-Type: application/json`. The request body
must be a JSON document that conforms to the type's schema, with only array fields specified.

### Delete
To delete an item use:
```
DELETE /data/:namespace/:type/:id
```

### Update ACL
To update an item's ACL, use:
```
PUT /data/:namespace/:type/:id/acl
```

You must include the header `Content-Type: application/json`. The request body
must be a valid ACL. Only the specified fields will be updated.

