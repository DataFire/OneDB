# End-to-end Example: Status Updates

Let's create an app that lets the user post status updates, similar to Twitter.
Here are the steps we'll take:

1. We'll [create a new namespace](/Create_an_App/Data_Schemas) for status updates

2. We'll create a single-page app that imports the OneDB JavaScript client

3. We'll add a [login form](/Create_an_App/Authorization) to our app

4. We'll add the basic user interface for viewing and writing status updates

5. We'll write some [code to move data](/Create_an_App/Client_API) between the user interface and OneDB

6. We'll tell the OneDB to start our app once the user has logged in

When we're done, we'll have a fully working, cloud-enabled app. And since it's only a frontend, we
can deploy it for free, without worrying about servers or databases.

> Want to jump to the end? The source code is [on GitHub](https://github.com/DataFire/OneDB/tree/master/apps/minimal), or you can scroll to the bottom of this page.

## Step 1: Create a Namespace
A namespace represents a set of related data schemas. For example, OneDB has a `chat` namespace, with
`message` and `conversation` schemas. Or we might have a `sales_and_marketing` namespace, with
schemas for `customer`, `product`, `meeting`, `email_campaign`, etc.

### Data schemas
In this example, we'll create the `status` namespace, which will only have a single schema, `statusUpdate`.
OneDB uses a subset of [JSON Schema](https://json-schema.org/) to describe each data type. Here's the
JSON Schema for `statusUpdate`:

##### `./types/statusUpdate.schema.json`
```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "maxLength": 280,
      "minLength": 1
    }
  }
}
```

This schema tells OneDB that a `statusUpdate` must have at least one character, and no more than 280.
For example, this is a valid `statusUpdate`:
```json
{
  "status": "Hello world!"
}
```

But these would be invalid:
```json
{
  "status": ""
}
```

```json
{
  "foo": "bar"
}
```

### Access control
In OneDB, all data is private by default. Since we're building a social app, we want
to change this behavior so that `statusUpdate`s are public by default. We can set the default
access control for `statusUpdate`s by adding the file `./types/statusUpdate.acl.json`:

##### `./types/statusUpdate.acl.json`
```json
{
  "allow": {
    "read": ["_all"]
  }
}

```

### Publishing your namespace
Namespaces are usually published to the OneDB instance at `one-db.datafire.io`. No matter where
the actual `statusUpdate` data lives, clients and servers will look here for the schemas.

To publish the namespace, install the OneDB CLI:
```bash
npm install -g onedb-cli
```

You'll also need a free OneDB account for `one-db.datafire.io`, which you can get at
[data.one-db.org](https://data.one-db.org).

> Note: you'll need to pick a unique name for your namespace, as `status` is already in use.

To register your namespace, run:
```bash
export ONEDB_USERNAME=me@example.com
export ONEDB_PASSWORD=thisisasecret
onedb namespace --name status --directory ./types
```

If you make changes to your namespace later, you can run the same command to publish an update.
All data will be marked with the version at which it was created, and you can later query
for data that matches particular versions.

## Step 2: Create a Single-page App
Now we'll write a little HTML to create an app that uses the `status` namespace.

First we'll import the OneDB client.
You can get the latest OneDB JavaScript client via `npm install onedb-client`, or use the unpkg CDN:

```html
<html>
  <head>
    <script src="https://unpkg.com/onedb-client/dist/onedb-client.min.js"></script>
  </head>
</html>
```

Now let's initialize the client, telling it what data we want access to:
```html
<html>
  <head>
    <script src="https://unpkg.com/onedb-client/dist/onedb-client.min.js"></script>
    <script>
	  window.onedb = new OneDBClient({
		scope: [
          'status:read',
          'status:create',
        ],
	  });
    </script>
  </head>
</html>
```

Note that the `scope`s field should use the name that you created when registering
your namespace. Available permissions are:
* read
* create
* write
* append
* delete
* modify_acl

If you want to learn more, [visit the Authorization page](/Create_an_App/Authorization) to read about authorization and data access.


## Step 3: Add a Login Form

The OneDB client comes with a login form that will allow users to choose which OneDB instance they want to use.
> Note: the OneDB login form looks best with [Bootstrap 4.0](https://getbootstrap.com/)

```html
<html>
  <head>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css">
    <!-- client import goes here -->
  </head>
  <body>
    <div id="LoginForm"></div>
    <script>
      document.getElementById('LoginForm').innerHTML = onedb.loginForm();
    </script>
  </body>
</html>
```

## Step 4: Build the User Interface

We'll add two elements for the user interface, which will be hidden until the user logs in:
* a `<p>` element that shows the user's status
* a `<form>` element that lets the user update their status

```html
<html>
  <head>
    <!-- client import goes here -->
  </head>
  <body>
    <!-- login form goes here -->
    <div id="App" style="display: none">

      <!-- show username and status -->
      <label>Your Status (<span id="Username"></span>):</label>
      <p id="LatestStatus"></p>

      <!-- let the user set a new status -->
      <form onsubmit="setStatus(); return false">
        <input type="text" id="StatusInput">
        <button type="submit">Set status</button>
      </form>

    </div>
  </body>
</html>
```

## Step 5: Interact with the data
Our app will have two main functions:
* `setStatus()` will take the message the user has typed in and send it up to OneDB
* `showLatestStatus()` will get the user's latest status from OneDB and display it in the UI

### Creating new data
Let's implement `setStatus()` using `onedb.create()`:

```js
function setStatus() {
  var status = document.getElementById('StatusInput').value;
  onedb.create('status', 'statusUpdate', {status: status})
      .then(function(statusID) {
        showLatestStatus();
      })
      .catch(function(error) {
        console.log(error)
      })
}
```

When calling `create()`, we pass in three things:
* The namespace (e.g. `status`) - be sure to change this to the unique name you picked when registering your namespace
* The type (e.g. `statusUpdate`)
* The data (e.g. `{status: "Hello world!"}`)

Like most OneDB functions, `create()` returns a
[JavaScript Promise](https://developers.google.com/web/fundamentals/primers/promises),
so we can use `.then()` to get the result, and `.catch()` to handle any errors.

#### Side note: async/await
The lastest versions of JavaScript support [async/await syntax](https://javascript.info/async-await),
which makes asynchronous code (like retrieving or creating OneDB data) much simpler.

### Retrieving data
`showLatestStatus()` will use `onedb.list()` to get a list of the user's status messages.
Since we only care about the latest status, we set `limit = 1`, and sort by the creation date.

```js
function showLatestStatus() {
  var query = {
    'info.created_by': onedb.hosts.primary.user.$.id,
    limit: 1,
    sort: 'info.created:descending',
  }
  onedb.list('status', 'statusUpdate', query)
      .then(function(response) {
        var status = '';
        if (response.items.length) {
          status = response.items[0].status
          // Make sure to sanitize the data, in case it includes HTML
          status = status.replace(/</g,"&lt;").replace(/>/g,"&gt;");
        } else {
          status = "<i>You haven't set your status yet. Use the form below to set your status</i>"
        }
        document.getElementById('LatestStatus').innerHTML = status;
      })
}
```

## Step 6: Start the App

When the user logs in, we'll initialize the app by finding their latest status. To do this,
we can pass an `onLogin` function to the `OneDBClient` constructor. This function will
get called anytime the user logs in or out of a OneDB instance.

We'll check two things inside the `onLogin` function:
1. We'll check to make sure the user is logging into their primary OneDB instance
2. We'll check if the user is logging in or out

```js
window.onedb = new OneDBClient({
  scope: [
    'status:read',
    'status:create',
  ],
  onLogin: function(instance) {
    if (instance === onedb.hosts.primary) {
      if (instance.user) {
        // User is logging in
        startApp();
      } else {
        // User is logging out
        endApp()
      }
    }
  },
});
```

Last, we define the `startApp` and `endApp` functions, which show and hide the app respectively:

```js
function startApp() {
  document.getElementById('Username').innerHTML = onedb.hosts.primary.user.$.id;
  document.getElementById('App').setAttribute('style', '')
  showLatestStatus();
}

function endApp() {
  document.getElementById('App').setAttribute('style', 'display: none')
}
```

## Putting it all together

That's it! Here's the final code:

```html
<html>
  <head>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css">
    <script src="./onedb.min.js"></script>
    <script>
	  window.onedb = new OneDBClient({
		onLogin: function(instance) {
          if (instance === onedb.hosts.primary) {
            if (instance.user) {
              // User is logging in
              startApp();
            } else {
              // User is logging out
              endApp()
            }
          }
		},
		scope: [
          'status:read',
          'status:create',
        ],
	  });

      function startApp() {
        document.getElementById('Username').innerHTML = onedb.hosts.primary.user.$.id;
        document.getElementById('App').setAttribute('style', '')
        showLatestStatus();
      }

      function endApp() {
        document.getElementById('App').setAttribute('style', 'display: none')
      }

      function showLatestStatus() {
        // Get the user's last status message
        var query = {
          'info.created_by': onedb.hosts.primary.user.$.id,
          limit: 1,
          sort: 'info.created:descending',
        }
        onedb.list('status', 'statusUpdate', query)
            .then(function(response) {
              var status = '';
              if (response.items.length) {
                status = response.items[0].status
                status = status.replace(/</g,"&lt;").replace(/>/g,"&gt;");
              } else {
                status = "<i>You haven't set your status yet. Use the form below to set your status</i>"
              }
              document.getElementById('LatestStatus').innerHTML = status;
            })
      }

      function setStatus() {
        var status = document.getElementById('StatusInput').value;
        onedb.create('status', 'statusUpdate', {status: status})
            .then(function(statusID) {
              showLatestStatus();
            })
      }
    </script>
  </head>

  <body>
    <div class="container">
      <h1>OneDB Status Updates</h1>
      <p>Log in below to set your status on OneDB</p>
      <div id="LoginForm"></div>
      <script>
        document.getElementById('LoginForm').innerHTML = onedb.loginForm();
      </script>
      <hr>

      <div id="App" style="display: none">
        <label>Your Status (<span id="Username"></span>):</label>
        <p id="LatestStatus"></p>
        <form onsubmit="setStatus(); return false">
          <input type="text" id="StatusInput">
          <button type="submit">Set status</button>
        </form>
      </div>
    </div>
  </body>
</html>
```
