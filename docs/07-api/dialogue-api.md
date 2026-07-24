# Dialogue API

Version: 1.0

---

# Purpose

The Dialogue API provides endpoints for creating, retrieving, generating, validating, reviewing, and managing Dialogue resources within the Suro & Buya AI Engine.

A Dialogue represents spoken interactions between characters within a Scene. It preserves each character's personality, speech style, emotional state, and canonical behavior while advancing the narrative.

Dialogue generation is driven by the Dialogue Generator and validated against the Character Bible, Story Bible, and Universe Bible.

---

# Base Endpoint

```
/api/v1/dialogue
```

---

# Resource

```
Dialogue
```

Schema Reference

```
dialogue.schema.json
```

---

# Resource Identifier

Every Dialogue uses a unique identifier.

Example

```
DLG-001

DLG-145

DLG-982
```

---

# Dialogue Lifecycle

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

Only approved Dialogues become part of the final production script.

---

# Create Dialogue

Creates a new Dialogue.

## Endpoint

```
POST /api/v1/dialogue
```

### Request

```json
{
  "sceneId": "SCN-001",
  "speaker": "CHR-SURO",
  "text": "We must find the sacred keris before sunset."
}
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "DLG-001",
    "status": "draft"
  }
}
```

---

# Get Dialogue

Retrieve a Dialogue.

## Endpoint

```
GET /api/v1/dialogue/{id}
```

---

# List Dialogues

Retrieve paginated Dialogues.

## Endpoint

```
GET /api/v1/dialogue
```

Example

```
GET /api/v1/dialogue?page=1&pageSize=20
```

---

# Update Dialogue

Update part of a Dialogue.

## Endpoint

```
PATCH /api/v1/dialogue/{id}
```

---

# Replace Dialogue

Replace an existing Dialogue.

## Endpoint

```
PUT /api/v1/dialogue/{id}
```

---

# Delete Dialogue

Delete a Dialogue.

## Endpoint

```
DELETE /api/v1/dialogue/{id}
```

Deletion is only allowed before production begins.

---

# Generate Dialogue

Generate Dialogue using the Dialogue Generator.

## Endpoint

```
POST /api/v1/dialogue/{id}/generate
```

### Response

```json
{
  "success": true,
  "data": {
    "jobId": "JOB-901",
    "status": "running"
  }
}
```

---

# Generate Scene Dialogues

Generate every Dialogue within a Scene.

## Endpoint

```
POST /api/v1/scene/{sceneId}/dialogue/generate
```

---

# Retrieve Generated Dialogue

Retrieve AI-generated Dialogue.

## Endpoint

```
GET /api/v1/dialogue/{id}/generated
```

---

# Validate Dialogue

Validate Dialogue consistency.

## Endpoint

```
POST /api/v1/dialogue/{id}/validate
```

Validation includes:

- Character personality
- Speech style
- Vocabulary
- Emotional consistency
- Timeline consistency
- Canon consistency

---

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

# Review Dialogue

Generate a Review Package.

## Endpoint

```
POST /api/v1/dialogue/{id}/review
```

---

# Approve Dialogue

Approve a Dialogue.

## Endpoint

```
POST /api/v1/dialogue/{id}/approve
```

---

# Retrieve Speaker

Retrieve the speaking Character.

## Endpoint

```
GET /api/v1/dialogue/{id}/speaker
```

---

# Retrieve Scene

Retrieve the parent Scene.

## Endpoint

```
GET /api/v1/dialogue/{id}/scene
```

---

# Retrieve Voice Profile

Retrieve voice configuration for dialogue production.

## Endpoint

```
GET /api/v1/dialogue/{id}/voice
```

---

# Generate Voice Script

Generate the production-ready voice script.

## Endpoint

```
POST /api/v1/dialogue/{id}/voice/generate
```

---

# Retrieve Production Status

Retrieve dialogue production progress.

## Endpoint

```
GET /api/v1/dialogue/{id}/production
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
|404|Dialogue Not Found|
|409|Conflict|
|422|Canon Validation Failed|
|500|Internal Error|

---

# Error Codes

Possible error codes include:

```
DIALOGUE_NOT_FOUND

INVALID_DIALOGUE

CHARACTER_NOT_FOUND

SCENE_NOT_FOUND

CHARACTER_VOICE_MISMATCH

CHARACTER_PERSONALITY_CONFLICT

CANON_CONFLICT

VALIDATION_FAILED

UNAUTHORIZED
```

---

# Related Resources

A Dialogue belongs to a Scene and is spoken by a Character.

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

A Dialogue references:

- Character
- Scene
- Episode
- Story
- Voice Profile
- Character Bible
- Review Package
- Production Package

---

# Security

Protected endpoints require authentication.

Example

```
Authorization: Bearer <token>
```

Authorization determines whether users may create, generate, modify, approve, or delete Dialogue resources.

---

# Relationship with Other Documents

This document complements:

- Dialogue Generator
- Dialogue Schema
- Character API
- Scene API
- Voice Production
- Character Bible
- Review API
- Production API

Together they define the complete lifecycle of Dialogue resources.

---

# Future Expansion

Future versions may support:

- multilingual dialogue generation
- emotional speech synthesis
- regional dialect profiles
- conversational pacing optimization
- lip-sync timing metadata
- voice actor assignment
- automatic subtitle generation
- dialogue quality scoring

These capabilities extend the Dialogue API while preserving the existing resource model.

---

# Summary

The Dialogue API provides a complete interface for managing Dialogue resources throughout the Suro & Buya AI Engine.

By supporting creation, AI-assisted dialogue generation, validation, review, approval, voice preparation, and production integration, the API ensures that every spoken line remains faithful to each character's personality, the Universe Bible, and the narrative intent while serving as the foundation for script production and voice generation.