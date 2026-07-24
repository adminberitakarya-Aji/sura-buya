# Webhooks

Version: 1.0

---

# Purpose

The Webhooks Architecture enables the Suro & Buya AI Engine to notify external systems whenever important events occur.

Instead of continuously polling the REST API, external applications can subscribe to event notifications and receive real-time updates.

Webhooks provide an event-driven integration model for the platform.

---

# Objective

Provide a standardized mechanism for:

- event notifications
- production updates
- workflow automation
- third-party integration
- asynchronous communication

The Webhooks Architecture answers one fundamental question:

> **"How do external systems know that something has happened?"**

---

# Design Principles

The webhook system follows these principles:

- Event Driven
- Reliable
- Secure
- Idempotent
- Observable
- Extensible

Every significant event should be publishable.

---

# Architecture

```
AI Engine

↓

Event Bus

↓

Webhook Dispatcher

↓

Subscriber Endpoint
```

The engine never calls external systems directly.

All notifications pass through the Webhook Dispatcher.

---

# Webhook Lifecycle

```
Event Occurs

↓

Event Published

↓

Webhook Created

↓

Delivery Attempt

↓

Success
      │
      └── Retry

↓

Completed
```

---

# Webhook Endpoint

Subscribers register an HTTPS endpoint.

Example

```
https://example.com/webhooks/suro
```

Only HTTPS endpoints are supported.

---

# Event Format

Every webhook uses a common payload.

```json
{
  "id": "EVT-1001",
  "type": "episode.approved",
  "timestamp": "2026-07-24T08:30:00Z",
  "data": {}
}
```

---

# Event Fields

| Field | Description |
|--------|-------------|
| id | Unique event identifier |
| type | Event type |
| timestamp | Event creation time |
| data | Event payload |

---

# Common Events

Core events include:

```
character.created

character.updated

world.created

story.created

season.created

episode.created

scene.created

dialogue.created

review.completed

review.approved

production.started

production.completed

production.failed

asset.generated

asset.failed

publish.completed
```

---

# Character Events

```
character.created

character.updated

character.deleted

character.approved
```

---

# Story Events

```
story.created

story.updated

story.approved

story.archived
```

---

# Season Events

```
season.created

season.approved

season.updated
```

---

# Episode Events

```
episode.created

episode.generated

episode.reviewed

episode.approved

episode.published
```

---

# Scene Events

```
scene.generated

scene.approved
```

---

# Dialogue Events

```
dialogue.generated

dialogue.approved
```

---

# Review Events

```
review.started

review.completed

review.approved

review.rejected
```

---

# Production Events

```
production.started

production.script.completed

production.storyboard.completed

production.visual.completed

production.voice.completed

production.qa.completed

production.completed
```

---

# Asset Events

```
asset.generated

asset.updated

asset.deleted
```

---

# Publishing Events

```
publish.started

publish.completed

publish.failed
```

---

# Example Payload

```json
{
  "id": "EVT-2045",
  "type": "episode.approved",
  "timestamp": "2026-07-24T08:30:00Z",
  "data": {
    "episodeId": "EPI-001",
    "title": "The Lost Keris",
    "status": "approved"
  }
}
```

---

# Delivery Method

Webhooks are delivered using:

```
HTTP POST
```

Request Body

```
application/json
```

---

# Response Requirements

Subscribers should respond with:

```
HTTP 200
```

or

```
HTTP 204
```

Successful responses stop retries.

---

# Retry Policy

Failed deliveries are automatically retried.

Example schedule

```
1 minute

↓

5 minutes

↓

15 minutes

↓

1 hour

↓

6 hours
```

After the maximum retry count, the webhook is marked as failed.

---

# Idempotency

Each event contains a unique Event ID.

```
EVT-2045
```

Subscribers should ignore duplicate Event IDs.

---

# Authentication

Webhook requests should be authenticated.

Recommended header

```
X-Webhook-Signature
```

Example

```
sha256=8fa9d3...
```

Subscribers verify the signature before processing.

---

# Security

Security recommendations:

- HTTPS only
- signature verification
- secret rotation
- timestamp validation
- replay protection
- IP filtering (optional)

Sensitive information should never be transmitted unnecessarily.

---

# Timeout

Recommended timeout

```
10 seconds
```

Long-running processing should be asynchronous.

---

# Ordering

Event delivery order is not guaranteed.

Subscribers should rely on timestamps and resource versions rather than delivery sequence.

---

# Event Versioning

Every event may include its schema version.

Example

```json
{
  "version": "1.0.0"
}
```

This enables future compatibility.

---

# Error Handling

Failed webhook deliveries should be logged.

Example metadata:

- eventId
- endpoint
- statusCode
- retryCount
- timestamp

Delivery failures do not affect the internal engine workflow.

---

# Monitoring

Recommended webhook metrics:

- delivery success rate
- average latency
- retry count
- failure rate
- endpoint availability

These metrics improve operational visibility.

---

# Relationship with Other Documents

This document complements:

- REST API
- API Overview
- Authentication
- Error Handling
- Production API
- Review API
- Publishing

Together they define both synchronous API interactions and asynchronous event notifications.

---

# Future Expansion

Future versions may support:

- webhook subscriptions
- event filtering
- batch delivery
- dead-letter queues
- CloudEvents compatibility
- event replay
- event streaming
- WebSocket notifications
- Server-Sent Events (SSE)

These enhancements extend the event-driven architecture while maintaining compatibility with existing webhook integrations.

---

# Summary

The Webhooks Architecture provides a reliable, secure, and event-driven mechanism for integrating external systems with the Suro & Buya AI Engine.

By publishing standardized events for Characters, Stories, Seasons, Episodes, Reviews, Production, Assets, and Publishing, the platform enables real-time automation, workflow orchestration, and seamless integration with third-party services while preserving reliability, traceability, and backward compatibility.