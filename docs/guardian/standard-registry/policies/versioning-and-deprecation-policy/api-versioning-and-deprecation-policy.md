---
description: This policy comes into effect beginning with Guardian 3.0
---

# ℹ️ API Versioning & Deprecation Policy

Guardian platform is evolving rapidly, new capabilities are frequently introduced which expand the set of supported use-cases. Changes in the underlying platform functionality inevitably get reflected in the API - to expose them to the end users and enable the development of new applications and/or new integrations. This can result in some features being removed, i.e. some APIs becoming obsolete, which necessitates changes in 3rd party applications which relied on them.

To manage and coordinate this process Guardian follows a deprecation policy for aspects of the API that are scheduled to be removed.

### API Versioning

The Guardian API is versioned using “Header Versioning” method as described in [Nest.js versioning guide](https://docs.nestjs.com/techniques/versioning). Each endpoint is versioned independently to minimize required changes in client applications via fine-grained scope management. All endpoints provide ‘default’ version API, which is used by the server when no version has been specified by the client.

The API uses simple incremental numeric versioning (e.g. version ‘1’, version ‘2’, etc) to simplify tracking and management. Versions are incremented when the code update introduced breaking changes. Currently only a subset of endpoints provide non-default API versions, as only these endpoints have had breaking changes introduced to their specification.

### Compatibility policy

Wherever possible, API resources, operations, parameters, and models are kept backward compatible with earlier versions. A new API element is created if/when it is necessary to make a non-backward compatible change. The old API element is maintained in accordance with the API deprecation policy.

#### Non-Breaking changes

The non-breaking changes to the API which do not warrant the change in the version number include two types:

* Additions
  * New optional fields and headers
  * New allowed value
  * New HTTP method to an API interface
  * New resource URI extending existing endpoint
  * New error condition covered by an existing error message
* Changes in the description

#### Breaking changes

* Removing an API endpoint, HTTP method or enum value
* Renaming an API endpoint, HTTP method or enum value
* Changing the type of the field
* Changing behaviour of an API requests

### Deprecation policy

Deprecation notice is used to inform the API users that a specific API facility is now considered obsolete and thus no longer advised for the use in applications. The notice is issued at least 3 months before the end-of-life date.

The notice is issued via Swagger, where API being deprecated are marked with the deprecated tag, and via the Release Notes where the end-of-life date is also specified.

An API may be changed without prior warnings if the existing behaviour if invalid or to patch a security vulnerability.
