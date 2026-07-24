# Execution Template

Version: 1.0

Template Type:

```text
Engine Template
```

Domain:

```text
AI Execution Runtime
```

Workflow Position:

```text
Planning Runtime

↓

Orchestrator

↓

Execution Runtime

↓

Workflow Execution

↓

Result Artifact
```

---

# Execution Identity

## Basic Information

```yaml
execution_id:
request_id:
planning_id:
workflow_id:
execution_type:
status:
created:
updated:
```

Example:

```yaml
execution_id: EXEC-SB-001
request_id: REQ-SB-001
planning_id: PLAN-SB-001
workflow_id: WORKFLOW-EPISODE-GENERATION
execution_type: Content Generation
status: Pending
```

---

# Execution Purpose

## Objective

Tujuan eksekusi:

```text
[What this execution must accomplish]
```

Contoh:

* menghasilkan episode draft,
* menjalankan validation pipeline,
* membuat production package.

---

# Execution Input

Input yang digunakan:

```yaml
input:

intent:

context_id:

source_objects:

parameters:
```

---

# Workflow Definition

Workflow yang dijalankan:

```yaml
workflow:

workflow_id:

name:

version:

description:
```

---

## Workflow Steps

Daftar langkah eksekusi:

```yaml
steps:

- step_id:
  name:
  type:
  order:
  dependency:
  status:
```

Contoh:

```yaml
steps:

- step_id: STEP-001
  name: Retrieve Bible Context
  type: Retrieval
  order: 1
  dependency:
  status: Pending
```

---

# Task Execution

## Task Definition

Detail task:

```yaml
tasks:

- task_id:
  step_id:
  name:
  executor:
  input:
  output:
  status:
```

---

## Task Dependency

Hubungan antar task:

```yaml
dependencies:

- task:
  depends_on:
  condition:
```

Contoh:

```yaml
dependencies:

- task: Generate Scene
  depends_on: Generate Story Plan
  condition: Success
```

---

# Execution Strategy

## Execution Mode

```yaml
execution_mode:

mode:

priority:

parallel_execution:

retry_enabled:
```

Mode:

```text
Sequential

Parallel

Hybrid
```

---

# Runtime Configuration

Konfigurasi runtime:

```yaml
runtime:

model:

temperature:

token_limit:

timeout:

resource_limit:
```

---

# Agent Assignment

Jika menggunakan specialized agent:

```yaml
agents:

- agent_id:
  role:
  capability:
  responsibility:
```

Contoh:

```yaml
agents:

- agent_id: STORY-PLANNER
  role: Story Planning Agent
  capability: Narrative Planning
```

---

# State Management

## Execution State

Status utama:

```yaml
state:

current:

previous:

next:

progress:
```

Lifecycle:

```text
Created

↓

Queued

↓

Running

↓

Paused

↓

Completed

↓

Failed

↓

Archived
```

---

# Step State

Status setiap step:

```yaml
step_states:

- step_id:
  status:
  started:
  completed:
  result:
```

---

# Error Handling

## Error Object

```yaml
errors:

- error_id:
  step_id:
  type:
  message:
  severity:
  resolution:
```

---

## Recovery Strategy

```yaml
recovery:

retry_count:

fallback:

rollback:

manual_intervention:
```

---

# Execution Monitoring

## Metrics

```yaml
metrics:

duration:

token_usage:

resource_usage:

success_rate:
```

---

## Logs

```yaml
logs:

- timestamp:
  level:
  message:
  source:
```

Level:

```text
INFO

WARNING

ERROR

CRITICAL
```

---

# Output Result

## Execution Result

```yaml
result:

status:

output_type:

artifact:

destination:
```

Contoh:

```yaml
result:

status: Completed

output_type: Episode Object

artifact: EP-SB-001

destination: Review Runtime
```

---

# Artifact Generated

Hasil yang dibuat:

```yaml
artifacts:

- artifact_id:
  type:
  version:
  location:
```

Contoh:

```yaml
artifacts:

- artifact_id: STORY-PLAN-001
  type: Story Plan
  version: 1.0
  location:
```

---

# Validation Hook

Validasi setelah execution:

```yaml
validation:

required:

validator:

criteria:
```

---

# Review Hook

Jika membutuhkan review:

```yaml
review:

required:

review_type:

destination:
```

---

# Execution History

Riwayat eksekusi:

```yaml
history:

- version:
  action:
  timestamp:
  actor:
```

---

# Audit Information

Informasi audit:

```yaml
audit:

created_by:

executed_by:

environment:

engine_version:
```

---

# Execution Metadata

```yaml
metadata:

id:

version:

created:

updated:

source:

owner:
```

---

# Output

Execution Template menghasilkan:

```text
Execution Object

↓

execution.schema.json

↓

Runtime State

↓

Artifact Result

↓

Review / Production Pipeline
```

---

# Template Rules

1. Execution hanya menjalankan plan yang sudah dibuat.

2. Execution tidak boleh membuat keputusan kreatif.

3. Semua task harus memiliki status.

4. Semua dependency harus tercatat.

5. Error harus dapat dilacak dan direproduksi.

6. Execution harus idempotent.

7. Semua hasil execution harus menghasilkan artifact reference.

8. Execution history wajib disimpan untuk audit.
