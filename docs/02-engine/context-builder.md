# Context Builder

Version: 1.0

---

# Purpose

The Context Builder assembles all retrieved knowledge into a structured working context that can be understood by the AI Engine.

While Bible Retrieval is responsible for collecting information, Context Builder is responsible for organizing that information into a coherent representation of the current task.

The resulting Working Context becomes the only context used during planning and generation.

---

# Objective

Transform retrieved canonical knowledge into a complete and focused Working Context.

Context Builder answers one fundamental question:

> **"Given everything we know, what does the AI need to understand before making a decision?"**

Generation never operates directly on raw Bible documents.

It always operates on the Working Context.

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

Context Builder is the bridge between knowledge retrieval and intelligent reasoning.

---

# Responsibilities

Context Builder is responsible for:

- organizing retrieved knowledge
- removing irrelevant information
- resolving references
- assembling production context
- preparing a structured Working Context

It does **not** validate canon.

It does **not** generate content.

Its responsibility is preparation.

---

# Input

The Context Builder receives:

- detected intent
- retrieved Bible entries
- creator request
- production state
- workflow metadata

Example:

```
Creator Request

Create Episode 5

+

Character Bible

+

World Bible

+

Story Bible

+

Season Plan

↓

Context Builder
```

---

# Output

The output is a structured Working Context.

Example:

```
Working Context

Mission

Create Episode 5

Characters

Suro
Buya
Pak Lurah

Location

Village Market

Season Goal

Introduce the Hidden Map

Story Objective

Reveal the first clue

Episode Objective

Build curiosity

Production Status

Draft
```

The Working Context becomes the foundation for Planning.

---

# Context Components

A Working Context consists of several layers.

---

## Request Context

Describes what the creator wants.

Examples:

- create
- update
- review
- generate

---

## Character Context

Contains only the characters relevant to the current task.

Includes:

- personalities
- motivations
- relationships
- dialogue style
- current emotional state

---

## World Context

Contains relevant environmental information.

Examples:

- locations
- world rules
- organizations
- historical events
- culture

Only referenced information is included.

---

## Story Context

Contains narrative information.

Examples:

- current season
- current episode
- active conflict
- ongoing story arc
- unresolved questions

---

## Production Context

Contains production-related information.

Examples:

- production stage
- script status
- asset availability
- episode number
- publishing target

---

# Context Assembly

The engine merges multiple knowledge sources.

```
Creator Request

+

Character Context

+

World Context

+

Story Context

+

Production Context

↓

Working Context
```

The result represents everything required for the current task.

---

# Context Scope

The Working Context should remain focused.

Bad example:

```
Entire Universe
```

Good example:

```
Characters appearing in Episode 5

+

Village Market

+

Season 1 Goal

+

Episode 5 Objective
```

Smaller contexts improve reasoning quality.

---

# Reference Resolution

Bible entries often reference one another.

Example:

```
Character

↓

Relationship

↓

Another Character

↓

Location

↓

Organization
```

The Context Builder resolves these references into a complete view before planning begins.

---

# Context Normalization

Before passing the Working Context forward, the engine should normalize:

- naming conventions
- identifiers
- timeline references
- location references
- relationship references

Normalization ensures every downstream component interprets the context consistently.

---

# Context Lifecycle

The Working Context exists only for the current workflow.

```
Retrieve

↓

Build Context

↓

Planning

↓

Generation

↓

Disposed
```

It is temporary and should never replace the Universe Bible.

---

# Design Principles

Context Builder follows these principles:

- Context First
- Retrieve Before Generate
- Minimum Necessary Context
- Deterministic Assembly
- Separation of Knowledge and Reasoning

The Working Context should always be concise, relevant, and reproducible.

---

# Future Expansion

Future versions may enrich the Working Context with additional sources such as:

- conversation history
- creator preferences
- production memory
- reusable templates
- semantic retrieval
- visual references
- external production systems

Regardless of future enhancements, the Universe Bible remains the primary source of canonical knowledge.

---

# Relationship with Other Components

```
Bible Retrieval

↓

Context Builder

↓

Canon Validation

↓

Planning
```

Bible Retrieval collects information.

Context Builder organizes it.

Canon Validation verifies it.

Planning uses it.

Each module has a single responsibility.

---

# Summary

The Context Builder transforms retrieved knowledge into a structured Working Context that the AI Engine can reason about.

By organizing only the information required for the current task, the Context Builder reduces complexity, improves generation quality, and ensures that every downstream component operates from the same consistent understanding of the universe.