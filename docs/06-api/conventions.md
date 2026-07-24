# API Conventions

Version: 1.0

---

# Purpose

The API Conventions define the standards that every API endpoint in the Suro & Buya AI Engine must follow.

These conventions ensure that all APIs behave consistently regardless of the underlying engine implementation.

Consistency improves usability, maintainability, and developer experience.

---

# Objective

Provide a unified specification for:

- endpoint naming
- HTTP methods
- request structure
- response structure
- resource identifiers
- data formats
- status codes
- error handling

The API should feel predictable.

---

# Design Principles

The API follows these principles:

- Consistent
- Predictable
- Resource-Oriented
- Human Readable
- Versioned
- Stateless

Every endpoint should look and behave similarly.

---

# Naming Convention

Resources use lowercase nouns.

Good

```
/story

/episode

/character

/review
```

Avoid

```
/GetStory

/CreateEpisode

/GenerateDialogue
```

Resources represent business objects, not actions.

---

# URI Structure

The standard URI format is:

```
/api/v1/{resource}
```

Example

```
/api/v1/story
```

Resource by ID

```
/api/v1/story/{id}
```

Nested resources

```
/api/v1/story/{storyId}/season

/api/v1/season/{seasonId}/episode

/api/v1/episode/{episodeId}/scene
```

---

# Resource Naming

Always use plural business concepts internally, even if the endpoint remains singular.

Examples

| Resource | ID Prefix |
|-----------|-----------|
| Character | CHR |
| World | WRD |
| Story | STR |
| Season | SEA |
| Episode | EPI |
| Scene | SCN |
| Dialogue | DLG |
| Review | REV |
| Asset | AST |
| Production | PRD |

Example IDs

```
CHR-SURO

EPI-001

SCN-005
```

---

# HTTP Methods

| Method | Purpose |
|----------|----------|
|GET|Retrieve|
|POST|Create|
|PUT|Replace|
|PATCH|Partial Update|
|DELETE|Delete|

Example

```
GET /story/{id}

POST /episode

PATCH /scene/{id}

DELETE /dialogue/{id}
```

---

# Request Body

Create requests send JSON.

Example

```json
{
  "title": "The Lost Keris",
  "summary": "Suro discovers an ancient artifact."
}
```

---

# Response Format

Every successful response follows the same format.

```json
{
  "success": true,
  "data": {},
  "metadata": {}
}
```

---

# Collection Response

Collection endpoints return arrays.

```json
{
  "success": true,
  "data": [
    {}
  ],
  "metadata": {
    "page": 1,
    "pageSize": 20,
    "total": 200
  }
}
```

---

# Error Response

Errors always follow one structure.

```json
{
  "success": false,
  "error": {
    "code": "CANON_CONFLICT",
    "message": "Character timeline conflict."
  }
}
```

Clients should never parse plain text errors.

---

# Field Naming

JSON fields use camelCase.

Good

```json
{
  "createdAt": "",
  "storyId": "",
  "episodeNumber": 1
}
```

Avoid

```json
{
  "Created_At": "",
  "Story_ID": ""
}
```

---

# Date Format

All timestamps use ISO-8601.

Example

```
2026-07-24T08:30:00Z
```

Time zones should always be UTC.

---

# Boolean Values

Boolean values use JSON booleans.

Correct

```json
{
  "approved": true
}
```

Incorrect

```json
{
  "approved": "yes"
}
```

---

# Null Values

Unknown values should use `null`.

Example

```json
{
  "publishedAt": null
}
```

Avoid placeholder strings such as:

```
"N/A"

"-"

"unknown"
```

---

# Enumerations

Fields with predefined values should use enums.

Example

```json
{
  "status": "approved"
}
```

Allowed values should be documented in each schema.

---

# Pagination

Collections support pagination.

```
?page=1

&pageSize=20
```

---

# Filtering

Filtering uses query parameters.

Example

```
GET /story?status=approved

GET /episode?season=SEA-001
```

---

# Sorting

Sorting uses a single query parameter.

```
?sort=createdAt

?sort=-createdAt
```

A leading minus (`-`) indicates descending order.

---

# Searching

Search uses the `q` parameter.

Example

```
GET /story?q=keris
```

---

# Versioning

Every endpoint belongs to an API version.

Example

```
/api/v1
```

Breaking changes require a new major version.

---

# Content Type

Requests and responses use JSON.

```
Content-Type: application/json
```

---

# Character Encoding

UTF-8 is required.

```
application/json; charset=utf-8
```

---

# Idempotency

Create operations may include an idempotency key.

Example

```
Idempotency-Key:
```

This prevents duplicate requests.

---

# Resource Relationships

Relationships use resource IDs.

Example

```json
{
  "storyId": "STR-001",
  "episodeId": "EPI-003",
  "characterId": "CHR-SURO"
}
```

Objects should not be deeply nested unnecessarily.

---

# Metadata

Metadata belongs in a dedicated object.

Example

```json
{
  "metadata": {
    "createdAt": "",
    "updatedAt": "",
    "version": "1.0.0"
  }
}
```

---

# Backward Compatibility

Existing fields should not change meaning.

New fields should be additive whenever possible.

Deprecated fields should remain available until the next major API version.

---

# Documentation Requirements

Every endpoint should document:

- purpose
- request
- response
- parameters
- examples
- validation rules
- error codes

Documentation is part of the API contract.

---

# Relationship with Other Documents

This document complements:

- API Overview
- REST API
- Authentication
- Error Handling
- Pagination
- Versioning

Together they define the standards that every API endpoint must follow.

---

# Future Expansion

Future API conventions may include:

- cursor-based pagination
- sparse fieldsets
- batch operations
- partial resource projection
- standardized tracing headers
- asynchronous callbacks
- streaming responses

These enhancements should preserve the existing API style and conventions.

---

# Summary

The API Conventions establish the common rules that govern every endpoint in the Suro & Buya AI Engine.

By standardizing naming, URI structure, request and response formats, data representation, pagination, filtering, versioning, and documentation, the API becomes predictable, easy to use, and scalable as the platform grows.

A consistent API enables a simple developer experience while supporting the complexity of the underlying AI Engine.