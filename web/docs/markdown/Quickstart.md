## Quickstart

### Import the Library

To get started with OneDB, you just need to import the JavaScript client into your frontend.

```html
<html>
  <head>
    <script src="https://unpkg.com/onedb-client/dist/onedb-client.min.js"></script>
  </head>
</html>
```

### User Login
The client comes with a helper function for generating a log in form. When creating the client,
you'll also need to specify the permissions you're requesting - here we ask to read and create
the user's `status` data.

```html
<html>
  <head>
    <script src="https://unpkg.com/onedb-client/dist/onedb-client.min.js"></script>
  </head>
  <body>
    <div id="LoginForm"></div>
    <script>
      onedb = new OneDBClient({
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
  </body>
</html>
```

### Interacting with Data

Once the user is logged in, you can start interacting with their data:

```js
onedb.create('status', 'status', {status: "Hello world!"})
    .then(function(statusID) {
      console.log("Created status");
    })
```

```js
var query = {
  owner: onedb.hosts.primary.user.$.id,
  limit: 1,
  sort: 'info.created:descending',
};
onedb.list('status', 'status', query)
    .then(function(response) {
      console.log(response.items[0].status); // "Hello world!"
    })
```



