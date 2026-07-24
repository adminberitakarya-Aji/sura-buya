# Review API

Version: 1.0

---

# Purpose

The Review API provides endpoints for creating, retrieving, managing, and approving Review Packages within the Suro & Buya AI Engine.

A Review Package consolidates the outputs of the AI Engine—including validation results, consistency analysis, quality metrics, detected issues, and recommendations—before content progresses to production.

The Review API acts as the final quality gate between AI generation and production.

---

# Base Endpoint

```
/api/v1/review
```

---

# Resource

```
Review
```

Schema Reference

```
review.schema.json
```

---

# Resource Identifier

Every Review Package uses a unique identifier.

Example

```
REV-0001

REV-0158

REV-2043
```

---

# Review Lifecycle

```
Pending

↓

Running

↓

Completed

↓

Approved

↓

Rejected

↓

Archived
```

Only approved reviews allow production to continue.

---

# Supported Review Targets

Reviews may be created for:

- Character
- World
- Story
- Season
- Episode
- Scene
- Dialogue
- Production Package

---

# Create Review

Create a Review Package.

## Endpoint

```
POST /api/v1/review
```

---

### Request

```json
{
  "resourceType": "episode",
  "resourceId": "EPI-001"
}
```

---

### Response

```json
{
  "success": true,
  "data": {
    "reviewId": "REV-0001",
    "status": "running"
  }
}
```

---

# Get Review

Retrieve a Review Package.

## Endpoint

```
GET /api/v1/review/{id}
```

Example

```
GET /api/v1/review/REV-0001
```

---

# List Reviews

Retrieve paginated reviews.

## Endpoint

```
GET /api/v1/review
```

Example

```
GET /api/v1/review?page=1&pageSize=20
```

---

# Update Review

Update review metadata.

## Endpoint

```
PATCH /api/v1/review/{id}
```

Only reviewer notes and metadata may be modified.

---

# Delete Review

Delete a Review Package.

## Endpoint

```
DELETE /api/v1/review/{id}
```

Deletion may be restricted after approval.

---

# Start Review

Execute the Review Engine.

## Endpoint

```
POST /api/v1/review/{id}/start
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

# Review Status

Retrieve execution status.

## Endpoint

```
GET /api/v1/review/{id}/status
```

---

### Response

```json
{
  "success": true,
  "data": {
    "status": "completed",
    "progress": 100
  }
}
```

---

# Retrieve Validation Results

Retrieve validation summary.

## Endpoint

```
GET /api/v1/review/{id}/validation
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

# Retrieve Issues

Retrieve detected issues.

## Endpoint

```
GET /api/v1/review/{id}/issues
```

---

### Response

```json
{
  "success": true,
  "data": [
    {
      "severity": "warning",
      "message": "Character age is not specified."
    }
  ]
}
```

---

# Retrieve Recommendations

Retrieve AI recommendations.

## Endpoint

```
GET /api/v1/review/{id}/recommendations
```

---

# Retrieve Metrics

Retrieve quality metrics.

## Endpoint

```
GET /api/v1/review/{id}/metrics
```

Example metrics:

- Canon Score
- Consistency Score
- Dialogue Score
- Story Score
- Production Readiness

---

# Approve Review

Approve the Review Package.

## Endpoint

```
POST /api/v1/review/{id}/approve
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

# Reject Review

Reject the Review Package.

## Endpoint

```
POST /api/v1/review/{id}/reject
```

---

### Request

```json
{
  "reason": "Timeline inconsistency detected."
}
```

---

# Export Review

Export the complete Review Package.

## Endpoint

```
GET /api/v1/review/{id}/export
```

Supported formats:

- JSON
- Markdown
- PDF

---

# Response Codes

| HTTP | Meaning |
|------|---------|
|200|Success|
|201|Created|
|202|Review Started|
|204|Deleted|
|400|Validation Error|
|401|Unauthorized|
|403|Forbidden|
|404|Review Not Found|
|409|Conflict|
|422|Review Failed|
|500|Internal Error|

---

# Error Codes

Possible error codes include:

```
REVIEW_NOT_FOUND

INVALID_REVIEW

RESOURCE_NOT_FOUND

VALIDATION_FAILED

CANON_CONFLICT

REVIEW_ALREADY_RUNNING

REVIEW_ALREADY_APPROVED

UNAUTHORIZED
```

---

# Related Resources

A Review Package may reference any production resource.

```
Character

↓

World

↓

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

Each Review Package aggregates:

- Validation Results
- Canon Validation
- Consistency Analysis
- AI Recommendations
- Quality Metrics
- Approval Decision

---

# Security

Protected endpoints require authentication.

Example

```
Authorization: Bearer <token>
```

Authorization determines whether users may create, execute, approve, reject, or export Review Packages.

---

# Relationship with Other Documents

This document complements:

- Review Package
- Review Architecture
- Canon Validator
- Consistency Check
- Character API
- Story API
- Episode API
- Production API

Together they define the complete quality assurance workflow before production.

---

# Future Expansion

Future versions may support:

- collaborative review
- reviewer assignment
- review history
- AI review explanation
- quality trend analysis
- automatic approval rules
- review comparison
- review dashboards

These capabilities extend the Review API while preserving the existing review workflow.

---

# Summary

The Review API provides a unified interface for managing Review Packages throughout the Suro & Buya AI Engine.

By supporting automated validation, issue detection, quality scoring, AI recommendations, approval workflows, and review exports, the API ensures that every Character, World, Story, Season, Episode, Scene, Dialogue, and Production Package satisfies the standards defined by the Universe Bible before progressing to production.