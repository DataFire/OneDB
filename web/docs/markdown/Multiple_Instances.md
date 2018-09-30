## Hosting Data across Multiple Instances

One of the benefits of OneDB is that users can store their data anywhere, and
data stored on different instances can be collated into a single user experience.

As an example, let's pretend we've got a chat application built on OneDB. Suppose we have
two users, Alice and Bob. Both Alice and Bob are very privacy conscious, and host their own
private OneDB instances to store data.

In our example, data will be stored in three places:
* Alice's messages to Bob will be stored on her instance, at `one-db.alice.com`
* Bob's messages to Alice will be stored on his instance, at `one-db.bob.com`
* The conversation (i.e. the order of messages) will be stored on the public instance, at `one-db.datafire.io`

To make this happen, Alice will need to log in to all three servers:
1. She will set her Primary Host to `one-db.alice.com`
2. She will add a Broadcast Host pointing to `one-db.datafire.io`
3. She will add a Secondary Host pointing to `one-db.bob.com`


### Creating Data
When Alice composes a message and hits send, the app's code will make the following call to the client:

```js
onedb.create('chat', 'message', {
  conversationID: "alice_and_bob",
  message: "Hi there, Bob!"
});
```

This will do two things:
1. It will post the message to `one-db.alice.com`. The document will look like
```json
{
    "message": "Hi there, Bob!",
    "conversationID": "alice_and_bob",
    "$": {
      "info": {
        "created_by": "alice",
        "created_at": "2018-09-17T18:50:48.276Z"
      }
    }
}
```

2. It will broadcast a reference to the message to `one-db.datafire.io`. The document will look like:
```json
{
    "$ref": "https://one-db.alice.com/data/chat/message/AcS6Si8",
    "$": {
      "info": {
        "created_by": "alice",
        "created_at": "2018-09-17T18:50:49.152Z"
      }
    }
}
```

Note that the message itself stays on Alice's servers - the public OneDB instance only knows
when the message was written.

### Retrieving Data

When Bob retrieves the conversation, a few things will happen behind the scenes:
1. The app will pull a list of the latest messages from `one-db.datafire.io`:
```js
onedb.list('chat', 'message', {
    "data.conversationID": "alice_and_bob",
    "sort": "info.created_at:descending",
})
```
2. The client will find the `$ref` pointing to `https://one-db.alice.com/data/chat/message/AcS6Si8`
3. The client will reach out to `one-db.alice.com`, using Bob's credentials, to download the contents of the `$ref`
4. The client will return the resolved set of messages:
```json
[{
    "message": "Hi there, Bob!",
    "conversationID": "alice_and_bob",
    "$": {
      "info": {
        "created_by": "alice",
        "created_at": "2018-09-17T18:50:49.152Z"
      }
    }
}]
```

### Missing Data

But what if Alice's server goes down? Or if Alice delete's her messages?
Bob will no longer be able to retrieve the contents of Alice's messages.

In this case, the client will leave the `$ref` pointers, so your app can display an error message.
The client will return something like this:
```js
[{
  "$ref": "https://one-db.alice.com/data/chat/message/AcS6Si8",
  "$": {
    "info": {
      "created_by": "alice",
      "created_at": "2018-09-17T18:50:49.152Z"
    }
  }
}]
```
