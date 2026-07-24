# Planning Template

Version: 1.0

Template Type:

```text
Engine Template
```

Domain:

```text
AI Planning Runtime
```

Workflow Position:

```text
Creator Intent

↓

Intent Detection

↓

Planning Runtime

↓

Execution Plan

↓

Workflow Execution
```

---

# Planning Identity

## Basic Information

```yaml
planning_id:
request_id:
workflow_type:
status:
created:
updated:
```

Example:

```yaml
planning_id: PLAN-SB-001
request_id: REQ-SB-001
workflow_type: Episode Generation
status: Draft
```

---

# Input Intent

## Creator Request

Input asli dari creator:

```text
[Creator intent]
```

---

## Intent Classification

Kategori intent:

```yaml
intent:

type:

domain:

priority:
```

Contoh:

```yaml
intent:

type: Create Episode

domain: Story Generation

priority: High
```

---

# Goal Definition

## Primary Goal

Tujuan utama:

```text
[Main objective]
```

---

## Secondary Goals

Tujuan tambahan:

```yaml
secondary_goals:

-
-
-
```

---

# Universe Context Requirement

Context yang diperlukan:

```yaml
required_context:

character:

world:

story:

season:

episode:

visual:

production:
```

---

# Bible Retrieval Requirement

Data Universe Bible yang harus diambil:

```yaml
retrieval_request:

sources:

- bible_type:
  target:
  reason:
```

Contoh:

```yaml
retrieval_request:

sources:

- bible_type: Character Bible
  target: Suro
  reason: Character consistency
```

---

# Task Decomposition

## Task List

Pecah pekerjaan menjadi langkah:

```yaml
tasks:

- task_id:
  name:
  description:
  dependency:
  status:
```

Contoh:

```yaml
tasks:

- task_id: TASK-001
  name: Retrieve Context
  description:
  dependency:
  status: Pending
```

---

# Workflow Selection

Workflow yang digunakan:

```yaml
workflow:

name:

version:

steps:
```

Contoh:

```yaml
workflow:

name: Episode Generation Workflow

version: 1.0

steps:

- Context Retrieval
- Story Planning
- Scene Generation
- Validation
```

---

# Execution Strategy

## Execution Mode

```yaml
execution:

mode:

priority:

parallel:

retry_policy:
```

---

## Resource Requirement

```yaml
resources:

memory:

retrieval:

generation:

validation:
```

---

# Generation Plan

Rencana output:

```yaml
generation_plan:

output_type:

format:

structure:

constraints:
```

---

# Validation Requirement

Validasi yang diperlukan:

```yaml
validation_requirements:

canon_check:

schema_check:

continuity_check:

quality_check:
```

---

# Review Requirement

Jika membutuhkan review:

```yaml
review_requirement:

required:

review_type:

criteria:
```

---

# Expected Output

Output planning:

```yaml
expected_output:

type:

schema:

destination:
```

Contoh:

```yaml
expected_output:

type: Episode Object

schema: episode.schema.json

destination: Episode Pipeline
```

---

# Planning State

Lifecycle:

```text
Created

↓

Analyzing

↓

Context Ready

↓

Planned

↓

Executing

↓

Completed
```

---

# Planning Metadata

```yaml
metadata:

id:

version:

engine_version:

created:

updated:

source:

owner:
```

---

# Planning Validation Checklist

## Intent

* [ ] Intent berhasil diklasifikasi
* [ ] Goal jelas
* [ ] Scope jelas

## Context

* [ ] Universe Bible requirement teridentifikasi
* [ ] Context requirement lengkap

## Workflow

* [ ] Workflow sesuai
* [ ] Dependency terdefinisi

## Output

* [ ] Output schema tersedia
* [ ] Validation requirement tersedia

---

# Output

Planning Template menghasilkan:

```text
Planning Object

↓

workflow selection

↓

execution plan

↓

Orchestrator Instruction

↓

Runtime Execution
```

---

# Template Rules

1. Planning harus dibuat sebelum generation.

2. Planning tidak boleh menghasilkan cerita final.

3. Planning hanya menentukan strategi eksekusi.

4. Semua planning harus memiliki context requirement.

5. Workflow yang dipilih harus sesuai domain.

6. Planning version harus tercatat untuk audit.
