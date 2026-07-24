# Scene API

Version: 1.0

---

# Purpose

The Scene API provides endpoints for creating, retrieving, updating, generating, validating, reviewing, and managing Scene resources within the Suro & Buya AI Engine.

A Scene is the smallest narrative unit that represents a continuous sequence of actions occurring in a single location and time. Scenes collectively form an Episode and serve as the foundation for dialogue generation, storyboarding, visual production, and voice production.

---

# Base Endpoint

```
/api/v1/scene
```

---

# Resource

```
Scene
```

Schema Reference

```
scene.schema.json
```

---

# Resource Identifier

Every Scene uses a unique identifier.

Example

```
SCN-001

SCN-015

SCN-120
```

---

# Scene Lifecycle

```
Draft

↓

Generated

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

Only approved Scenes are eligible for production.

---

# Create Scene

Creates a new Scene.

## Endpoint

```
POST /api/v1/scene
```

### Request

```json
{
  "episodeId": "EPI-001",
  "sceneNumber": 1,
  "title": "Arrival at the Temple",
  "location": "Ancient Temple"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "SCN-001",
    "status": "draft"
  }
}
```

---

# Get Scene

Retrieve a Scene.

## Endpoint

```
GET /api/v1/scene/{id}
```

---

# List Scenes

Retrieve paginated Scenes.

## Endpoint

```
GET /api/v1/scene
```

Example

```
GET /api/v1/scene?page=1&pageSize=20
```

---

# Update Scene

Update part of a Scene.

## Endpoint

```
PATCH /api/v1/scene/{id}
```

---

# Replace Scene

Replace an existing Scene.

## Endpoint

```
PUT /api/v1/scene/{id}
```

---

# Delete Scene

Delete a Scene.

## Endpoint

```
DELETE /api/v1/scene/{id}
```

Deletion is only allowed before production begins.

---

# Generate Scene

Generate Scene content using the Scene Generator.

## Endpoint

```
POST /api/v1/scene/{id}/generate
```

### Response

```json
{
  "success": true,
  "data": {
    "jobId": "JOB-801",
    "status": "running"
  }
}
```

---

# Retrieve Generated Scene

Retrieve the generated Scene.

## Endpoint

```
GET /api/v1/scene/{id}/generated
```

---

# Validate Scene

Validate Scene consistency.

## Endpoint

```
POST /api/v1/scene/{id}/validate
```

Validation checks include:

- Character consistency
- Timeline consistency
- World consistency
- Canon consistency
- Story continuity

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

# Review Scene

Generate a Review Package.

## Endpoint

```
POST /api/v1/scene/{id}/review
```

---

# Approve Scene

Approve a Scene.

## Endpoint

```
POST /api/v1/scene/{id}/approve
```

---

# Retrieve Dialogues

Retrieve all Dialogues within a Scene.

## Endpoint

```
GET /api/v1/scene/{id}/dialogue
```

---

# Generate Dialogues

Generate Dialogues for the Scene.

## Endpoint

```
POST /api/v1/scene/{id}/dialogue/generate
```

---

# Retrieve Storyboard

Retrieve the generated storyboard.

## Endpoint

```
GET /api/v1/scene/{id}/storyboard
```

---

# Generate Storyboard

Generate storyboard for the Scene.

## Endpoint

```
POST /api/v1/scene/{id}/storyboard/generate
```

---

# Retrieve Visual Assets

Retrieve Scene visual assets.

## Endpoint

```
GET /api/v1/scene/{id}/visual
```

---

# Retrieve Voice Assets

Retrieve Scene voice assets.

## Endpoint

```
GET /api/v1/scene/{id}/voice
```

---

# Retrieve Production Status

Retrieve production progress.

## Endpoint

```
GET /api/v1/scene/{id}/production
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
|404|Scene Not Found|
|409|Conflict|
|422|Canon Validation Failed|
|500|Internal Error|

---

# Error Codes

Possible error codes include:

```
SCENE_NOT_FOUND

INVALID_SCENE

SCENE_LOCKED

CANON_CONFLICT

TIMELINE_CONFLICT

CHARACTER_CONFLICT

VALIDATION_FAILED

UNAUTHORIZED
```

---

# Related Resources

A Scene belongs to an Episode and contains Dialogues.

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

A Scene references:

- Episode
- Characters
- Location
- Timeline
- Dialogue Collection
- Storyboard
- Visual Assets
- Voice Assets
- Review Package

---

# Security

Protected endpoints require authentication.

Example

```
Authorization: Bearer <token>
```

Authorization determines whether users may create, generate, approve, modify, or delete Scene resources.

---

# Relationship with Other Documents

This document complements:

- Episode API
- Dialogue API
- Scene Generator
- Storyboard Production
- Visual Production
- Voice Production
- Review API
- Scene Schema

Together they define the complete lifecycle of Scene resources.

---

# Future Expansion

Future versions may support:

- cinematic camera planning
- shot list generation
- automatic storyboard refinement
- emotion timeline generation
- animation timeline generation
- multi-angle scene generation
- cinematic lighting generation
- real-time collaborative editing

These capabilities extend the Scene API while preserving the existing resource model.

---

# Summary

The Scene API provides a complete interface for managing Scene resources throughout the Suro & Buya AI Engine.

By supporting creation, AI-assisted scene generation, validation, review, approval, dialogue generation, storyboard generation, and production asset integration, the API establishes Scenes as the fundamental production unit that bridges narrative planning with visual, audio, and publishing workflows.