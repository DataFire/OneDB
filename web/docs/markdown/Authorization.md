# Authentication and Authorization

OneDB has two authentication mechanisms available:
* Basic authentication (username and password)
* Bearer authentication (temporary access tokens)

Bearer authentication is always preferred, as tokens are temporary, and can be scoped
to a small set of operations.

To generate a bearer token, you can use cURL:

```
curl -X POST \
  "https://one-db.datafire.io/users/authorize?scope=core:read&expires_in=-1" \
  --user me@example.com:mypassword
# "eyJhbGciOi.eyJlbWFpb"
```

### Query parameters
* scope - a space separated list of scopes, e.g. `core:read+core:create` See **Scopes** below for more information.
* expires_in - the number of seconds until this token expires. Set to `-1` to never expire. Default is 1 day.

## Authenticating your Users
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

You can tell the client to display the login form inside an iframe rather than a new tab:
```js
window.onedb = new OneDBClient({
  iframe: true,
  onLogin: function(instance) {
    console.log(instance);
  },
  scope: [
    'status:read',
    'status:create',
  ],
});
```

## Scopes
You need to request permission for each namespace you want to interact with. Above,
we asked for `read` and `create` permission for the `status` namespace.

For each namespace, the following permissions are available:

* `read` - Ability to view data in this namespace
* `create` - Ability to create new data in this namespace
* `write` - Ability to modify data in this namespace
* `append` - Ability to add new items to arrays in this namespace
* `delete` - Ability to permanently delete data in this namespace
* `modify_acl` - Ability to change who is allowed to perform the above operations in this namespace

You can see a list of all currently available namespaces at `https://one-db.datafire.io/data/core/namespace`,
or see [the Data Schemas page](/Create_an_App/Data_Schemas) for information on creating a new namespace.

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
      console.log(instance.token);
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
