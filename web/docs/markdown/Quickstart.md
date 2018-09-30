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

### Create the Client
Next we'll initialize a OneDB client. Usually we'll ask the user
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
    <div id="Statuses"></div>
    <script>
      onedb.list('status', 'status', {sort: 'info.created:descending'})
        .then(function(response) {
          document.getElementById('Statuses').innerHTML =
              response.items.map(function(item) {
                var html = '<span>' + item.$.info.created_by + ':</span>';
                html += '<p>' + item.status + '</p>';
                return html;
              }).join('\n')
        })
    </script>
  </body>
</html>
```
