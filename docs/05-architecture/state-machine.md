# State Machine

Version: 1.0

---

# Purpose

The State Machine defines the lifecycle of every business object within the Suro & Buya AI Engine.

Rather than describing workflows or execution steps, the State Machine describes **the valid states an object can occupy and the allowed transitions between those states**.

This ensures that every artifact progresses through the engine in a controlled, predictable, and auditable manner.

---

# Objective

Provide a unified lifecycle model for all major objects in the Suro & Buya ecosystem.

The State Machine answers one fundamental question:

> **"What states can an object have, and how can it move between them?"**

---

# Design Principles

The State Machine follows these principles:

- Explicit States
- Explicit Transitions
- Human Approval
- Immutable Published Artifacts
- Traceable History
- Version Controlled

Objects should never change state without an explicit transition.

---

# Universal Lifecycle

Every major object follows the same high-level lifecycle.

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

This lifecycle applies to documents, plans, assets, and releases.

---

# State Overview

| State | Description |
|--------|-------------|
| Draft | Initial working version. |
| Review | Under human evaluation. |
| Approved | Officially accepted for the next stage. |
| Production | Being transformed into production assets. |
| Published | Officially released. |
| Archived | Preserved as historical record. |

---

# State Definitions

---

## Draft

The object has been created but has not yet been reviewed.

Examples:

- Character Draft
- Story Draft
- Episode Draft

Characteristics:

- editable
- not canonical
- internal only

Allowed transitions:

```
Draft

↓

Review
```

---

## Review

The object is being evaluated.

Review may include:

- creator review
- editorial review
- AI validation

Characteristics:

- pending approval
- revision allowed

Allowed transitions:

```
Review

↓

Approved

or

↓

Draft
```

---

## Approved

The object has been accepted.

Characteristics:

- canonical
- stable
- ready for production

Allowed transitions:

```
Approved

↓

Production
```

Minor corrections require a new version.

---

## Production

The object is actively used to generate production assets.

Examples:

- storyboard creation
- visual production
- voice production

Allowed transitions:

```
Production

↓

Published
```

---

## Published

The object becomes part of the official release.

Characteristics:

- immutable
- publicly available
- versioned

Allowed transitions:

```
Published

↓

Archived
```

Published objects should never return to earlier states.

---

## Archived

Historical versions are preserved.

Characteristics:

- read-only
- permanent
- traceable

Archived objects remain accessible for auditing and reference.

---

# State Transition Diagram

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

Revision path:

```
Review

↓

Draft
```

---

# Object Lifecycle Examples

## Story

```
Story Draft

↓

Story Review

↓

Story Approved

↓

Production

↓

Published
```

---

## Episode

```
Episode Draft

↓

Episode Review

↓

Episode Approved

↓

Script Production

↓

Published Episode
```

---

## Production Package

```
Draft Package

↓

QA Review

↓

Approved Package

↓

Publishing

↓

Archived Version
```

---

# Allowed Transitions

| From | To | Allowed |
|------|----|----------|
| Draft | Review | ✓ |
| Review | Draft | ✓ |
| Review | Approved | ✓ |
| Approved | Production | ✓ |
| Production | Published | ✓ |
| Published | Archived | ✓ |

Transitions outside this table are invalid.

---

# Invalid Transitions

Examples of invalid transitions:

```
Draft

↓

Published
```

```
Review

↓

Published
```

```
Published

↓

Draft
```

```
Archived

↓

Production
```

These transitions violate the production lifecycle.

---

# Revision Workflow

If revisions are required after review:

```
Review

↓

Revision

↓

Draft

↓

Review
```

Each revision creates a new version.

---

# Published Revisions

Published artifacts cannot be modified directly.

Instead:

```
Published

v1.0

↓

Revision

↓

Published

v1.1
```

Previous versions remain archived.

---

# Version Integration

Every state transition is associated with a version.

Example:

```
Draft

v0.1

↓

Review

v0.2

↓

Approved

v1.0

↓

Published

v1.0
```

Version history records every significant milestone.

---

# Human Approval

Human approval is mandatory before entering the Approved state.

```
Review

↓

Creator Approval

↓

Approved
```

AI cannot approve artifacts independently.

---

# Engine Behavior

The AI Engine enforces state transitions.

Example:

```
Draft

↓

Review Package

↓

Creator Decision

↓

Approved
```

The engine should reject invalid transitions.

---

# Relationship with Other Documents

This document complements:

- **Execution Model** — explains how the engine executes tasks.
- **Data Flow** — explains how information moves.
- **Versioning** — explains how object versions evolve.
- **Production Workflow** — explains how approved objects become published content.

Together they define the lifecycle of every business object.

---

# Future Expansion

Future versions may introduce additional states, such as:

- Pending Review
- Scheduled
- Deprecated
- Rejected
- Suspended
- Localized
- Restored

These states can extend the lifecycle without changing the core state model.

---

# Summary

The State Machine defines the lifecycle of every major object in the Suro & Buya AI Engine.

By organizing objects into explicit states—Draft, Review, Approved, Production, Published, and Archived—it provides a consistent governance model for documentation, planning, production, and publishing.

Every transition is intentional.

Every published artifact is immutable.

Every historical version is preserved.

This state model ensures that the Suro & Buya ecosystem remains predictable, traceable, and scalable as the project grows.