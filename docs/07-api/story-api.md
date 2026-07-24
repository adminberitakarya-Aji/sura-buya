# Story API

Version: 1.0

---

# Purpose

The Story API provides endpoints for creating, retrieving, updating, validating, reviewing, and managing Story resources within the Suro & Buya AI Engine.

A Story represents the highest-level narrative object that defines the overall plot, themes, characters, world, and timeline from which Seasons and Episodes are generated.

---

# Base Endpoint

```
/api/v1/story
```

---

# Resource

```
Story
```

Schema Reference

```
story.schema.json
```

---

# Resource Identifier

Every Story uses a unique identifier.

Example

```
STR-SURO-001

STR-PUSAKA-HILANG

STR-GUNUNG-LAWU
```

---

# Story Lifecycle

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

Only approved Stories become part of the official Story Bible.

---

# Create Story

Creates a new Story.

## Endpoint

```
POST /api/v1/story
```

### Request

```json
{
  "title": "The Lost Keris",
  "summary": "Suro begins a journey to recover a sacred heirloom.",
  "worldId": "WRD-DESA-WANARA"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "STR-PUSAKA-HILANG",
    "status": "draft"
  }
}
```

---

# Get Story

Retrieve a Story by ID.

## Endpoint

```
GET /api/v1/story/{id}
```

Example

```
GET /api/v1/story/STR-PUSAKA-HILANG
```

---

# List Stories

Returns a paginated collection.

## Endpoint

```
GET /api/v1/story
```

Example

```
GET /api/v1/story?page=1&pageSize=20
```

### Response

```json
{
  "success": true,
  "data": [],
  "metadata": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 24,
    "totalPages": 2
  }
}
```

---

# Update Story

Updates part of an existing Story.

## Endpoint

```
PATCH /api/v1/story/{id}
```

### Request

```json
{
  "summary": "Suro and Buya investigate a mysterious disappearance."
}
```

---

# Replace Story

Replace the complete Story resource.

## Endpoint

```
PUT /api/v1/story/{id}
```

---

# Delete Story

Delete a Story.

## Endpoint

```
DELETE /api/v1/story/{id}
```

Deletion may be rejected if the Story already contains Seasons or has entered production.

---

# Search Stories

Search by keyword.

## Endpoint

```
GET /api/v1/story?q=keris
```

---

# Filter Stories

Examples

```
GET /api/v1/story?status=approved

GET /api/v1/story?worldId=WRD-DESA-WANARA
```

---

# Sort Stories

Examples

```
GET /api/v1/story?sort=title

GET /api/v1/story?sort=-createdAt
```

---

# Validate Story

Validate the Story against the Universe Bible.

## Endpoint

```
POST /api/v1/story/{id}/validate
```

### Response

```json
{
  "success": true,
  "data": {
    "passed": true,
    "score": 99
  }
}
```

---

# Review Story

Generate a Review Package.

## Endpoint

```
POST /api/v1/story/{id}/review
```

### Response

```json
{
  "success": true,
  "data": {
    "reviewId": "REV-3001",
    "status": "review"
  }
}
```

---

# Approve Story

Approve the Story.

## Endpoint

```
POST /api/v1/story/{id}/approve
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

# Generate Story Plan

Generate an AI Story Plan.

## Endpoint

```
POST /api/v1/story/{id}/plan
```

This endpoint invokes the Story Planner component.

---

### Response

```json
{
  "success": true,
  "data": {
    "jobId": "JOB-501",
    "status": "running"
  }
}
```

---

# Retrieve Story Plan

Retrieve the generated Story Plan.

## Endpoint

```
GET /api/v1/story/{id}/plan
```

---

# List Seasons

Retrieve Seasons belonging to a Story.

## Endpoint

```
GET /api/v1/story/{id}/seasons
```

---

# Story Characters

Retrieve Characters participating in a Story.

## Endpoint

```
GET /api/v1/story/{id}/characters
```

---

# Story World

Retrieve the associated World.

## Endpoint

```
GET /api/v1/story/{id}/world
```

---

# Story Timeline

Retrieve the canonical Story timeline.

## Endpoint

```
GET /api/v1/story/{id}/timeline
```

---

# Story Production Status

Retrieve production progress.

## Endpoint

```
GET /api/v1/story/{id}/production
```

---

# Response Codes

| HTTP | Meaning |
|------|---------|
|200|Success|
|201|Created|
|202|Generation Started|
|204|Deleted|
|400|Validation Error|
|401|Unauthorized|
|403|Forbidden|
|404|Story Not Found|
|409|Conflict|
|422|Canon Validation Failed|
|500|Internal Error|

---

# Error Codes

Possible error codes include:

```
STORY_NOT_FOUND

STORY_ALREADY_EXISTS

INVALID_STORY

CANON_CONFLICT

TIMELINE_CONFLICT

STORY_LOCKED

VALIDATION_FAILED

UNAUTHORIZED
```

---

# Related Resources

A Story owns the complete narrative hierarchy.

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

A Story also references:

- World
- Characters
- Universe Bible
- Review Package
- Production Package

---

# Security

Protected endpoints require authentication.

Example

```
Authorization: Bearer <token>
```

Authorization determines whether users may create, modify, approve, generate, or delete Story resources.

---

# Relationship with Other Documents

This document complements:

- REST API
- API Overview
- Story Planner
- Story Bible
- Story Schema
- Season API
- Review API
- Production API

Together they define the complete lifecycle of Story resources.

---

# Future Expansion

Future versions may support:

- AI story brainstorming
- collaborative story editing
- branching storylines
- alternate story arcs
- story templates
- automatic season planning
- narrative analytics
- cross-story continuity validation

These capabilities extend the Story API while preserving the existing resource model.

---

# Summary

The Story API provides a complete interface for managing Story resources throughout the Suro & Buya AI Engine.

By supporting creation, retrieval, AI-assisted planning, validation, review, approval, and integration with Seasons, Episodes, the Universe Bible, and the production pipeline, the API establishes Stories as the central narrative entity from which the entire serialized content workflow is orchestrated.