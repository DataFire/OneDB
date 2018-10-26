## Quickstart

In this quickstart example, we'll display the latest status updates that have been
posted to the OneDB instance at `one-db.datafire.io`.

For a more in-depth tutorial, including instructions for authentication, see
[the end-to-end example](/Create_an_App/End_to_end_Example).

> Want to jump to the end? The source code is [on GitHub](https://github.com/DataFire/OneDB/tree/master/apps/minimal), or you can scroll to the bottom of this page.

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
See the [end-to-end example](/Create_an_App/End_to_end_Example) for more details.

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
              for (var i = 0; i < response.items.length; ++i) {
                  console.log(response.items[i].status);
              }
          });
    </script>
  </body>
</html>
```

### Display the Results

Now we just need to take the status updates we retrieved from OneDB and display them on the webpage.
The code below is a full working example, and will generate a webage that looks like this:

![Quickstart Results](assets/img/quickstart_screenshot.png)

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
              var el = document.getElementById('Statuses');
              for (var i = 0; i < response.items.length; ++i) {
                  el.innerHTML += getHTMLForStatusUpdate(response.items[i])
              }
          });
      function getHTMLForStatusUpdate(statusUpdate) {
          var info = statusUpdate.$.info;
          var html = '<h4>' + info.created_by + '</h4>';
          html += '<i>wrote on ' + new Date(info.created).toDateString() + '</i>';
          var statusElement = document.createElement('p');
          statusElement.textContent = statusUpdate.status;
          html += statusElement.outerHTML;
          return html;
      }
    </script>
  </body>
</html>
```
