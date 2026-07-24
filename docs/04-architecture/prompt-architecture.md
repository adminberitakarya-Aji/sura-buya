# Prompt Architecture

Version: 1.0

---

# Purpose

The Prompt Architecture defines how the Suro & Buya AI Engine communicates with Large Language Models (LLMs).

Rather than relying on a single monolithic prompt, the engine composes prompts dynamically from structured business objects, canonical knowledge, and task-specific instructions.

This approach makes prompt generation deterministic, reusable, and maintainable.

---

# Objective

Provide a standardized architecture for prompt construction.

The Prompt Architecture answers one fundamental question:

> **"How does the AI Engine build prompts for the LLM?"**

---

# Philosophy

Prompts are not products.

Prompts are execution artifacts.

The creator never writes prompts.

The engine builds prompts automatically.

This supports the project's philosophy:

> **Complex Engine. Simple Experience.**

---

# Design Principles

The Prompt Architecture follows these principles:

- Canon First
- Context First
- Prompt Composition
- Structured Inputs
- Deterministic Output
- Reusable Templates

Prompt engineering should exist inside the engine, not in the user experience.

---

# Prompt Lifecycle

Every prompt follows the same lifecycle.

```
Creator Request

↓

Intent Detection

↓

Knowledge Retrieval

↓

Working Context

↓

Prompt Builder

↓

LLM

↓

Structured Output
```

The creator never interacts directly with prompts.

---

# Prompt Layers

A prompt is composed of multiple layers.

```
System Prompt

↓

Role Prompt

↓

Task Prompt

↓

Working Context

↓

Constraints

↓

Output Format
```

Each layer has a distinct responsibility.

---

# Layer 1 — System Prompt

Defines the global behavior of the AI Engine.

Example responsibilities:

- explain engine identity
- enforce project philosophy
- require canon consistency
- require structured outputs

Example:

```
You are the Suro & Buya AI Engine.

Always prioritize the Universe Bible.

Never invent canon.

Return structured output only.
```

The System Prompt is shared across the entire engine.

---

# Layer 2 — Role Prompt

Defines the current role.

Examples:

- Story Planner
- Episode Planner
- Scene Generator
- Dialogue Generator
- Reviewer

Example:

```
You are acting as the Episode Planner.
```

Each engine component has its own role prompt.

---

# Layer 3 — Task Prompt

Describes the specific task.

Example:

```
Create Episode 5 based on the approved Season Plan.
```

The Task Prompt is generated dynamically.

---

# Layer 4 — Working Context

Provides canonical knowledge.

Example:

```
Character Profiles

Story Arc

Timeline

Locations

Visual Rules
```

Only relevant information is included.

---

# Layer 5 — Constraints

Defines execution rules.

Examples:

- do not contradict canon
- preserve character personality
- maintain timeline consistency
- use approved locations
- follow episode objective

Constraints reduce hallucinations.

---

# Layer 6 — Output Format

Specifies the expected structure.

Example:

```
Episode Title

Objective

Scenes

Dialogue

Ending

Metadata
```

Structured outputs simplify downstream processing.

---

# Prompt Composition

The Prompt Builder assembles all layers.

```
System Prompt

+

Role Prompt

+

Task Prompt

+

Working Context

+

Constraints

+

Output Schema

↓

Final Prompt
```

Prompt composition is deterministic.

---

# Prompt Templates

Each engine component owns its own template.

Examples:

```
Story Planner Template

Season Planner Template

Episode Planner Template

Scene Generator Template

Dialogue Generator Template
```

Templates promote reuse and consistency.

---

# Context Injection

The engine injects only the required knowledge.

Example:

```
Character Bible

+

Episode Plan

↓

Dialogue Generator
```

Avoid including unnecessary information.

Smaller prompts improve efficiency.

---

# Prompt Isolation

Each component receives only the context it needs.

Example:

```
Scene Generator

does not receive

Production Bible
```

This minimizes cognitive load for the model.

---

# Structured Outputs

Every prompt requests structured output.

Preferred formats include:

- Markdown
- JSON
- Tables
- Lists
- Defined schemas

Avoid free-form responses whenever possible.

---

# Prompt Chaining

Complex tasks are decomposed into multiple prompts.

Example:

```
Story Prompt

↓

Season Prompt

↓

Episode Prompt

↓

Scene Prompt

↓

Dialogue Prompt
```

Each stage builds upon approved outputs from the previous stage.

---

# Prompt Validation

Before execution, prompts are validated.

Checks include:

- required context present
- valid task definition
- complete constraints
- expected output schema

Invalid prompts should not be executed.

---

# Prompt Versioning

Prompt templates are version controlled.

Example:

```
Dialogue Generator

v1.0

↓

v1.1

↓

v2.0
```

Prompt changes should be documented and tested.

---

# Prompt Independence

Prompts should not depend on previous conversations.

Every execution should include all required context.

This ensures:

- reproducibility
- consistency
- stateless execution

---

# AI Engine Usage

The creator sees:

```
Create Episode
```

The engine performs:

```
Intent Detection

↓

Context Retrieval

↓

Prompt Composition

↓

LLM Execution

↓

Validation

↓

Review Package
```

Prompt construction remains invisible to the creator.

---

# Relationship with Other Documents

This document complements:

- **Knowledge Model** — defines the source of contextual information.
- **Execution Model** — defines when prompts are executed.
- **Engine Components** — defines which component owns each prompt.
- **Data Flow** — defines how prompt inputs and outputs move through the engine.

Together they describe how the AI Engine communicates with language models.

---

# Future Expansion

Future versions may support:

- multimodal prompt templates
- image generation prompts
- voice synthesis prompts
- adaptive prompt optimization
- automatic prompt evaluation
- prompt analytics
- prompt caching
- model-specific prompt strategies

These enhancements improve performance while preserving the same architectural principles.

---

# Summary

The Prompt Architecture defines how the Suro & Buya AI Engine constructs prompts for language models.

By assembling prompts from reusable layers—System Prompt, Role Prompt, Task Prompt, Working Context, Constraints, and Output Format—the engine ensures that every AI interaction is deterministic, context-aware, and aligned with the Universe Bible.

Creators never write prompts.

They express ideas.

The engine transforms those ideas into structured prompts that guide AI toward consistent, canon-compliant, and production-ready outputs.