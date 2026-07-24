# Episode API

Version: 1.0

---

# Purpose

The Episode API provides endpoints for creating, retrieving, updating, validating, reviewing, generating, and managing Episode resources within the Suro & Buya AI Engine.

An Episode represents a complete narrative unit within a Season. It contains multiple Scenes, drives story progression, and serves as the primary production unit for scripts, storyboards, visuals, voice, and publishing.

---

# Base Endpoint

```
/api/v1/episode
```

---

# Resource

```
Episode
```

Schema Reference

```
episode.schema.json
```

---

# Resource Identifier

Every Episode uses a unique identifier.

Example

```
EPI-001

EPI-002

EPI-012
```

---

# Episode Lifecycle

```
Draft

↓

Planned

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

Only approved Episodes may enter the production pipeline.

---

# Create Episode

Creates a new Episode.

## Endpoint

```
POST /api/v1/episode
```

### Request

```json
{
  "seasonId": "SEA-001",
  "title": "The Lost Keris",
  "summary": "Suro begins his search for the sacred heirloom.",
  "episodeNumber": 1
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "EPI-001",
    "status": "draft"
  }
}
```

---

# Get Episode

Retrieve an Episode by ID.

## Endpoint

```
GET /api/v1/episode/{id}
```

Example

```
GET /api/v1/episode/EPI-001
```

---

# List Episodes

Retrieve a paginated collection.

## Endpoint

```
GET /api/v1/episode
```

Example

```
GET /api/v1/episode?page=1&pageSize=20
```

### Response

```json
{
  "success": true,
  "data": [],
  "metadata": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 48,
    "totalPages": 3
  }
}
```

---

# Update Episode

Update part of an Episode.

## Endpoint

```
PATCH /api/v1/episode/{id}
```

### Request

```json
{
  "summary": "Suro discovers the first clue hidden inside an ancient temple."
}
```

---

# Replace Episode

Replace the complete Episode resource.

## Endpoint

```
PUT /api/v1/episode/{id}
```

---

# Delete Episode

Delete an Episode.

## Endpoint

```
DELETE /api/v1/episode/{id}
```

Deletion may be rejected if production has started or published assets already exist.

---

# Search Episodes

Search Episodes.

```
GET /api/v1/episode?q=keris
```

---

# Filter Episodes

Examples

```
GET /api/v1/episode?seasonId=SEA-001

GET /api/v1/episode?status=approved

GET /api/v1/episode?production=completed
```

---

# Sort Episodes

Examples

```
GET /api/v1/episode?sort=episodeNumber

GET /api/v1/episode?sort=-createdAt
```

---

# Generate Episode Plan

Generate an Episode Plan using the Episode Planner.

## Endpoint

```
POST /api/v1/episode/{id}/plan
```

### Response

```json
{
  "success": true,
  "data": {
    "jobId": "JOB-701",
    "status": "running"
  }
}
```

---

# Retrieve Episode Plan

Retrieve the generated Episode Plan.

## Endpoint

```
GET /api/v1/episode/{id}/plan
```

---

# Generate Scenes

Generate all Scenes for the Episode.

## Endpoint

```
POST /api/v1/episode/{id}/generate-scenes
```

This endpoint invokes the Scene Generator.

---

### Response

```json
{
  "success": true,
  "data": {
    "jobId": "JOB-702",
    "status": "running"
  }
}
```

---

# Generate Dialogues

Generate all Dialogues for the Episode.

## Endpoint

```
POST /api/v1/episode/{id}/generate-dialogues
```

This endpoint invokes the Dialogue Generator.

---

### Response

```json
{
  "success": true,
  "data": {
    "jobId": "JOB-703",
    "status": "running"
  }
}
```

---

# Validate Episode

Validate an Episode against the Universe Bible.

## Endpoint

```
POST /api/v1/episode/{id}/validate
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

# Review Episode

Generate a Review Package.

## Endpoint

```
POST /api/v1/episode/{id}/review
```

### Response

```json
{
  "success": true,
  "data": {
    "reviewId": "REV-5001",
    "status": "review"
  }
}
```

---

# Approve Episode

Approve an Episode.

## Endpoint

```
POST /api/v1/episode/{id}/approve
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

# Retrieve Scenes

Retrieve all Scenes belonging to an Episode.

## Endpoint

```
GET /api/v1/episode/{id}/scene
```

---

# Retrieve Dialogues

Retrieve all Dialogues belonging to an Episode.

## Endpoint

```
GET /api/v1/episode/{id}/dialogue
```

---

# Episode Timeline

Retrieve the chronological timeline.

## Endpoint

```
GET /api/v1/episode/{id}/timeline
```

---

# Episode Characters

Retrieve Characters appearing in the Episode.

## Endpoint

```
GET /api/v1/episode/{id}/characters
```

---

# Episode Assets

Retrieve production assets.

## Endpoint

```
GET /api/v1/episode/{id}/assets
```

---

# Episode Production Status

Retrieve production progress.

## Endpoint

```
GET /api/v1/episode/{id}/production
```

---

# Publish Episode

Publish an approved Episode.

## Endpoint

```
POST /api/v1/episode/{id}/publish
```

Publishing is only allowed after production and quality assurance are complete.

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
|404|Episode Not Found|
|409|Conflict|
|422|Canon Validation Failed|
|500|Internal Error|

---

# Error Codes

Possible error codes include:

```
EPISODE_NOT_FOUND

EPISODE_ALREADY_EXISTS

INVALID_EPISODE

CANON_CONFLICT

TIMELINE_CONFLICT

EPISODE_LOCKED

PRODUCTION_IN_PROGRESS

VALIDATION_FAILED

UNAUTHORIZED
```

---

# Related Resources

An Episode belongs to a Season and contains multiple Scenes.

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

An Episode references:

- Story
- Season
- Characters
- World
- Scene Collection
- Dialogue Collection
- Review Package
- Production Package
- Assets

---

# Security

Protected endpoints require authentication.

Example

```
Authorization: Bearer <token>
```

Authorization determines whether users may create, modify, generate, approve, publish, or delete Episode resources.

---

# Relationship with Other Documents

This document complements:

- REST API
- Season API
- Scene API
- Dialogue API
- Episode Planner
- Scene Generator
- Dialogue Generator
- Episode Schema
- Review API
- Production API

Together they define the complete lifecycle of Episode resources.

---

# Future Expansion

Future versions may support:

- AI episode rewriting
- automatic pacing optimization
- multiple ending variants
- episode branching
- collaborative editing
- multilingual generation
- streaming generation
- automatic production scheduling

These capabilities extend the Episode API while preserving the existing resource model.

---

# Summary

The Episode API provides a complete interface for managing Episode resources throughout the Suro & Buya AI Engine.

By supporting creation, AI-assisted planning, scene generation, dialogue generation, validation, review, approval, publishing, and integration with the production pipeline, the API establishes Episodes as the primary executable narrative unit that connects story planning with asset production and final publication.