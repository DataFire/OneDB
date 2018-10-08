# Client API
This page will show you how to interact with OneDB data using the JavaScript client

## Installation
You can install via `npm`, or use [unpkg](https://unpkg.com/)

```bash
npm install --save onedb-client
```

or

```html
<script src="https://unpkg.com/onedb-client/dist/onedb-client.min.js"></script>
```

#### Note on Promises
The OneDB client uses [JavaScript promises](https://developers.google.com/web/fundamentals/primers/promises).
This means you can also use [async/await syntax](https://javascript.info/async-await), if it's supported
by your environment.

#### Note on Hosts
Each of the operations below has an optional `host` argument, which tells the client which OneDB server
to interact with. By default, this will be the `primary` host, but you can specify other hosts as well:

```js
onedb.list('status', 'status', {}, onedb.hosts.secondary[0]);
onedb.list('status', 'status', {}, {location: 'https://one-db.example.com'});
```

## Constructor

```js
var onedb = new OneDBClient(options);
```

where options is an object which can contain any of the following:
* `hosts` - an object containing OneDB instances to connect to, optionally with credentials. You can use this to restore a previous session. See below for what each `host` should look like.
* `hosts.core` - the core host, where data models will be pulled from
* `hosts.primary` - the primary host, where new data will be stored, and data will be pulled by default
* `hosts.secondary` - a array of alternative read-only data hosts. If the `primary` host returns data that references another host, OneDB will look here for authentication details
* `hosts.broadcast` - an array of hosts which will be notified of any changes to the primary host
* `onLogin` - a function that will be called any time the user logs in or out of an instance
* `scope` - an array of permissions to request when logging into a new instance

Each host object can contain the following properties:
* `location` (required) - the URL of the host, e.g. `https://one-db.datafire.io`
* `token` - an access token for this host. This is the preferred method of authentication, though username and password can also be used
* `username` - a username for this host
* `password` - a password for this host

For example:

```js
var onedb = new OneDBClient({
  hosts: {
    primary: {
      location: 'https://one-db.datafire.io',
    }
  },
  scope: ['status:read'],
  onLogin: function(instance) {
    if (instance === onedb.hosts.primary) {
      if (instance.user) {
        console.log("logged in as " + instance.user.$.id);
      } else {
        console.log("logged out");
      }
    }
  }
})
```

More information on each of these options can be found on [the Authorization page](/Create_an_App/Authorization).

## Get
Retrieve a single item from OneDB.

`onedb.get(namepace, type, id [, host])`


```js
onedb.get('status', 'status', 'ABCDE')
   .then(function(result) {
     console.log(result);
   })
```

The result will always be an object. The reserved property `$` will contain metadata about the object:

```js
onedb.get('status', 'status', 'ABCDE')
   .then(function(result) {
     console.log(result.$.id);              // ABCDE
     console.log(result.$.owner);           // john_doe
     console.log(result.$.info.created_by); // john_doe
     console.log(result.$.info.created);    // 2018-10-08T16:00:56.021Z
     console.log(result.$.info.updated);    // 2018-10-08T16:00:56.021Z
   })
```

## List
Retrieve many items from OneDB.

`onedb.list(namespace, type, [, options][, host])`

```js
onedb.list('status', 'status')
    .then(function(result) {
      console.log('Found a total of ' + result.total + ' items');
      console.log('Retrieved the first ' + result.items.length + ' items');
      for (let item of result.items) {
        console.log(item.$.id, item.$.info.created_by, item.status);
      }
    });
```

The `options` object allows you to sort and filter the data.

#### Sorting
You can sort both by the object's metadata (e.g. creation date or time updated), and by
the data inside the object.

By default, results are sorted by the time they were last updated, with the most recently updated
items appearing first, i.e. `info.updated:descending`

```js
onedb.list('status', 'status', {sort: 'data.status:ascending'})
    .then(function(result) {
      console.log(result.items[0]);  // Aardvark
      console.log(result.items[1]);  // Baboons
      console.log(result.items[2]);  // Cobras
      console.log(result.items[3]);  // Dingos
    })
```

#### Filtering
You can filter for data created or updated within a particular time range using the following options:
* `created_since`
* `created_before`
* `updated_since`
* `updated_before`

Each option takes in a `Date` object or an ISO formatted date string.
For example, to get every status update from January 2018:

```js
var startDate = new Date(2018,0,1); // Jan 1, 2018
var endDate = new Date(2018, 1, 1); // Feb 1, 2018
onedb.list('status', 'status', {
  created_since: startDate,
  created_before: endDate,
}).then(function(result) {
  console.log(result.total + ' status updates in January 2018')
})
```

You can also filter by exact matches on the data:
```js
onedb.list('status', 'status', {'data.status': "Hello"})
    .then(function(result) {
      for (let item of result.items) {
        console.log(item.status); // "Hello"
      }
    })
```

## Create
Create a new item in OneDB

`onedb.create(namespace, type [, id], data [, host])`

For example:
```js
onedb.create('status', 'status', {status: "Hello world!"})
    .then(function(id) {
      console.log("Created status with ID " + id);
    })
```

By default, the ID will be a randomly generated 8-character string. You can also specify the ID
you want:
```js
onedb.create('status', 'status', 'my_update_1234', {status: "Hello world!"})
    .then(funciton(id) {
      console.log(id); // my_update_1234
    })
```

## Update
Modify an existing item in OneDB

`onedb.update(namespace, type, id, data [, host])`

For example:

```js
onedb.update('status', 'status', 'my_update_1234', {status: "Goodbye world!"})
    .then(function() {
      console.log("Successfully updated status");
    })
```

## Append
Add to an array in an existing item in OneDB.

`onedb.append(namespace, type, id, data [, host])`

```js
onedb.update('petstore', 'pets', 'rover', {nicknames: ["Doggo"]})
    .then(function() {
      console.log("Successfully updated status");
    })
```

This operation only works on arrays that are in the top-level of the item. For example, in the item below,
we can append to `nicknames` but not `vaccinations`:

```js
{
  name: "Rover",
  nicknames: ["Spot", "Doggo"],
  medical_history: {
    vaccinations: ["Bordetella"],
  }
}
```

## Delete
Permanently delete an item from OneDB.

`onedb.delete(namespace, type, id [, host])`

For example:

```js
onedb.delete('status', 'status', 'my_update_1234')
    .then(function() {
      console.log("Successfully deleted status update");
    })
```

## Get ACL
Retrieve access control list for a particular item

`onedb.getACL(namespace, type, id [, host])`

For example:

```js
onedb.getACL('status', 'status', 'my_update_1234')
    .then(function(acl) {
      console.log(acl.allow.read);    // ["_owner"]
      console.log(acl.disallow.read); // []
    })
```

## Update ACL
Change one or more fields in the access control list for a particular item

`onedb.updateACL(namespace, type, id, acl [, host])`

For example:

```js
onedb.updateACL('status', 'status', 'my_update_1234', {allow: {read: ['_all']}})
    .then(function() {
      console.log("Successfully updated ACL");
    })
```
