# Production API

Version: 1.0

---

# Purpose

The Production API provides endpoints for managing the complete production pipeline within the Suro & Buya AI Engine.

After an Episode has been approved through the Review Engine, the Production API orchestrates every production stage, including script generation, storyboard creation, visual production, voice production, quality assurance, asset management, and publishing.

The Production API serves as the execution layer that transforms approved narrative content into production-ready media assets.

---

# Base Endpoint

```
/api/v1/production
```

---

# Resource

```
Production
```

Schema Reference

```
production.schema.json
```

---

# Resource Identifier

Every Production Package uses a unique identifier.

Example

```
PRD-0001

PRD-0158

PRD-2045
```

---

# Production Lifecycle

```
Pending

↓

Script

↓

Storyboard

↓

Visual

↓

Voice

↓

Quality Assurance

↓

Ready

↓

Published

↓

Archived
```

Each stage represents a controlled production milestone.

---

# Create Production

Create a Production Package.

## Endpoint

```
POST /api/v1/production
```

### Request

```json
{
  "episodeId": "EPI-001"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "productionId": "PRD-0001",
    "status": "pending"
  }
}
```

---

# Get Production

Retrieve a Production Package.

## Endpoint

```
GET /api/v1/production/{id}
```

Example

```
GET /api/v1/production/PRD-0001
```

---

# List Productions

Retrieve paginated Production Packages.

## Endpoint

```
GET /api/v1/production
```

Example

```
GET /api/v1/production?page=1&pageSize=20
```

---

# Update Production

Update production metadata.

## Endpoint

```
PATCH /api/v1/production/{id}
```

Only metadata and scheduling information may be updated.

---

# Delete Production

Delete a Production Package.

## Endpoint

```
DELETE /api/v1/production/{id}
```

Deletion is only allowed before production execution begins.

---

# Start Production

Start the production workflow.

## Endpoint

```
POST /api/v1/production/{id}/start
```

---

### Response

```json
{
  "success": true,
  "data": {
    "status": "running"
  }
}
```

---

# Production Status

Retrieve production progress.

## Endpoint

```
GET /api/v1/production/{id}/status
```

### Response

```json
{
  "success": true,
  "data": {
    "status": "visual",
    "progress": 65
  }
}
```

---

# Generate Script

Generate the production script.

## Endpoint

```
POST /api/v1/production/{id}/script
```

Invokes the Script Production Engine.

---

# Retrieve Script

Retrieve the generated script.

## Endpoint

```
GET /api/v1/production/{id}/script
```

---

# Generate Storyboard

Generate the storyboard.

## Endpoint

```
POST /api/v1/production/{id}/storyboard
```

Invokes the Storyboard Production Engine.

---

# Retrieve Storyboard

Retrieve storyboard assets.

## Endpoint

```
GET /api/v1/production/{id}/storyboard
```

---

# Generate Visual Assets

Generate visual assets.

## Endpoint

```
POST /api/v1/production/{id}/visual
```

Invokes the Visual Production Engine.

---

# Retrieve Visual Assets

Retrieve rendered visual assets.

## Endpoint

```
GET /api/v1/production/{id}/visual
```

---

# Generate Voice Assets

Generate narration and dialogue audio.

## Endpoint

```
POST /api/v1/production/{id}/voice
```

Invokes the Voice Production Engine.

---

# Retrieve Voice Assets

Retrieve generated voice assets.

## Endpoint

```
GET /api/v1/production/{id}/voice
```

---

# Run Quality Assurance

Execute the Quality Assurance pipeline.

## Endpoint

```
POST /api/v1/production/{id}/qa
```

Validation includes:

- Script completeness
- Storyboard completeness
- Visual quality
- Voice synchronization
- Canon consistency
- Missing assets

---

# Retrieve QA Report

Retrieve Quality Assurance report.

## Endpoint

```
GET /api/v1/production/{id}/qa
```

---

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

# Retrieve Assets

Retrieve all generated assets.

## Endpoint

```
GET /api/v1/production/{id}/assets
```

Asset types include:

- Script
- Storyboard
- Images
- Audio
- Metadata
- Production Manifest

---

# Export Production Package

Export the complete production package.

## Endpoint

```
GET /api/v1/production/{id}/export
```

Supported formats:

- ZIP
- JSON
- Markdown

---

# Publish Production

Publish the completed production package.

## Endpoint

```
POST /api/v1/production/{id}/publish
```

Publishing is only allowed after Quality Assurance passes successfully.

---

### Response

```json
{
  "success": true,
  "data": {
    "status": "published"
  }
}
```

---

# Archive Production

Archive a completed production package.

## Endpoint

```
POST /api/v1/production/{id}/archive
```

---

# Response Codes

| HTTP | Meaning |
|------|---------|
|200|Success|
|201|Created|
|202|Production Started|
|204|Deleted|
|400|Validation Error|
|401|Unauthorized|
|403|Forbidden|
|404|Production Not Found|
|409|Conflict|
|422|Quality Check Failed|
|500|Internal Error|

---

# Error Codes

Possible error codes include:

```
PRODUCTION_NOT_FOUND

INVALID_PRODUCTION

PRODUCTION_ALREADY_RUNNING

PRODUCTION_ALREADY_COMPLETED

QA_FAILED

ASSET_GENERATION_FAILED

PUBLISH_FAILED

VALIDATION_FAILED

UNAUTHORIZED
```

---

# Related Resources

A Production Package aggregates every production artifact.

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

↓

Production
```

Production references:

- Episode
- Script
- Storyboard
- Visual Assets
- Voice Assets
- QA Report
- Review Package
- Asset Manifest

---

# Security

Protected endpoints require authentication.

Example

```
Authorization: Bearer <token>
```

Authorization determines whether users may execute production, generate assets, publish, archive, or export Production Packages.

---

# Relationship with Other Documents

This document complements:

- Production Workflow
- Script Production
- Storyboard Production
- Visual Production
- Voice Production
- Quality Assurance
- Asset Pipeline
- Production Schema
- Publishing
- Review API

Together they define the complete production execution workflow.

---

# Future Expansion

Future versions may support:

- distributed rendering
- cloud rendering queues
- video composition
- animation rendering
- subtitle generation
- automated thumbnail generation
- multi-platform publishing
- production analytics
- rendering cost estimation
- production scheduling

These capabilities extend the Production API while preserving the existing production model.

---

# Summary

The Production API provides a unified interface for orchestrating the complete production pipeline within the Suro & Buya AI Engine.

By managing script generation, storyboard production, visual rendering, voice synthesis, quality assurance, asset packaging, publishing, and archival, the API transforms approved narrative content into production-ready media while ensuring consistency with the Universe Bible and maintaining a standardized, traceable production workflow.