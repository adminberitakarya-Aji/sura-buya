# Character API

Version: 1.0

---

# Purpose

The Character API provides endpoints for creating, retrieving, updating, validating, reviewing, and managing Character resources within the Suro & Buya AI Engine.

Characters are one of the core entities of the Universe Bible and serve as the foundation for story planning, dialogue generation, scene generation, and production.

---

# Base Endpoint

```
/api/v1/character
```

---

# Resource

```
Character
```

Schema Reference

```
character.schema.json
```

---

# Resource Identifier

Every Character uses a unique identifier.

Example

```
CHR-SURO

CHR-BUYA

CHR-KI-JOGO
```

---

# Character Lifecycle

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

Only approved characters become part of the official Universe Bible.

---

# Create Character

Creates a new Character.

## Endpoint

```
POST /api/v1/character
```

---

### Request

```json
{
  "name": "Suro",
  "role": "protagonist",
  "description": "A brave village guardian."
}
```

---

### Response

```json
{
  "success": true,
  "data": {
    "id": "CHR-SURO",
    "status": "draft"
  }
}
```

---

# Get Character

Retrieve a Character by ID.

## Endpoint

```
GET /api/v1/character/{id}
```

Example

```
GET /api/v1/character/CHR-SURO
```

---

# List Characters

Returns a paginated collection.

## Endpoint

```
GET /api/v1/character
```

Example

```
GET /api/v1/character?page=1&pageSize=20
```

---

### Response

```json
{
  "success": true,
  "data": [],
  "metadata": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 15,
    "totalPages": 1
  }
}
```

---

# Update Character

Updates part of an existing Character.

## Endpoint

```
PATCH /api/v1/character/{id}
```

Example

```
PATCH /api/v1/character/CHR-SURO
```

---

### Request

```json
{
  "description": "Guardian of the sacred forest."
}
```

---

# Replace Character

Replace the complete Character resource.

## Endpoint

```
PUT /api/v1/character/{id}
```

The request body must contain a complete Character object.

---

# Delete Character

Delete a Character.

## Endpoint

```
DELETE /api/v1/character/{id}
```

Deletion may be restricted if the Character is referenced by Stories or Episodes.

---

# Search Characters

Search by keyword.

## Endpoint

```
GET /api/v1/character?q=suro
```

---

# Filter Characters

Examples

```
GET /api/v1/character?role=protagonist

GET /api/v1/character?status=approved
```

---

# Sort Characters

Examples

```
GET /api/v1/character?sort=name

GET /api/v1/character?sort=-createdAt
```

---

# Validate Character

Checks Character consistency against the Character Bible.

## Endpoint

```
POST /api/v1/character/{id}/validate
```

---

### Response

```json
{
  "success": true,
  "data": {
    "passed": true,
    "score": 98
  }
}
```

---

# Review Character

Creates a Review Package.

## Endpoint

```
POST /api/v1/character/{id}/review
```

---

### Response

```json
{
  "success": true,
  "data": {
    "reviewId": "REV-1001",
    "status": "review"
  }
}
```

---

# Approve Character

Approves the Character.

## Endpoint

```
POST /api/v1/character/{id}/approve
```

---

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

# Character Relationships

Retrieve Character relationships.

## Endpoint

```
GET /api/v1/character/{id}/relationships
```

---

### Response

```json
{
  "success": true,
  "data": [
    {
      "characterId": "CHR-BUYA",
      "relationship": "mentor"
    }
  ]
}
```

---

# Character Appearances

Returns Episodes containing the Character.

## Endpoint

```
GET /api/v1/character/{id}/episodes
```

---

# Character Dialogue Profile

Retrieve dialogue configuration.

## Endpoint

```
GET /api/v1/character/{id}/dialogue
```

---

# Character Visual Profile

Retrieve visual references.

## Endpoint

```
GET /api/v1/character/{id}/visual
```

---

# Character Voice Profile

Retrieve voice configuration.

## Endpoint

```
GET /api/v1/character/{id}/voice
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
|404|Character Not Found|
|409|Conflict|
|422|Canon Validation Failed|
|500|Internal Error|

---

# Error Codes

Possible error codes include:

```
CHARACTER_NOT_FOUND

CHARACTER_ALREADY_EXISTS

INVALID_CHARACTER

CANON_CONFLICT

CHARACTER_IN_USE

VALIDATION_FAILED

UNAUTHORIZED
```

---

# Related Resources

Character resources are referenced by:

```
Story

↓

Season

↓

Episode

↓

Scene

↓

Dialogue
```

Characters are one of the primary entities used throughout the AI Engine.

---

# Security

Protected endpoints require authentication.

Example

```
Authorization: Bearer <token>
```

Authorization determines whether the user may create, modify, approve, or delete Character resources.

---

# Relationship with Other Documents

This document complements:

- REST API
- Authentication
- API Conventions
- Character Bible
- Character Schema
- Review API
- Story API
- Episode API

Together they define the complete lifecycle of Character resources.

---

# Future Expansion

Future versions may support:

- bulk character import
- character templates
- AI-assisted character generation
- visual embedding search
- voice cloning integration
- character similarity analysis
- multilingual dialogue profiles
- character evolution tracking

These capabilities extend the Character API while preserving the existing resource model.

---

# Summary

The Character API provides a complete interface for managing Character resources throughout the Suro & Buya AI Engine.

By supporting creation, retrieval, validation, review, approval, relationship management, and integration with the Universe Bible, the API establishes Characters as the foundational entity for consistent story generation and AI-assisted serial content production.