# Bible Retrieval

Version: 1.0

---

# Purpose

Bible Retrieval is responsible for collecting the minimum set of canonical knowledge required to fulfill a creator's request.

Instead of relying on a large prompt containing the entire project, the engine retrieves only the information that is relevant to the current task.

This approach keeps the AI focused, improves consistency, and scales to long-running serialized productions.

---

# Objective

Retrieve the correct knowledge from the Universe Bible before any planning or generation begins.

Bible Retrieval answers the question:

> **"What knowledge does the engine need before it can continue?"**

Generation is prohibited until retrieval is complete.

---

# Position in the Engine Workflow

```
Creator Request

↓

Intent Detection

↓

Bible Retrieval

↓

Context Builder

↓

Canon Validation

↓

Planning

↓

Generation
```

Bible Retrieval always occurs after Intent Detection.

---

# Responsibilities

Bible Retrieval is responsible for:

- identifying required knowledge
- retrieving canonical information
- minimizing unnecessary context
- preserving canonical consistency
- preparing knowledge for the Context Builder

Bible Retrieval does **not** generate or modify content.

It only retrieves verified knowledge.

---

# Retrieval Sources

The engine retrieves information exclusively from the Universe Bible.

```
Universe Bible

├── Character Bible
├── World Bible
├── Story Bible
├── Visual Bible
└── Production Bible
```

Each Bible has a specific responsibility.

---

# Character Bible

Provides information such as:

- characters
- personalities
- appearances
- relationships
- motivations
- abilities
- dialogue style

---

# World Bible

Provides:

- locations
- cultures
- history
- organizations
- world rules
- technology
- geography

---

# Story Bible

Provides:

- premise
- themes
- story arcs
- season plans
- episode relationships
- major events
- narrative direction

---

# Visual Bible

Provides:

- character references
- environment references
- color palettes
- visual identity
- artistic style
- design consistency

---

# Production Bible

Provides:

- production assets
- episode plans
- scripts
- production status
- publishing information
- asset references

---

# Retrieval Strategy

The engine retrieves only what is required.

Example:

```
Intent

Create Character

↓

Retrieve

Character Bible

+

World Bible
```

No Story Bible is required.

---

Another example:

```
Intent

Create Episode

↓

Retrieve

Character Bible

+

World Bible

+

Story Bible

+

Production Bible
```

Only relevant information is retrieved.

---

# Selective Retrieval

The engine should avoid loading unnecessary knowledge.

Instead of retrieving:

```
All Characters
```

It retrieves:

```
Characters appearing in Episode 12
```

Instead of retrieving:

```
Entire World Bible
```

It retrieves:

```
Locations referenced by Episode 12
```

Selective retrieval improves efficiency and reduces noise.

---

# Retrieval Flow

```
Detected Intent

↓

Identify Required Knowledge

↓

Locate Bible Sections

↓

Retrieve Relevant Entries

↓

Validate Retrieval

↓

Send to Context Builder
```

Each step is deterministic and repeatable.

---

# Dependency Mapping

Different workflows require different Bible combinations.

| Workflow | Required Bibles |
|----------|-----------------|
| Create Character | Character, World |
| Create World | World |
| Create Story | Character, World, Story |
| Create Season | Character, World, Story |
| Create Episode | Character, World, Story, Production |
| Review | All Relevant Bibles |
| Production | Production, Visual, Story |

The engine retrieves only the minimum required knowledge.

---

# Canon Preservation

Bible Retrieval never invents information.

If required information does not exist, the engine should:

- report missing knowledge
- request creator input
- continue only if appropriate

Retrieval should never guess canonical facts.

---

# Missing Knowledge

Example:

```
Episode references:

Grandfather Hasan

↓

Character not found

↓

Missing Canon
```

The engine reports:

```
Missing Character

Creator action required.
```

The engine should not automatically create missing canon.

---

# Retrieval Validation

Before passing knowledge to the next stage, the engine verifies:

- referenced entries exist
- duplicated entries are removed
- canonical versions are used
- outdated revisions are ignored
- relationships remain valid

Only validated knowledge proceeds.

---

# Design Principles

Bible Retrieval follows these principles:

- Canon First
- Retrieve Before Generate
- Minimum Required Context
- Single Source of Truth
- Deterministic Retrieval

Knowledge should always come from verified canonical sources.

---

# Future Expansion

Bible Retrieval is designed to support additional knowledge sources in the future.

Possible extensions include:

- semantic search
- vector retrieval
- memory retrieval
- production history
- creator preferences
- reusable templates
- external knowledge connectors

These sources supplement—but never replace—the Universe Bible as the authoritative source.

---

# Summary

Bible Retrieval is the knowledge gateway of the AI Engine.

It transforms a creator's intent into a curated collection of canonical information required for planning and generation.

By retrieving only relevant knowledge from the Universe Bible, the engine maintains consistency, improves efficiency, and enables scalable AI-assisted serialized storytelling.