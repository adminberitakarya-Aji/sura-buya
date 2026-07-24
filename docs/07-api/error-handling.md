# Error Handling

Version: 1.0

---

# Purpose

The Error Handling Architecture defines how the Suro & Buya AI Engine reports errors in a consistent, predictable, and developer-friendly manner.

Errors are part of the API contract and should provide enough information for clients to understand, diagnose, and recover from failures without exposing internal implementation details.

---

# Objective

Provide a standardized mechanism for:

- reporting failures
- communicating validation issues
- identifying engine errors
- supporting automated recovery
- improving developer experience

The Error Handling Architecture answers one fundamental question:

> **"What happens when something goes wrong?"**

---

# Design Principles

The error handling system follows these principles:

- Consistent
- Predictable
- Machine Readable
- Human Readable
- Secure
- Traceable

Errors should explain what happened, not how the engine works internally.

---

# Error Lifecycle

Every request follows the same lifecycle.

```
Client Request

↓

Validation

↓

Execution

↓

Success
      │
      └── Failure

↓

Error Response
```

Every failure results in a standardized response.

---

# Error Response Format

All errors follow the same JSON structure.

```json
{
  "success": false,
  "error": {
    "code": "CANON_VALIDATION_FAILED",
    "message": "The episode conflicts with the Character Bible.",
    "details": [],
    "requestId": "REQ-123456"
  }
}
```

---

# Error Object

| Field | Description |
|--------|-------------|
| code | Machine-readable error code |
| message | Human-readable explanation |
| details | Additional validation details |
| requestId | Request identifier for tracing |

---

# Validation Errors

Validation errors occur before engine execution.

Examples:

- missing required field
- invalid JSON
- invalid schema
- unsupported value
- malformed request

Example

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Episode title is required."
  }
}
```

---

# Canon Errors

Canon errors occur when generated content violates the Universe Bible.

Examples:

- character inconsistency
- world conflict
- timeline conflict
- relationship conflict
- visual conflict

Example

```json
{
  "success": false,
  "error": {
    "code": "CANON_CONFLICT",
    "message": "Character appears before introduction."
  }
}
```

---

# Business Errors

Business rules may reject a request.

Examples:

- episode already approved
- production already started
- story locked
- review pending

Example

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_LOCKED",
    "message": "Approved episodes cannot be modified."
  }
}
```

---

# Authentication Errors

Authentication failures include:

- missing token
- invalid token
- expired token
- revoked token

Example

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required."
  }
}
```

---

# Authorization Errors

Authorization failures occur when the user lacks permission.

Example

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to publish."
  }
}
```

---

# Resource Errors

Resource-related errors include:

- not found
- duplicate resource
- deleted resource
- invalid identifier

Example

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Episode not found."
  }
}
```

---

# Engine Errors

Internal engine failures may occur during execution.

Examples:

- planner failure
- retrieval failure
- generation timeout
- workflow interruption

Example

```json
{
  "success": false,
  "error": {
    "code": "ENGINE_FAILURE",
    "message": "Story Planner execution failed."
  }
}
```

Internal stack traces must never be exposed.

---

# External Service Errors

Failures from integrated services.

Examples:

- LLM unavailable
- image generation timeout
- storage unavailable
- publishing service failure

Example

```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Image generation service is temporarily unavailable."
  }
}
```

---

# HTTP Status Codes

| Code | Meaning |
|------|---------|
|200|Success|
|201|Created|
|202|Accepted|
|204|No Content|
|400|Bad Request|
|401|Unauthorized|
|403|Forbidden|
|404|Not Found|
|409|Conflict|
|422|Validation Failed|
|429|Too Many Requests|
|500|Internal Server Error|
|502|Bad Gateway|
|503|Service Unavailable|
|504|Gateway Timeout|

---

# Validation Details

Validation failures may include detailed field information.

Example

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed.",
    "details": [
      {
        "field": "title",
        "reason": "Required field."
      },
      {
        "field": "summary",
        "reason": "Minimum length is 50."
      }
    ]
  }
}
```

---

# Request ID

Every response should include a request identifier.

Example

```
REQ-8F92A1
```

The Request ID enables troubleshooting and log correlation.

---

# Error Codes

Error codes should remain stable.

Examples:

```
VALIDATION_FAILED

CANON_CONFLICT

TIMELINE_CONFLICT

RESOURCE_NOT_FOUND

RESOURCE_LOCKED

UNAUTHORIZED

FORBIDDEN

ENGINE_FAILURE

SERVICE_UNAVAILABLE

INTERNAL_ERROR
```

Clients should rely on `code`, not the message text.

---

# Retry Strategy

Some errors are retryable.

Retry examples:

- timeout
- temporary service unavailable
- rate limiting

Non-retry examples:

- validation failure
- canon conflict
- unauthorized
- forbidden

Clients should distinguish between recoverable and permanent failures.

---

# Logging

Every error should be logged.

Recommended fields:

- requestId
- timestamp
- endpoint
- user
- errorCode
- statusCode

Sensitive information must never be logged.

---

# Security

Error responses should never expose:

- stack traces
- SQL queries
- API secrets
- internal paths
- infrastructure details
- authentication credentials

Only safe diagnostic information should be returned.

---

# Relationship with Other Documents

This document complements:

- API Overview
- REST API
- Authentication
- API Conventions
- Versioning

Together they define the behavior of API requests under both successful and failure scenarios.

---

# Future Expansion

Future versions may include:

- localized error messages
- structured error categories
- automatic retry hints
- distributed tracing
- correlation IDs
- RFC 9457 Problem Details compatibility
- observability integration

These improvements extend the error handling system while preserving backward compatibility.

---

# Summary

The Error Handling Architecture defines a consistent approach for reporting failures throughout the Suro & Buya AI Engine.

By standardizing error structures, HTTP status codes, machine-readable error codes, validation details, and request tracing, the API provides clear feedback to both developers and users while protecting internal implementation details and maintaining a stable integration contract.