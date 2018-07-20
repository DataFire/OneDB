# Alpha

The goal of the alpha release is a simple proof of concept. It leaves out many features, including:
* OAuth 2.0 support
* Data migration
* FreeDB Desktop
* Namespace versioning
* Payments

## Core features
* User registration
* ACL
* Data validation
* Token-based authorization
* JS client

## Constraints
* No private data
* Namespaces must have `alpha_` prefix
* Authorization limited to web apps

## Sample apps
* Markdown editor
* Chat
* To-do list

## TODO
* email verification
* password reset
* data $refs
* enforce alphanumeric keys
* per-user data limits
* `list` query params
  * sort
  * created_since
  * created_before
  * updated_since
  * updated_before
  * owner
  * field equality
* resolve $refs in client
* usernames
* `create` permissions
* more tests
* documentation

# Beta

The goal for the Beta release is to be able to support fully functional FreeDB apps.

## Namespace Versioning
* Auto-increment of major/minor version
* Ability to address old versions
* Always validate data against latest/specified version

## OAuth support
* Fine-grained permissions for each object type

## Decentralization
* Move type/namespace/user registration to a blockchain

## Sample apps
* Tooter
* Memegen
* Xword

# Stable

The goal for the Stable release is to have a full functionality and security.

## Security
* Full audit of security practices
* Support for public/private key authentication
* Ability to authorize apps, not just sites

## FreeDB Desktop
* Ability to register a subdomain for Desktop clients (in case IP address changes)
* Windows/OSX/Linux installers

## Payments
* Ability to move funds from one user to another
* Ability to charge for access to data

## Metadata
* content-types
* Usage rights

## Documentation
* Separate documentation website
* FreeDB Desktop how-to for end-users
* FreeDB Client how-to for web developers

## Sample Apps
* Have a running list of FreeDB apps anyone can contribute to
