# Terminology

Version: 1.0

---

# Purpose

This document establishes the official terminology standard used throughout the Suro & Buya project.

While the **Glossary** defines *what a term means*, this document defines *how a term should be written and used consistently* across documentation, prompts, production assets, and source code.

Terminology standardization improves communication between creators, engineers, AI systems, and future contributors.

---

# Objective

Ensure that every concept has one official name and one preferred spelling.

Terminology answers one fundamental question:

> **"What is the correct term to use?"**

Consistency is more important than personal preference.

---

# Terminology Principles

The project follows five terminology principles.

## One Concept, One Term

Each concept should have only one official name.

Avoid multiple names for the same concept.

Example:

✔ Character Bible

✘ Character Document

✘ Character Profile Repository

---

## Consistency

The same terminology should be used across:

- documentation
- prompts
- source code
- production assets
- diagrams
- presentations

Changing terminology creates confusion.

---

## English as the Canonical Language

All technical documentation uses English.

Examples:

✔ Creator Workflow

✔ Engine Workflow

✔ Production Workflow

Avoid mixing languages within technical documents.

---

## Business Before Technology

Prefer business terminology over implementation terminology.

Example:

✔ Story Planner

instead of

✘ LLM Story Module

The documentation should describe capabilities, not implementation details.

---

## Stable Naming

Official terminology should change only when absolutely necessary.

Renaming affects:

- documentation
- diagrams
- prompts
- source code
- training materials

Terminology should remain stable over time.

---

# Official Project Terms

## Universe Bible

The highest-level repository containing all canonical knowledge.

Never abbreviate as:

✘ UB

unless used internally in source code.

---

## Character Bible

Official repository describing every character.

Always write:

✔ Character Bible

Never:

✘ Character Database

✘ Character Document

---

## World Bible

Official repository describing the universe.

Always write:

✔ World Bible

Never:

✘ World Document

✘ Environment Bible

---

## Story Bible

Official repository describing narrative structure.

Always write:

✔ Story Bible

Never:

✘ Story Repository

✘ Story Database

---

## Visual Bible

Official repository defining visual identity.

Always write:

✔ Visual Bible

---

## Production Bible

Official repository defining production standards.

Always write:

✔ Production Bible

---

# Workflow Terms

Always use the official workflow names.

✔ Creator Workflow

✔ Engine Workflow

✔ Production Workflow

Avoid variations such as:

✘ AI Workflow

✘ Content Workflow

✘ Creator Pipeline

unless explicitly referring to another system.

---

# Engine Components

Official engine component names.

✔ Intent Detection

✔ Bible Retrieval

✔ Context Builder

✔ Canon Validator

✔ Story Planner

✔ Season Planner

✔ Episode Planner

✔ Scene Generator

✔ Dialogue Generator

✔ Consistency Check

✔ Review Package

These names should remain unchanged throughout the project.

---

# Production Components

Official production component names.

✔ Script Production

✔ Storyboard Production

✔ Visual Production

✔ Voice Production

✔ Quality Assurance

✔ Publishing

✔ Versioning

Do not introduce alternative names.

---

# Canonical Concepts

Always use these official concepts.

✔ Canon

✔ Working Context

✔ Production Package

✔ Review Package

✔ Story Arc

✔ Episode Plan

✔ Season Plan

✔ Character Profile

✔ Production Asset

---

# Capitalization Rules

Official document names use Title Case.

Examples:

✔ Universe Bible

✔ Character Bible

✔ Story Planner

✔ Production Workflow

General concepts use sentence case.

Examples:

✔ character

✔ episode

✔ dialogue

✔ production asset

---

# Acronyms

Avoid unnecessary acronyms.

Preferred:

✔ Quality Assurance (QA)

After first use:

✔ QA

Avoid inventing acronyms for internal concepts unless officially documented.

---

# File Naming

Documentation files use lowercase kebab-case.

Examples:

```
creator-workflow.md

story-planner.md

visual-production.md

character-bible.md
```

Avoid:

```
CharacterBible.md

StoryPlanner.md

story_planner.md
```

---

# Directory Naming

Directories also use lowercase kebab-case.

Examples:

```
00-foundation

01-creator

02-engine

03-production

04-reference
```

---

# Naming Future Components

New components should follow existing naming conventions.

Examples:

Planner

```
Story Planner

Season Planner

Episode Planner
```

Generator

```
Scene Generator

Dialogue Generator
```

Workflow

```
Creator Workflow

Production Workflow
```

Bible

```
Music Bible

Animation Bible
```

Consistency should be maintained.

---

# Reserved Terms

The following terms have specific meanings and should not be reused for unrelated concepts.

- Canon
- Universe Bible
- Working Context
- Creator
- Review Package
- Production Package
- Story Arc
- Character Bible
- Production Bible

These terms represent core architectural concepts.

---

# Terminology Review

When introducing new terminology, verify:

- Is the concept already named?
- Does it follow existing naming conventions?
- Does it conflict with an existing term?
- Is it understandable without implementation knowledge?
- Can it remain stable over future versions?

Only approved terminology should become part of the project.

---

# Relationship with the Glossary

```
Glossary

↓

Meaning

↓

Terminology

↓

Correct Usage

↓

Documentation
```

The Glossary explains **what** a term means.

Terminology defines **how** the term should be written and used.

Together they establish a consistent documentation language.

---

# Future Expansion

Future versions may include:

- API naming conventions
- schema naming standards
- event naming standards
- prompt naming standards
- identifier conventions
- multilingual terminology support
- code style integration

These additions will extend the terminology standard while preserving consistency.

---

# Summary

The Terminology document defines the official language of the Suro & Buya project.

By standardizing names, capitalization, file naming, workflow terminology, engine components, and production concepts, it ensures that every contributor communicates using the same vocabulary.

A shared terminology reduces ambiguity, improves collaboration, and strengthens the long-term maintainability of the entire Suro & Buya ecosystem.