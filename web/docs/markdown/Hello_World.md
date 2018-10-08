# Hello World: Status Updates

In this minimal example, we'll create an app that lets the user post status updates, similar to Twitter.

Typically, when creating a new OneDB app, you would start by [creating a namespace](/Data_Schemas).
However, in this example, we will use the pre-built `status` namespace.

## Step 1: Add the OneDB Client

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
		onLogin: function(instance) {
		  startApp();
		},
		scope: [
          'status:read',
          'status:create',
        ],
	  });
    </script>
  </head>
</html>
```

[Read more](/Authorization) about authorization and data access.


## Step 2: Add a Login Form

The OneDB client comes with a login form that will allow users to choose which OneDB instance to use.
The default instance is the DataFire instance above.

```html
<html>
  <head>
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

## Step 3: Add the App

We'll add two elements for the app, which will be hidden until the user logs in:
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

## Step 4: Start the App

When the user logs in, we'll want to pull their latest status and display it. Notice that when
we initialized the client, we passed in the `onLogin` function, which will get called anytime
the user logs in or out of a OneDB instance. Let's make it a little more sophisticated:

1. We'll check to make sure the user is logging into their primary OneDB instance
2. We'll check if the user is logging in or out

```js
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
});
```

Then we define the `startApp` and `endApp` functions, which show and hide the app respectively:

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

## Step 5: Interact with the data

You'll notice that we've defined two functions above: `showLatestStatus()` and `postStatus()`.
These functions will add and retrieve data from the user's OneDB instance.

`showLatestStatus` uses `onedb.list` to get a list of the user's status messages.
Since we only care about the latest status, we set `limit = 1`, and sort by the creation date.

```js
function showLatestStatus() {
  // Get the user's last status message
  var query = {
    owner: onedb.hosts.primary.user.$.id,
    limit: 1,
    sort: 'info.created:descending',
  }
  onedb.list('status', 'status', query)
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
```

Now let's implement `setStatus()` using `onedb.create`:
```js
function setStatus() {
  var status = document.getElementById('StatusInput').value;
  onedb.create('status', 'status', {status: status})
      .then(function(statuID) {
        showLatestStatus();
      })
}
```

#### Side note: async/await
Note that the OneDB client
[JavaScript Promises](https://developers.google.com/web/fundamentals/primers/promises)
to make requests to OneDB instances. If you're using a transpiler like
[Babel](https://babeljs.io/) with ES2017 support, you can use `async/await` for easier syntax:

```js
async function showLatestStatus() {
  response = await onedb.list('status', 'list');
  console.log(response.items);
}
```

## Putting it all together

That's it! Here's the final code:

```html
<html>
  <head>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
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
          owner: onedb.hosts.primary.user.$.id,
          limit: 1,
          sort: 'info.created:descending',
        }
        onedb.list('status', 'status', query)
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
        onedb.create('status', 'status', {status: status})
            .then(function(statuID) {
              showLatestStatus();
            })
      }
    </script>
  </head>

  <body>
    <div class="container">
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
