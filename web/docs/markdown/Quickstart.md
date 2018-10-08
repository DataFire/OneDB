## Quickstart

In this quickstart example, we'll display the latest status updates that have been
posted to the OneDB instance at `one-db.datafire.io`.

For a more in-depth example, including instructions for authentication, see
[the Hello World page](/Hello_World).

The full code for this tutorial is at the bottom of the page.

### Import the Library

To get started with OneDB, you just need to import the JavaScript client into your frontend.

```html
<html>
  <head>
    <script src="https://unpkg.com/onedb-client/dist/onedb-client.min.js"></script>
  </head>
</html>
```

### Create the Client
Next we'll initialize a OneDB client. Usually you'll ask the user
which instance they want to use, but here we'll hardcode `one-db.datafire.io` as
the host:

```html
<html>
  <head>
    <script src="https://unpkg.com/onedb-client/dist/onedb-client.min.js"></script>
    <script>
      var onedb = new OneDBClient({
        hosts: {
          primary: {location: 'https://one-db.datafire.io'},
        }
      });
    </script>
  </head>
</html>
```

### Interacting with Data

Now that we have a client, we can retrieve publicly available data.

Note that to access private data or to save new data, you'll need the user to log in.
See the [Hello World](/Create_an_App/Hello_World) example for more details.

```html
<html>
  <head>
    <script src="https://unpkg.com/onedb-client/dist/onedb-client.min.js"></script>
    <script>
      var onedb = new OneDBClient({
        hosts: {
          primary: {location: 'https://one-db.datafire.io'},
        }
      });
    </script>
  </head>
  <body>
    <h2>Latest status updates</h2>
    <div id="Statuses"></div>
    <script>
      onedb.list('status', 'status', {sort: 'info.created:descending'})
        .then(function(response) {
          document.getElementById('Statuses').innerHTML =
              response.items.map(function(item) {
                var html = '<h4>' + item.$.info.created_by + '<small> wrote:</small></h4>';
                html += '<p>' + item.status + '</p>';
                return html;
              }).join('\n')
        })
    </script>
  </body>
</html>
```
