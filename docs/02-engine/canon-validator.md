# Canon Validator

Version: 1.0

---

# Purpose

The Canon Validator ensures that every planning and generation process remains consistent with the established Universe Bible.

Its primary responsibility is to protect the integrity of the universe by detecting conflicts before content is generated.

The Canon Validator acts as the guardian of the project's Single Source of Truth.

---

# Objective

Verify that the current Working Context does not violate established canon.

The Canon Validator answers one critical question:

> **"Can this request proceed without contradicting the Universe Bible?"**

Only validated contexts may continue to the Planning stage.

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

Canon Validator

↓

Planning

↓

Generation
```

Canon validation always occurs before planning.

---

# Responsibilities

The Canon Validator is responsible for:

- validating canonical consistency
- detecting contradictions
- identifying missing references
- verifying relationships
- protecting timeline integrity
- generating validation reports

It does **not** modify canon.

It does **not** generate content.

Its sole responsibility is validation.

---

# Input

The Canon Validator receives:

- Working Context
- Universe Bible
- Production Rules

Example:

```
Working Context

↓

Characters

↓

Locations

↓

Timeline

↓

Story Progress

↓

Canon Validation
```

---

# Output

The output is a Canon Validation Report.

Example:

```
Validation Status

PASS

Warnings

0

Errors

0

Ready for Planning
```

or

```
Validation Status

FAILED

Errors

2

Warnings

3

Creator Review Required
```

---

# Validation Categories

The validator examines multiple aspects of the universe.

---

## Character Validation

Verify that characters remain consistent.

Checks include:

- personality
- motivation
- appearance
- dialogue style
- abilities
- relationships

Example:

```
Buya becomes aggressive without explanation.

↓

Validation Error
```

---

## Relationship Validation

Verify that character relationships remain valid.

Examples:

- family
- friendship
- rivalry
- mentorship

Example:

```
Character A meets Character B
for the first time.

↓

Previous Episode

They have been friends for years.

↓

Conflict Detected
```

---

## Timeline Validation

Ensure chronological consistency.

Checks include:

- historical events
- episode order
- season progression
- character age
- event sequence

Example:

```
Episode 8 occurs before Episode 5.

↓

Timeline Conflict
```

---

## World Validation

Verify that world rules remain consistent.

Checks include:

- geography
- organizations
- cultures
- technology
- supernatural systems

Example:

```
Magic is used in a world where
magic does not exist.

↓

Canon Conflict
```

---

## Story Validation

Verify alignment with the Story Bible.

Checks include:

- active story arc
- season objective
- unresolved conflicts
- narrative progression

Every episode should contribute to the approved story.

---

## Production Validation

Verify production consistency.

Checks include:

- episode numbering
- asset references
- script versions
- production status

Production artifacts should remain synchronized.

---

# Validation Flow

```
Working Context

↓

Character Validation

↓

World Validation

↓

Timeline Validation

↓

Story Validation

↓

Production Validation

↓

Validation Report
```

Each validation stage is independent.

---

# Validation Results

Every issue receives a severity level.

## Information

General observations.

No action required.

---

## Warning

Potential inconsistency.

Creator review recommended.

Generation may continue.

---

## Error

Canonical contradiction.

Generation should stop.

Creator action required.

---

## Critical

Major canon violation.

Workflow terminates.

Generation prohibited.

---

# Conflict Examples

## Character Conflict

```
Character

Cannot swim

↓

Episode

Wins swimming competition

↓

Conflict
```

---

## Timeline Conflict

```
Episode 10

Occurs before

Episode 7

↓

Conflict
```

---

## World Conflict

```
Location

Destroyed

↓

Later Episode

Location fully operational

↓

Conflict
```

---

## Relationship Conflict

```
Enemies

↓

Next Scene

Best friends

↓

No explanation

↓

Conflict
```

---

# Conflict Resolution

When conflicts are detected, the engine should:

1. identify the conflicting canon
2. explain the conflict
3. suggest possible resolutions
4. request creator approval if necessary

The validator should never silently modify canon.

---

# Canon Validation Report

Example:

```
Validation Report

Status

FAILED

Character

PASS

World

PASS

Story

WARNING

Timeline

FAILED

Relationships

PASS

Production

PASS

Recommendation

Creator Review Required
```

The report becomes part of the Review Package.

---

# Design Principles

Canon Validator follows these principles:

- Canon First
- Single Source of Truth
- Explainable Validation
- Deterministic Results
- Human Authority

Validation should always be transparent and reproducible.

---

# Future Expansion

Future versions may include additional validation modules such as:

- emotional consistency
- dialogue consistency
- visual consistency
- continuity scoring
- narrative pacing validation
- production readiness scoring

New validators can be added without changing the overall workflow.

---

# Relationship with Other Components

```
Context Builder

↓

Canon Validator

↓

Planning
```

The Context Builder prepares knowledge.

The Canon Validator verifies it.

The Planner uses only validated context.

Each component has a single responsibility.

---

# Summary

The Canon Validator is the quality gate of the AI Engine.

By validating characters, world rules, timelines, relationships, stories, and production data before planning begins, it protects the integrity of the Universe Bible and ensures that every generated artifact remains faithful to the established canon.

No planning or generation should proceed without successful canon validation.