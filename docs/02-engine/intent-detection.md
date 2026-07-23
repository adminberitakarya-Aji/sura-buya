# Intent Detection

Version: 1.0

---

# Purpose

Intent Detection is the entry point of the AI Engine.

Its responsibility is to understand what the creator wants to accomplish before any knowledge is retrieved or any content is generated.

Every workflow begins with intent detection.

Without a clear intent, the engine cannot determine which knowledge to retrieve, which planner to invoke, or which generation pipeline to execute.

---

# Objective

Identify the creator's request and route it to the appropriate engine workflow.

Intent Detection answers one fundamental question:

> **"What does the creator want to do?"**

The answer determines the remainder of the orchestration process.

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

Intent Detection is always the first processing stage.

---

# Responsibilities

Intent Detection is responsible for:

- understanding the creator's objective
- classifying the request
- identifying the target object
- determining the required workflow
- routing the request to the next engine component

It does **not** generate content.

It only decides where the request should go.

---

# Input

The input consists of:

- creator request
- current workspace
- current production stage
- available project context

Example:

```
Create a new episode where Suro meets an old fisherman.
```

or

```
Update Buya's personality.
```

or

```
Generate Season 2.
```

---

# Output

The output is a structured intent.

Example:

```
Intent

Type:
Create Episode

Target:
Episode

Action:
Create

Priority:
Normal

Status:
Ready
```

This structured intent becomes the input for Bible Retrieval.

---

# Intent Categories

The engine recognizes several categories of intent.

## Create

Examples:

- Create Character
- Create World
- Create Story
- Create Season
- Create Episode

---

## Update

Examples:

- Update Character
- Update Story
- Update World
- Update Canon

---

## Review

Examples:

- Review Episode
- Review Character
- Review Season

---

## Generate

Examples:

- Generate Dialogue
- Generate Script
- Generate Scene
- Generate Storyboard

---

## Search

Examples:

- Find Character
- Find Location
- Find Episode

---

## Production

Examples:

- Export Episode
- Prepare Production Package
- Publish

---

# Intent Classification

Every request is classified into several attributes.

```
Action

↓

Target

↓

Scope

↓

Priority
```

Example:

```
Action

Create

Target

Episode

Scope

Season 1

Priority

Normal
```

This classification allows downstream modules to operate consistently.

---

# Routing

Once the intent has been identified, the engine selects the appropriate workflow.

Example:

```
Create Character

↓

Character Workflow
```

```
Create Episode

↓

Episode Workflow
```

```
Review Episode

↓

Review Workflow
```

Every workflow is independent and optimized for its specific purpose.

---

# Ambiguous Requests

Sometimes a request may contain insufficient information.

Example:

```
Continue the story.
```

The engine cannot determine:

- which story
- which season
- which episode

In these cases, the engine should:

1. use available project context when possible
2. infer the most likely target
3. request clarification if ambiguity remains

The engine should avoid making assumptions that could alter canon.

---

# Multi-Intent Requests

A creator may request multiple actions simultaneously.

Example:

```
Create a new character and introduce them in Episode 5.
```

The engine separates this into independent intents.

```
Intent 1

Create Character

↓

Character Workflow
```

```
Intent 2

Update Episode

↓

Episode Workflow
```

The orchestration engine determines the correct execution order based on dependencies.

---

# Design Principles

Intent Detection follows these principles:

- Understand before acting
- One intent, one workflow
- Avoid unnecessary assumptions
- Preserve creator intent
- Support modular orchestration

---

# Error Handling

If no valid intent can be determined, the engine should return an informative response rather than continuing with generation.

Possible responses include:

- clarification required
- unsupported request
- missing context
- invalid workflow
- unknown production stage

Generation must not continue until a valid intent exists.

---

# Future Expansion

The Intent Detection module is designed to support future capabilities such as:

- conversational intent tracking
- workflow continuation
- task prioritization
- multi-agent routing
- production scheduling
- plugin-based intent handlers

These enhancements can be added without changing the overall orchestration workflow.

---

# Summary

Intent Detection is the decision-making gateway of the AI Engine.

It transforms a creator's natural-language request into a structured intent that can be understood by the rest of the orchestration pipeline.

By separating understanding from generation, the engine ensures that every request follows the correct workflow while preserving consistency, scalability, and creator intent.