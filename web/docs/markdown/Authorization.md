# Authentication and Authorization

OneDB has two authentication mechanisms available:
* Basic authentication (username and password)
* Bearer authentication (temporary access tokens)

Bearer authentication is always preferred, as tokens are temporary, and can be scoped
to a small set of operations.

To generate a bearer token, you can use cURL:

```
curl -X POST \
  https://one-db.datafire.io/users/authorize?scope=core:read \
  --user me@example.com:mypassword
# "eyJhbGciOi.eyJlbWFpb"
```

## Authorizing your Users
The OneDB Authentication process works similar to OAuth 2.0. Your users will be sent
to the OneDB instance of their choice, and will be shown the list of permissions you're requesting.
If they accept, you'll receive an access token that allows you to perform those actions on the
user's behalf.


The easiest way to do this is with the JavaScript client. It will generate an HTML form that
allows the user to choose their instance.

```html
<html>
  <head>
    <script src="https://unpkg.com/onedb-client/dist/onedb-client.min.js"></script>
  </head>
  <body>
    <div id="LoginForm"></div>
    <script>
	  window.onedb = new OneDBClient({
		onLogin: function(instance) {
          console.log(instance);
		},
		scope: [
          'status:read',
          'status:create',
        ],
	  });
      document.getElementById('LoginForm').innerHTML = onedb.loginForm();
    </script>
  </head>
</html>
```

## Responding to Authorization Events

When a user logs in, the `onLogin` function will be called with information about
the user and the instance they've chosen:

```js
window.onedb = new OneDBClient({
  onLogin: function(instance) {
    console.log(instance.location); // https://one-db.datafire.io
    if (!instance.user) {
      console.log("User is logged out")
    } else {
      console.log(instance.user.$.id);
      console.log(instance.user.token);
    }
  }
})
```

Before you start your app, you should make sure the user has logged into their primary instance.
The primary instance is where the client will store and retrieve data.

```js
window.onedb = new OneDBClient({
  onLogin: function(instance) {
    if (instance === onedb.hosts.primary && instance.user) {
      startApp()
    }
  }
})
```

### Saving and Restoring Sessions

You can use `localStorage` or cookies to save your user's session and restore it when they log back in:

```js
var SESSION_KEY = 'session';
var previousSession = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
window.onedb = new OneDBClient({
  hosts: previousSession,
  onLogin: function(instance) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(onedb.hosts));
  }
})
```
