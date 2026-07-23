# Episode Planner

Version: 1.0

---

# Purpose

The Episode Planner transforms an approved Season Plan into structured, production-ready episodes.

Rather than generating scripts immediately, the Episode Planner first determines the narrative structure of each episode, ensuring that every episode contributes to both the season and the overall story.

An episode is the smallest narrative unit in the Creator Workflow, but it must always remain connected to the larger serialized narrative.

---

# Objective

Create a structured Episode Plan for every episode in a season.

The Episode Planner answers one fundamental question:

> **"What should happen in each episode?"**

Each episode should have a clear objective, meaningful progression, and a defined contribution to the season.

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

Story Planner

↓

Season Planner

↓

Episode Planner

↓

Scene Generator

↓

Dialogue Generator

↓

Consistency Check
```

Episode planning is the final planning stage before content generation begins.

---

# Responsibilities

The Episode Planner is responsible for:

- dividing a season into episodes
- defining episode objectives
- distributing major events
- planning narrative pacing
- assigning character participation
- preparing Episode Plans

The Episode Planner does **not** generate scenes or dialogue.

Its responsibility is planning.

---

# Input

The Episode Planner receives:

- validated Season Plan
- Character Bible
- World Bible
- Story Bible
- creator requirements

Example:

```
Season Plan

+

Character Bible

+

Story Bible

↓

Episode Planner
```

---

# Output

The Episode Planner produces a collection of Episode Plans.

Example:

```
Season 1

↓

Episode 1

↓

Episode 2

↓

Episode 3

↓

...

↓

Episode 10
```

Each Episode Plan becomes the blueprint for Scene Generation.

---

# Episode Components

Every Episode Plan contains several planning elements.

---

## Episode Objective

Define the primary purpose of the episode.

Examples:

- introduce a character
- reveal new information
- escalate conflict
- strengthen relationships
- resolve a subplot

Every episode should have one clear objective.

---

## Episode Summary

Provide a concise overview.

The summary explains:

- what happens
- why it matters
- how it advances the season

---

## Story Beats

Define the major narrative progression.

Example:

```
Opening

↓

Inciting Event

↓

Development

↓

Turning Point

↓

Climax

↓

Ending
```

Story beats provide the structural framework of the episode.

---

## Major Events

Identify important narrative milestones.

Examples:

- discovering evidence
- meeting a new ally
- confronting an enemy
- solving a conflict
- revealing hidden information

Each event should contribute to the season objective.

---

## Character Participation

Identify which characters appear.

For each character define:

- role
- objective
- emotional state
- relationship changes

Characters should only appear when they contribute to the story.

---

## Location Plan

Define where major scenes occur.

Examples:

- village
- forest
- marketplace
- river
- temple
- school

Locations should support the narrative naturally.

---

## Emotional Progression

Plan the emotional rhythm of the episode.

Example:

```
Curiosity

↓

Joy

↓

Suspense

↓

Conflict

↓

Hope
```

Emotional progression should feel natural and intentional.

---

## Ending

Define how the episode concludes.

Possible endings include:

- resolution
- cliffhanger
- new discovery
- unanswered question
- emotional closure

The ending should encourage continued viewing while respecting the pacing of the season.

---

# Planning Process

The Episode Planner follows a structured sequence.

```
Season Goal

↓

Episode Objective

↓

Story Beats

↓

Major Events

↓

Character Participation

↓

Location Plan

↓

Emotional Progression

↓

Ending

↓

Episode Plan
```

Each planning step builds upon the previous one.

---

# Episode Distribution

The planner distributes the season across individual episodes.

Example:

```
Season Goal

↓

Episode 1

Introduction

↓

Episode 2

Discovery

↓

Episode 3

Escalation

↓

Episode 4

Conflict

↓

Episode 5

Resolution
```

The distribution should maintain consistent pacing throughout the season.

---

# Planning Principles

The Episode Planner follows these principles.

## Season First

Every episode exists to support the season.

No episode should feel disconnected.

---

## Story Progression

Every episode should move the narrative forward.

Avoid episodes that do not contribute to the larger story.

---

## Character First

Every episode should create opportunities for character development.

Character actions should drive events rather than merely reacting to them.

---

## Balanced Pacing

Major events should be distributed evenly.

Avoid concentrating important developments into a single episode.

---

## Emotional Continuity

Each episode should provide a satisfying emotional journey while contributing to the emotional arc of the season.

---

# Validation

Before approval, the planner verifies:

- alignment with the Season Plan
- alignment with the Story Bible
- character consistency
- logical pacing
- meaningful progression
- canon consistency

Only validated Episode Plans continue to Scene Generation.

---

# Relationship with Other Components

```
Season Planner

↓

Episode Planner

↓

Scene Generator

↓

Dialogue Generator
```

Season Planner defines the season.

Episode Planner structures individual episodes.

Scene Generator expands episodes into scenes.

Dialogue Generator gives characters their voices.

Each component has a clearly defined responsibility.

---

# Future Expansion

Future versions may support:

- adaptive episode lengths
- multi-threaded episode structures
- branching narratives
- interactive storytelling
- audience-aware pacing
- automatic filler detection
- narrative quality scoring

These capabilities extend planning while preserving the same orchestration model.

---

# Summary

The Episode Planner transforms a Season Plan into structured Episode Plans that define objectives, story beats, character participation, locations, emotional progression, and endings.

By separating episode planning from content generation, the engine produces episodes that are coherent, canon-consistent, and tightly connected to both the season and the overall serialized story.