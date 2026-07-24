# World API

Version: 1.0

---

# Purpose

The World API provides endpoints for creating, retrieving, updating, validating, reviewing, and managing World resources within the Suro & Buya AI Engine.

A World defines the environments, locations, cultures, rules, history, geography, and lore that form the foundation of every story in the Universe Bible.

---

# Base Endpoint

```
/api/v1/world
```

---

# Resource

```
World
```

Schema Reference

```
world.schema.json
```

---

# Resource Identifier

Every World uses a unique identifier.

Example

```
WRD-JAWA-ABAD17

WRD-DESA-WANARA

WRD-GUNUNG-LAWU
```

---

# World Lifecycle

```
Draft

↓

Review

↓

Approved

↓

Production

↓

Published

↓

Archived
```

Only approved Worlds become part of the official Universe Bible.

---

# Create World

Creates a new World.

## Endpoint

```
POST /api/v1/world
```

### Request

```json
{
  "name": "Desa Wanara",
  "type": "village",
  "description": "A peaceful mountain village surrounded by ancient forests."
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "WRD-DESA-WANARA",
    "status": "draft"
  }
}
```

---

# Get World

Retrieve a World by ID.

## Endpoint

```
GET /api/v1/world/{id}
```

Example

```
GET /api/v1/world/WRD-DESA-WANARA
```

---

# List Worlds

Returns a paginated collection.

## Endpoint

```
GET /api/v1/world
```

Example

```
GET /api/v1/world?page=1&pageSize=20
```

### Response

```json
{
  "success": true,
  "data": [],
  "metadata": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 8,
    "totalPages": 1
  }
}
```

---

# Update World

Updates part of an existing World.

## Endpoint

```
PATCH /api/v1/world/{id}
```

Example

```
PATCH /api/v1/world/WRD-DESA-WANARA
```

### Request

```json
{
  "description": "A remote village protected by sacred spirits."
}
```

---

# Replace World

Replace the complete World resource.

## Endpoint

```
PUT /api/v1/world/{id}
```

---

# Delete World

Delete a World.

## Endpoint

```
DELETE /api/v1/world/{id}
```

Deletion may be rejected if Stories, Episodes, or Characters reference the World.

---

# Search Worlds

Search by keyword.

## Endpoint

```
GET /api/v1/world?q=village
```

---

# Filter Worlds

Examples

```
GET /api/v1/world?type=village

GET /api/v1/world?status=approved
```

---

# Sort Worlds

Examples

```
GET /api/v1/world?sort=name

GET /api/v1/world?sort=-createdAt
```

---

# Validate World

Validates consistency against the World Bible.

## Endpoint

```
POST /api/v1/world/{id}/validate
```

### Response

```json
{
  "success": true,
  "data": {
    "passed": true,
    "score": 97
  }
}
```

---

# Review World

Creates a Review Package.

## Endpoint

```
POST /api/v1/world/{id}/review
```

### Response

```json
{
  "success": true,
  "data": {
    "reviewId": "REV-2001",
    "status": "review"
  }
}
```

---

# Approve World

Approves the World.

## Endpoint

```
POST /api/v1/world/{id}/approve
```

### Response

```json
{
  "success": true,
  "data": {
    "status": "approved"
  }
}
```

---

# World Locations

Retrieve all locations contained within a World.

## Endpoint

```
GET /api/v1/world/{id}/locations
```

---

# World Characters

Retrieve Characters associated with a World.

## Endpoint

```
GET /api/v1/world/{id}/characters
```

---

# World Stories

Retrieve Stories that take place in a World.

## Endpoint

```
GET /api/v1/world/{id}/stories
```

---

# World Timeline

Retrieve historical events associated with a World.

## Endpoint

```
GET /api/v1/world/{id}/timeline
```

---

# World Rules

Retrieve the canonical rules governing a World.

## Endpoint

```
GET /api/v1/world/{id}/rules
```

---

# Response Codes

| HTTP | Meaning |
|------|---------|
|200|Success|
|201|Created|
|204|Deleted|
|400|Validation Error|
|401|Unauthorized|
|403|Forbidden|
|404|World Not Found|
|409|Conflict|
|422|Canon Validation Failed|
|500|Internal Error|

---

# Error Codes

Possible error codes include:

```
WORLD_NOT_FOUND

WORLD_ALREADY_EXISTS

INVALID_WORLD

CANON_CONFLICT

WORLD_IN_USE

VALIDATION_FAILED

UNAUTHORIZED
```

---

# Related Resources

World resources are referenced by:

```
Character

↓

Story

↓

Season

↓

Episode

↓

Scene
```

The World provides the canonical setting for all narrative generation.

---

# Security

Protected endpoints require authentication.

Example

```
Authorization: Bearer <token>
```

Authorization determines whether users may create, modify, approve, or delete World resources.

---

# Relationship with Other Documents

This document complements:

- REST API
- Authentication
- API Conventions
- World Bible
- World Schema
- Story API
- Review API

Together they define the complete lifecycle of World resources.

---

# Future Expansion

Future versions may support:

- interactive world maps
- hierarchical locations
- culture management
- historical event generation
- environmental simulation
- world templates
- geographic search
- AI-assisted world generation

These capabilities extend the World API while preserving the existing resource model.

---

# Summary

The World API provides a complete interface for managing World resources throughout the Suro & Buya AI Engine.

By supporting creation, retrieval, validation, review, approval, location management, and integration with the World Bible, the API establishes Worlds as the canonical foundation for consistent environments, locations, lore, and story generation across the entire universe.