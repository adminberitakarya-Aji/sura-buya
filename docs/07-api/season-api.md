# Season API

Version: 1.0

---

# Purpose

The Season API provides endpoints for creating, retrieving, updating, validating, reviewing, and managing Season resources within the Suro & Buya AI Engine.

A Season groups multiple Episodes into a coherent narrative arc while maintaining continuity with the Story, Universe Bible, and production workflow.

---

# Base Endpoint

```
/api/v1/season
```

---

# Resource

```
Season
```

Schema Reference

```
season.schema.json
```

---

# Resource Identifier

Every Season uses a unique identifier.

Example

```
SEA-001

SEA-002

SEA-PUSAKA
```

---

# Season Lifecycle

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

Only approved Seasons may proceed to Episode generation and production.

---

# Create Season

Creates a new Season.

## Endpoint

```
POST /api/v1/season
```

### Request

```json
{
  "storyId": "STR-PUSAKA-HILANG",
  "title": "Season One",
  "summary": "Suro begins his first great adventure.",
  "plannedEpisodes": 12
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "SEA-001",
    "status": "draft"
  }
}
```

---

# Get Season

Retrieve a Season by ID.

## Endpoint

```
GET /api/v1/season/{id}
```

Example

```
GET /api/v1/season/SEA-001
```

---

# List Seasons

Returns a paginated collection.

## Endpoint

```
GET /api/v1/season
```

Example

```
GET /api/v1/season?page=1&pageSize=20
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
    "totalItems": 8,
    "totalPages": 1
  }
}
```

---

# Update Season

Update part of a Season.

## Endpoint

```
PATCH /api/v1/season/{id}
```

### Request

```json
{
  "summary": "Suro uncovers the first clues about the sacred heirloom."
}
```

---

# Replace Season

Replace an existing Season.

## Endpoint

```
PUT /api/v1/season/{id}
```

---

# Delete Season

Delete a Season.

## Endpoint

```
DELETE /api/v1/season/{id}
```

Deletion may be rejected if Episodes already exist or production has started.

---

# Search Seasons

Search Seasons.

```
GET /api/v1/season?q=first
```

---

# Filter Seasons

Examples

```
GET /api/v1/season?storyId=STR-PUSAKA-HILANG

GET /api/v1/season?status=approved
```

---

# Sort Seasons

Examples

```
GET /api/v1/season?sort=title

GET /api/v1/season?sort=-createdAt
```

---

# Validate Season

Validate consistency against the Story Bible and Universe Bible.

## Endpoint

```
POST /api/v1/season/{id}/validate
```

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

# Review Season

Generate a Review Package.

## Endpoint

```
POST /api/v1/season/{id}/review
```

### Response

```json
{
  "success": true,
  "data": {
    "reviewId": "REV-4001",
    "status": "review"
  }
}
```

---

# Approve Season

Approve a Season.

## Endpoint

```
POST /api/v1/season/{id}/approve
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

# Generate Season Plan

Generate an AI Season Plan.

## Endpoint

```
POST /api/v1/season/{id}/plan
```

This endpoint invokes the Season Planner component.

---

### Response

```json
{
  "success": true,
  "data": {
    "jobId": "JOB-601",
    "status": "running"
  }
}
```

---

# Retrieve Season Plan

Retrieve the generated Season Plan.

## Endpoint

```
GET /api/v1/season/{id}/plan
```

---

# List Episodes

Retrieve Episodes belonging to a Season.

## Endpoint

```
GET /api/v1/season/{id}/episodes
```

---

# Season Timeline

Retrieve the chronological timeline of the Season.

## Endpoint

```
GET /api/v1/season/{id}/timeline
```

---

# Season Characters

Retrieve Characters appearing in the Season.

## Endpoint

```
GET /api/v1/season/{id}/characters
```

---

# Season Production Status

Retrieve production progress.

## Endpoint

```
GET /api/v1/season/{id}/production
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
|404|Season Not Found|
|409|Conflict|
|422|Canon Validation Failed|
|500|Internal Error|

---

# Error Codes

Possible error codes include:

```
SEASON_NOT_FOUND

SEASON_ALREADY_EXISTS

INVALID_SEASON

CANON_CONFLICT

TIMELINE_CONFLICT

SEASON_LOCKED

VALIDATION_FAILED

UNAUTHORIZED
```

---

# Related Resources

A Season belongs to a Story and owns multiple Episodes.

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

A Season references:

- Story
- Characters
- World
- Timeline
- Review Package
- Production Package

---

# Security

Protected endpoints require authentication.

Example

```
Authorization: Bearer <token>
```

Authorization determines whether users may create, modify, approve, generate, or delete Season resources.

---

# Relationship with Other Documents

This document complements:

- REST API
- Story API
- Episode API
- Season Planner
- Story Bible
- Season Schema
- Review API
- Production API

Together they define the complete lifecycle of Season resources.

---

# Future Expansion

Future versions may support:

- automatic episode distribution
- season templates
- season analytics
- cliffhanger optimization
- pacing analysis
- seasonal story arcs
- AI-assisted restructuring
- cross-season continuity validation

These capabilities extend the Season API while preserving the existing resource model.

---

# Summary

The Season API provides a complete interface for managing Season resources throughout the Suro & Buya AI Engine.

By supporting creation, retrieval, AI-assisted planning, validation, review, approval, and integration with Stories, Episodes, the Universe Bible, and the production pipeline, the API establishes Seasons as the organizational layer that transforms a Story into a structured sequence of Episodes ready for generation and production.