# API Overview

Version: 1.0

---

# Purpose

The API provides the communication layer between external applications and the Suro & Buya AI Engine.

It enables Creator Studio, production services, automation pipelines, and future third-party applications to interact with the engine through a consistent, versioned, and secure interface.

The API is designed around business capabilities rather than internal engine implementation.

---

# Vision

The API should make the engine accessible without exposing its complexity.

Applications interact with resources.

The engine handles orchestration.

This follows the core philosophy of the project:

> **Complex Engine. Simple Experience.**

---

# Objectives

The API is designed to:

- expose all creator workflows
- expose all production workflows
- expose engine capabilities
- maintain stable interfaces
- support automation
- enable future integrations
- provide predictable behavior

---

# API Architecture

```
Client

↓

REST API

↓

Application Layer

↓

Engine Workflow

↓

Engine Components

↓

Knowledge Layer

↓

Universe Bible
```

Clients never communicate directly with engine components.

All requests pass through the API layer.

---

# API Design Philosophy

The API follows several principles.

## Resource First

Everything is represented as a resource.

Examples:

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

---

## Stateless

Every request contains all required information.

The server does not depend on previous requests.

---

## Versioned

Every endpoint belongs to a version.

Example

```
/api/v1
```

This allows future improvements without breaking existing clients.

---

## Predictable

Similar resources follow similar conventions.

Example

```
GET

POST

PATCH

DELETE
```

Behavior should remain consistent across the entire API.

---

## Secure

All protected endpoints require authentication.

Permissions are evaluated before execution.

---

# API Categories

The API is divided into several logical domains.

```
Creator API

↓

Engine API

↓

Review API

↓

Production API

↓

Administration API
```

Each category represents a business capability.

---

# Creator APIs

Creator APIs support content creation.

Examples:

```
Character

World

Story

Season

Episode
```

These APIs correspond directly to the Creator Workflow.

---

# Engine APIs

Engine APIs expose AI capabilities.

Examples:

```
Generate Scene

Generate Dialogue

Validate Canon

Build Context

Retrieve Bible
```

Most creator actions internally invoke these services.

---

# Review APIs

Review APIs manage quality assurance.

Examples:

```
Validation

Review Package

Approval

Revision
```

These APIs support the Human Review process.

---

# Production APIs

Production APIs manage production assets.

Examples:

```
Storyboard

Visual

Voice

Publishing

Versioning
```

Production APIs operate after approval.

---

# Administration APIs

Administrative APIs support platform management.

Examples:

```
Health

Configuration

Metrics

Logs

Monitoring
```

These APIs are intended for operational use.

---

# Resource Hierarchy

The API mirrors the engine's object hierarchy.

```
Story

└── Season

      └── Episode

            └── Scene

                  └── Dialogue
```

Relationships remain consistent across the system.

---

# Request Lifecycle

Every request follows the same lifecycle.

```
Client Request

↓

Authentication

↓

Authorization

↓

Validation

↓

Engine Execution

↓

Review

↓

Response
```

This lifecycle applies to every API endpoint.

---

# Standard Response

Successful responses follow a common structure.

```json
{
  "success": true,
  "data": {},
  "metadata": {}
}
```

---

# Error Response

Errors follow a standardized format.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Story conflicts with the Universe Bible."
  }
}
```

This enables predictable error handling.

---

# Long Running Operations

Some engine operations require significant processing time.

Examples:

- story planning
- episode generation
- dialogue generation
- review package creation

These operations return a Job resource.

```
POST

↓

Job Created

↓

Running

↓

Completed
```

The client retrieves progress through the Job endpoint.

---

# API Consistency

Every endpoint should provide:

- consistent naming
- consistent responses
- consistent status codes
- consistent pagination
- consistent filtering
- consistent authentication
- consistent versioning

Consistency improves developer experience.

---

# API Documentation

Every endpoint should define:

- purpose
- request format
- response format
- validation rules
- example requests
- example responses
- possible errors

Documentation is considered part of the API contract.

---

# Relationship with Other Documents

This document introduces the overall API architecture.

Detailed specifications are provided in:

- REST API
- Authentication
- Conventions
- Error Handling
- Pagination
- Versioning
- Character API
- World API
- Story API
- Season API
- Episode API
- Scene API
- Dialogue API
- Review API
- Production API
- Webhooks

Together these documents define the complete API specification for the Suro & Buya AI Engine.

---

# Future Expansion

The API architecture is designed to support future capabilities, including:

- GraphQL
- WebSocket APIs
- Server-Sent Events
- gRPC
- MCP Server Interface
- Plugin APIs
- External AI providers
- Multi-project workspaces

These additions extend the API without changing its core principles.

---

# Summary

The API Overview defines the overall communication architecture of the Suro & Buya AI Engine.

By organizing functionality around business resources, enforcing consistent design conventions, and separating external interfaces from internal engine implementation, the API provides a stable, scalable, and developer-friendly foundation for Creator Studio, production pipelines, automation services, and future integrations.

The API exposes the engine.

The engine manages the complexity.

Applications interact through a simple, consistent interface.