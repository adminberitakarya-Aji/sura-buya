# Agent Module Architecture

Version: 1.0

---

# Introduction

Agent Module Architecture mendefinisikan struktur internal modul AI yang bekerja di dalam **Suro & Buya AI Engine**.

Dokumen ini menjelaskan bagaimana kemampuan AI dipecah menjadi modul yang memiliki:

* tanggung jawab spesifik,
* input dan output terdefinisi,
* aturan penggunaan,
* hubungan antar modul.

Agent dalam sistem ini bukan chatbot independen.

Agent adalah komponen fungsional yang bekerja sebagai bagian dari pipeline engine.

Konsep utama:

```text
Specialized Intelligence

↓

Coordinated Execution

↓

Consistent Creative Output
```

---

# Agent Philosophy

## Agent as Capability Module

Setiap agent memiliki kemampuan tertentu.

Contoh:

```text
Story Planning Agent

bertugas:

membuat struktur cerita
```

bukan:

```text
Story Planning Agent

+

mengubah canon
+

melakukan produksi
```

---

# Agent is Not Autonomous Creator

Agent tidak memiliki hak untuk:

* membuat canon baru,
* mengubah Universe Bible,
* melewati validation,
* menentukan keputusan final produksi.

Authority tetap berada pada:

```text
Universe Bible

↓

Workflow Rules

↓

Human Approval
```

---

# Agent Architecture Position

Agent Module berada di dalam AI Runtime.

```text
Backend

↓

AI Runtime

↓

Agent Modules

↓

Model Layer
```

---

# Agent Module Overview

Struktur utama:

```text
AI Agent System

├── Context Agent
│
├── Planning Agent
│
├── Story Agent
│
├── Scene Agent
│
├── Dialogue Agent
│
├── Validation Agent
│
├── Review Agent
│
└── Production Agent
```

---

# Agent Execution Model

Setiap agent mengikuti pola:

```text
Input Context

↓

Agent Processing

↓

Structured Output

↓

Validation

↓

Next Module
```

---

# Context Agent

## Responsibility

Menyiapkan informasi yang diperlukan agent lain.

---

## Input

```text
Creator Intent

Universe Reference

Story State

Production Requirement
```

---

## Output

```text
Context Package
```

---

## Does Not Own

```text
Story Creation

Canon Modification
```

---

# Planning Agent

## Responsibility

Mengubah ide menjadi rencana cerita.

---

## Input

```text
Context Package
```

---

## Output

```text
Planning Object
```

---

## Tasks

* menentukan story direction,
* membuat narrative structure,
* membuat episode plan.

---

# Story Agent

## Responsibility

Mengembangkan cerita berdasarkan planning.

---

## Input

```text
Story Plan
```

---

## Output

```text
Story Object
```

---

## Tasks

* premise,
* conflict,
* resolution,
* narrative progression.

---

# Scene Agent

## Responsibility

Memecah episode menjadi scene.

---

## Input

```text
Episode Object
```

---

## Output

```text
Scene Objects
```

---

## Tasks

* scene objective,
* location,
* character involvement,
* emotional direction.

---

# Dialogue Agent

## Responsibility

Menghasilkan dialog karakter.

---

## Input

```text
Scene Context

+

Character Profile
```

---

## Output

```text
Dialogue Object
```

---

## Rules

Dialogue harus mengikuti:

* personality,
* speaking style,
* age,
* relationship.

---

# Validation Agent

## Responsibility

Melakukan pemeriksaan output AI.

---

## Input

```text
Generated Object
```

---

## Output

```text
Validation Result
```

---

## Validation Type

```text
Canon Check

Schema Check

Continuity Check

Quality Check
```

---

# Review Agent

## Responsibility

Membuat evaluasi terhadap hasil.

---

## Input

```text
Validated Output
```

---

## Output

```text
Review Package
```

---

## Tasks

* menemukan masalah,
* memberikan rekomendasi,
* membuat approval summary.

---

# Production Agent

## Responsibility

Mengubah cerita menjadi kebutuhan produksi.

---

## Input

```text
Approved Story
```

---

## Output

```text
Production Package
```

---

## Tasks

* asset requirement,
* storyboard requirement,
* voice requirement.

---

# Agent Communication

Agent tidak berkomunikasi secara bebas.

Komunikasi menggunakan:

```text
Agent Contract
```

Contoh:

```text
Planning Agent

↓

Planning Object

↓

Story Agent
```

---

# Agent Contract Structure

Setiap agent memiliki:

```text
Agent ID

Purpose

Input Schema

Output Schema

Allowed Action

Restrictions
```

---

# Agent Dependency Graph

```text
                 Context Agent

                       ↓

                Planning Agent

                       ↓

                  Story Agent

                       ↓

                  Scene Agent

                       ↓

                Dialogue Agent

                       ↓

              Validation Agent

                       ↓

                Review Agent

                       ↓

             Production Agent
```

---

# Agent Boundary Rules

## Rule 1

Agent hanya mengerjakan domainnya.

---

## Rule 2

Agent tidak menyimpan knowledge utama.

Knowledge berada di:

```text
Knowledge System
```

---

## Rule 3

Agent tidak melewati validation.

---

## Rule 4

Agent output harus mengikuti schema.

---

## Rule 5

Agent execution harus tercatat.

---

# Agent State Management

Setiap agent execution memiliki state.

Contoh:

```text
Created

↓

Running

↓

Completed

↓

Validated
```

---

# Agent Memory Usage

Agent dapat menggunakan memory:

```text
Short Term Memory

↓

Execution Context

↓

Story Memory
```

Namun:

```text
Agent Memory ≠ Canon Memory
```

Canon tetap berasal dari:

```text
Universe Bible
```

---

# Agent Error Handling

## Invalid Input

```text
Input Validation

↓

Reject Execution
```

---

## Invalid Output

```text
Output Validation

↓

Retry

↓

Regenerate
```

---

## Canon Conflict

```text
Conflict Found

↓

Return To Context Layer
```

---

# Agent Scaling Strategy

## Phase 1

Single Agent Pipeline.

```text
Sequential Execution
```

---

## Phase 2

Specialized Agents.

```text
Parallel Scene Generation
```

---

## Phase 3

Advanced Agent Coordination.

```text
Dynamic Agent Routing
```

---

# Relationship With AI Runtime

```text
AI Runtime

↓

Agent Controller

↓

Agent Modules

↓

Model Provider
```

---

# Relationship With Engine Specification

Referensi:

```text
07-engine-spec/

agent architecture

generation runtime

validation runtime
```

---

# Relationship With Production

Agent menghasilkan:

```text
Creative Output

↓

Validated Output

↓

Production Package
```

---

# Future Extension

Pengembangan masa depan:

* specialized visual agent,
* audio agent,
* continuity agent,
* autonomous production agent,
* multi-agent collaboration.

---

# Conclusion

Agent Module Architecture memastikan AI Engine memiliki kemampuan yang terstruktur.

Model akhir:

```text
Multiple Specialized Agents

↓

Controlled Orchestration

↓

Validation

↓

Consistent Suro & Buya Content
```

Agent bukan pengganti creator.

Agent adalah komponen kecerdasan yang membantu creator menghasilkan serial secara konsisten sesuai Universe Bible.
