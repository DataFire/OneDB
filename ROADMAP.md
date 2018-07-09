# Alpha

The goal of the alpha release is a simple proof of concept. It leaves out many features, including:
* Access control
* OAuth 2.0 support
* Data migration
* FreeDB Desktop
* Namespace versioning

## Security
* Strict rate limiting
* Email verification?

## Namespace and Type registration
* Should use `core/namespace` and `core/type` as types
* Implement JSON Schema validation using meta spec
* Add additional schema validation:
  * Keys must be alphanumeric
  * $refs are converted into IDs

## Data CRUD
* create
  * JSON schema validation
  * limits on size and number of docs
  * set `id`, `owner`, `created` fields
    * 8 alnum characters ~= 200 trillion possibilities
    * reject duplicate IDs
* retrieve
  * $ref resolution in client
* list
  * sort
  * created_since
  * created_before
  * updated_since
  * updated_before
  * owner
  * field equality
* modify
  * set `updated` field
* destroy

## User registration
* Should use `core/user` as a type
* Implement passphrase-based registration and login

## Client
* Should offer basic functionality
* Should resolve `$ref`s
* Browser distribution
* Documentation on GitHub

## Server
* Developers should be able to host their own FreeDB instance

## Sample apps
* Markdown editor

# Beta

The goal for the Beta release is to be able to support fully functional FreeDB apps.

## Access Control
* Implement `append` operation
* Implement fine-grained ACL for all data

## Data Migration
* Implement `migrate` command to copy data from one server to another

## Namespace Versioning
* Auto-increment of major/minor version
* Ability to address old versions
* Always validate data against latest/specified version

## Sample apps
* Tooter
* Memegen
* Xword
* To-do list
* Markdown editor

# Stable

The goal for the Stable release is to have a full functionality and security.

## Security
* Full audit of security practices
* Better support for custom public/private keys
* OAuth 2.0 support - scopes for every type/operation combo
* Copious testing of data validation and ACL

## FreeDB Desktop
* Ability to register a subdomain for Desktop clients (in case IP address changes)
* Windows/OSX/Linux installers

## Documentation
* Separate documentation website
* FreeDB Desktop how-to for end-users
* FreeDB Client how-to for web developers

## Sample Apps
* Have a running list of FreeDB apps anyone can contribute to
