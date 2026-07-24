# REST API

Version: 1.0

---

# Purpose

The REST API provides the primary interface for interacting with the Suro & Buya AI Engine.

It enables Creator Studio, production tools, automation services, and future integrations to access engine capabilities through a consistent HTTP-based interface.

The REST API exposes business capabilities rather than internal implementation details.

---

# Objective

Provide a stable, versioned, and resource-oriented API for the Suro & Buya ecosystem.

The REST API answers one fundamental question:

> "How do external applications communicate with the AI Engine?"

---

# Design Principles

The REST API follows these principles:

- Resource Oriented
- Stateless
- Versioned
- Consistent
- Predictable
- Secure
- Human Readable

---

# Base URL

```
/api/v1
```

Example

```
POST /api/v1/story
```

---

# API Categories

The API is organized around business resources.

```
Character

World

Story

Season

Episode

Scene

Dialogue

Review

Production
```

Each resource owns its own endpoint group.

---

# Resource Hierarchy

```
Story

└── Season

     └── Episode

          └── Scene

               └── Dialogue
```

The API mirrors the Object Model.

---

# HTTP Methods

| Method | Purpose |
|---------|----------|
| GET | Retrieve resource |
| POST | Create resource |
| PUT | Replace resource |
| PATCH | Partial update |
| DELETE | Remove resource |

---

# Standard Response

Successful responses return JSON.

Example

```json
{
  "success": true,
  "data": {},
  "metadata": {}
}
```

---

# Error Response

Errors follow a standard format.

```json
{
  "success": false,
  "error": {
    "code": "CANON_VALIDATION_FAILED",
    "message": "Timeline conflict detected."
  }
}
```

---

# HTTP Status Codes

| Code | Meaning |
|------|----------|
|200|OK|
|201|Created|
|204|No Content|
|400|Bad Request|
|401|Unauthorized|
|403|Forbidden|
|404|Not Found|
|409|Conflict|
|422|Validation Failed|
|500|Internal Error|

---

# Core Endpoints

```
/character

/world

/story

/season

/episode

/scene

/dialogue

/review

/production
```

---

# Example

Create Story

```
POST /api/v1/story
```

Retrieve Story

```
GET /api/v1/story/{id}
```

Update Story

```
PATCH /api/v1/story/{id}
```

Delete Story

```
DELETE /api/v1/story/{id}
```

---

# Long Running Operations

AI generation may require several minutes.

Operations should return a Job.

Example

```json
{
  "jobId": "JOB-001",
  "status": "running"
}
```

The client polls:

```
GET /jobs/JOB-001
```

---

# Idempotency

Create operations should support an optional idempotency key.

Example

```
Idempotency-Key:
```

This prevents duplicate generation requests.

---

# Pagination

Collection endpoints support pagination.

```
?page=1

&pageSize=20
```

---

# Filtering

Example

```
GET /story?status=approved
```

---

# Sorting

Example

```
GET /episode?sort=createdAt
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

# Authentication

Authentication is handled separately.

Example

```
Authorization: Bearer <token>
```

---

# Relationship with Other Documents

This document complements:

- API Overview
- Authentication
- Error Handling
- Character API
- Story API
- Episode API
- Review API
- Production API

---

# Future Expansion

Future versions may include:

- GraphQL
- WebSocket
- Streaming
- Server-Sent Events
- gRPC
- MCP Server Interface

---

# Summary

The REST API provides a stable, resource-oriented interface for the Suro & Buya AI Engine.

By exposing business resources such as Stories, Episodes, Scenes, Dialogues, Reviews, and Production Packages through predictable REST endpoints, the API enables Creator Studio and future services to interact with the engine in a consistent, secure, and scalable manner.