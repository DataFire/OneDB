# OneDB Roadmap

This document lists some key features that are being planned or in development.

## Group ACLs
We will need the ability to organize many users into a group, and grant that group
permission to read/write/append/delete particular documents.

Currently, if we want to have a private chat with 10 users, each message
would need to add `read` permission for each of the existing users. If we want to add a new
user to this chat group, we would need to retroactively add `read` permission for this user
to every message in the chat.

With Group ACLs, all these members will belong to a group with a single ID. Some subset of users
will have permission to add/remove new users. Every message in the conversation will have an ACL
pointing to the Group ID (rather than individual user IDs), so that when users are added/removed,
their permissions automatically change.

## Native Authentication and Authorization
Currently, while the auth mechanism looks much like OAuth 2.0, there is no app registration process,
so anyone can request an authentication token by sending the user a link to the authentication page.

When showing the user the authentication page, OneDB prominently displays the domain of the
origin website, and if the user approves, OneDB uses `postMessage` to pass the authentication token
to the origin domain. This ensures that the user understands the identity of the token recipient.

For Android, iOS, and Desktop apps, however, we don't have a domain name, and therefore can't
guarantee identity. We will have to add some extra language to warn the user
(e.g. "Make sure you trust the person or application that sent you this link"),
and create a new mechanism for passing the token (since `postMessage` won't work).

There are a few possible solutions:
1. **Have the app register with every possible instance the user might want to authenticate with.**
OneDB would then create a document with the access token which could only be read by that app.
This is not ideal, because the app still needs a backend component to fetch the token, and it would
preculde the user from using their own OneDB instance
2. **Have the user copy and paste the access token into the app.**
Reasonably secure, but a pretty clunky user experience
3. **Have the app create a high-entropy retrieval code.** This code would then be used to grab
the access token from OneDB, and the token would be deleted upon retrieval, or quickly expire.
The retrieval code would have to be sufficiently hard to guess, so that an attacker couldn't grab it
between creation and retrieval. OneDB could expose a public endpoint for generating retrieval codes.

Number 3 is probably the best solution, as it leaves us with a simple/familiar user experience
(identical to OAuth), requires no backend component, and is reasonably secure.

## Identity Management
Since data will be spread across the OneDB network, users will need to have an identity on
many different instances. We should create a mechanism (likely using public key cryptography)
for linking identities across instances, allowing a user to log in only once.

## Payments and Subscriptions
Each instance should be able to set its fee structure:
* X MB and Y Documents for free
* X' MB and Y' Documents for every $Z/month

Ideally payments would be handled by a configurable plugin, which could be directed to Square, Stripe, etc.

## Flagging and Moderator APIs
Managing and responding to abusive content is hard. If you create an app on OneDB, you will want
some recourse to be able to hide or remove data that is offensive or abusive.

Each instance should be able to specify a set of users who are moderators for a given namespace.
Any document in OneDB should be able to be "flagged" by any user, and moderators should be alerted
when a document receives >X flags.

We may want to just "hide" data that has been removed by moderators (rather than permanently deleting),
but may also need some recourse to permanently delete illegal content.

## Websockets and Webhooks
Currently, if you want to watch for new data, you have to poll each OneDB instance at some interval.
This can be expensive, and since each OneDB instance sets its own rate limits, it can also be tricky.

Webhooks and websockets will allow the OneDB instance to actively reach out to clients to inform
them of new or changed data.

## iOS and Android clients
Depends on implementing authorization for native apps. We will also want
to create clients for various programming languages.

## Desktop Server
We would like end-users to be able to easily host data on their local harddrive. However,
since their IP address may change, we'll also want to provide users with a dynamic subdomain
(e.g. username.one-db.org) that can point to their current OneDB instance.

## Data Migration
Users should be able to migrate all data from one OneDB instance to another. This might just
be a client-side script.

