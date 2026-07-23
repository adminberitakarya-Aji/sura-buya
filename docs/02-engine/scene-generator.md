# Scene Generator

Version: 1.0

---

# Purpose

The Scene Generator transforms an approved Episode Plan into a sequence of structured scenes.

Rather than writing an entire script at once, the engine generates one scene at a time based on the Episode Plan and the Working Context.

Each scene represents a meaningful unit of storytelling with a clear objective, participants, location, emotional tone, and narrative outcome.

---

# Objective

Generate scenes that faithfully implement the approved Episode Plan while remaining consistent with the Universe Bible.

The Scene Generator answers one fundamental question:

> **"How should this episode unfold scene by scene?"**

Every generated scene should move the story forward.

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

Scene generation begins only after planning has been completed.

---

# Responsibilities

The Scene Generator is responsible for:

- expanding Episode Plans into scenes
- determining scene sequence
- selecting locations
- assigning participating characters
- defining scene objectives
- establishing emotional progression

The Scene Generator does **not** write dialogue.

Dialogue generation is handled by a separate module.

---

# Input

The Scene Generator receives:

- validated Episode Plan
- Working Context
- Character Bible
- World Bible
- Story Bible

Example:

```
Episode Plan

+

Working Context

↓

Scene Generator
```

---

# Output

The Scene Generator produces a structured Scene Plan.

Example:

```
Episode 5

↓

Scene 1

↓

Scene 2

↓

Scene 3

↓

Scene 4

↓

Scene 5
```

Each generated scene becomes the input for Dialogue Generation.

---

# Scene Components

Every scene contains several structured elements.

---

## Scene Number

Each scene has a unique sequence within the episode.

Example:

```
Scene 01

Scene 02

Scene 03
```

---

## Scene Objective

Define why the scene exists.

Examples:

- introduce information
- develop relationships
- create conflict
- reveal clues
- resolve tension

Every scene should have one clear purpose.

---

## Location

Determine where the scene takes place.

Examples:

- village road
- market
- river
- forest
- school
- mosque

Locations should be retrieved from the World Bible whenever possible.

---

## Participating Characters

Identify all characters appearing in the scene.

For each character define:

- purpose
- emotional state
- current objective

Characters should only appear when they contribute to the narrative.

---

## Narrative Progression

Describe what happens during the scene.

Example:

```
Arrival

↓

Conversation

↓

Conflict

↓

Decision

↓

Exit
```

This progression forms the structural backbone of the scene.

---

## Emotional Tone

Every scene should establish a dominant emotional tone.

Examples:

- peaceful
- humorous
- mysterious
- dramatic
- tense
- emotional
- inspirational

The tone should support the overall emotional progression of the episode.

---

## Scene Outcome

Every scene should end with a meaningful result.

Examples:

- new information
- stronger relationship
- unresolved conflict
- important discovery
- emotional realization

Scenes should leave the story in a different state than when they began.

---

# Scene Sequencing

Scenes should follow a logical progression.

Example:

```
Opening

↓

Setup

↓

Development

↓

Conflict

↓

Resolution

↓

Transition
```

Transitions between scenes should feel natural.

---

# Narrative Rules

The Scene Generator follows several storytelling rules.

## Every Scene Has a Purpose

Scenes should never exist only to fill runtime.

If a scene does not advance:

- story
- character
- world
- conflict

it should be removed or revised.

---

## Cause and Effect

Every scene should naturally lead to the next.

```
Scene A

↓

creates

↓

Scene B

↓

creates

↓

Scene C
```

Avoid disconnected events.

---

## Character Driven

Scenes should be driven by character decisions rather than coincidence.

Characters create the story.

The story should not simply happen to them.

---

## Respect Canon

Every generated scene must remain consistent with:

- Character Bible
- World Bible
- Story Bible
- Season Plan
- Episode Plan

Scene generation never overrides established canon.

---

# Scene Validation

Before passing scenes to the Dialogue Generator, the engine verifies:

- correct character participation
- valid locations
- logical progression
- consistent emotional flow
- alignment with Episode Plan
- canon consistency

Only validated scenes continue.

---

# Relationship with Other Components

```
Episode Planner

↓

Scene Generator

↓

Dialogue Generator
```

Episode Planner defines **what** should happen.

Scene Generator determines **how the episode unfolds**.

Dialogue Generator determines **what characters say**.

Each module has a distinct responsibility.

---

# Future Expansion

Future versions of the Scene Generator may support:

- cinematic scene planning
- camera direction
- storyboard generation
- visual composition
- shot planning
- animation sequencing
- scene pacing optimization

These capabilities extend scene generation without changing the overall orchestration workflow.

---

# Summary

The Scene Generator transforms an Episode Plan into a structured sequence of scenes that guide narrative progression throughout the episode.

By separating scene generation from dialogue generation, the engine creates episodes that are easier to validate, easier to revise, and more consistent with the Universe Bible.

Every generated scene has a clear purpose, supports character development, advances the story, and prepares the foundation for natural dialogue generation.