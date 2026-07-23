# Versioning

Version: 1.0

---

# Purpose

Versioning defines how every document, planning artifact, production asset, and published release evolves over time.

Its purpose is to ensure that every change is traceable, reproducible, and reversible without losing the history of the Suro & Buya universe.

Versioning is not only for source code.

It applies to the entire production ecosystem.

---

# Objective

Provide a consistent version management strategy across the Creator Workflow, Engine Workflow, and Production Workflow.

Versioning answers one fundamental question:

> **"Which version is the official source of truth?"**

Every artifact should always have one clearly identifiable current version.

---

# Scope

Versioning applies to all project artifacts.

Examples include:

- Universe Bible
- Character Bible
- World Bible
- Story Bible
- Visual Bible
- Production Bible
- Story Plans
- Season Plans
- Episode Plans
- Scripts
- Storyboards
- Visual Assets
- Voice Assets
- Production Packages
- Published Releases

Every artifact should be versioned.

---

# Version Hierarchy

Versioning exists at multiple levels.

```
Universe

↓

Season

↓

Episode

↓

Production Asset

↓

Published Release
```

Each level has its own independent version history.

---

# Version Format

The project follows Semantic Versioning.

```
MAJOR.MINOR.PATCH
```

Example:

```
1.0.0
```

---

# Major Version

Increase the **MAJOR** version when a change introduces significant structural or canonical changes.

Examples:

- Universe redesign
- Character redesign
- Story reboot
- Major architecture changes

Example:

```
1.0.0

↓

2.0.0
```

---

# Minor Version

Increase the **MINOR** version when functionality or content is expanded without breaking existing canon.

Examples:

- new episode
- new season
- additional character
- expanded world information

Example:

```
1.2.0

↓

1.3.0
```

---

# Patch Version

Increase the **PATCH** version when correcting existing artifacts.

Examples:

- typo fixes
- dialogue corrections
- metadata updates
- production fixes
- subtitle corrections

Example:

```
1.3.2

↓

1.3.3
```

---

# Artifact Lifecycle

Every artifact follows the same lifecycle.

```
Draft

↓

Review

↓

Approved

↓

Published

↓

Archived
```

Version numbers should accompany every stage.

---

# Immutable Releases

Published versions are immutable.

Once released:

- content should not be overwritten
- history should remain preserved
- corrections require a new version

Example:

```
Episode 05

v1.0.0

↓

Correction

↓

Episode 05

v1.0.1
```

The previous release remains archived.

---

# Change History

Every version should include a change history.

Example:

```
Version

1.2.0

Changes

- Added Scene 8
- Updated dialogue
- Improved pacing
```

Change history improves transparency.

---

# Traceability

Every version should reference its predecessor.

Example:

```
v1.0.0

↓

v1.1.0

↓

v1.2.0

↓

v2.0.0
```

The entire evolution of an artifact should be traceable.

---

# Dependency Versioning

Dependent artifacts should reference approved versions.

Example:

```
Episode Plan

v1.2

↓

Script

v1.2

↓

Storyboard

v1.2

↓

Visual Assets

v1.2
```

Dependencies should remain synchronized.

---

# Canon Versioning

Universe canon should evolve carefully.

Example:

```
Character Bible

v2.0

↓

Episode Plan

v2.0

↓

Production Assets

v2.0
```

Production should never mix incompatible canon versions.

---

# Production Versioning

Production assets maintain independent versions.

Examples:

```
Storyboard

v1.1

Visual Assets

v1.3

Voice Assets

v1.2

Production Package

v1.4
```

Each asset evolves independently while preserving compatibility.

---

# Release Versioning

Every published episode should have an official release version.

Example:

```
Season 01

Episode 05

Release

v1.0.0
```

Subsequent revisions produce new release versions.

---

# Version Validation

Before approval, the engine verifies:

- version format
- dependency compatibility
- metadata completeness
- change history
- production synchronization

Only validated versions become official.

---

# Archive Policy

Older versions should never be deleted.

Instead:

```
Current Version

↓

Archived Version

↓

Historical Record
```

Historical versions support auditing and future reference.

---

# Design Principles

Versioning follows these principles:

- Single Source of Truth
- Immutable Releases
- Complete Traceability
- Explicit Change History
- Backward Compatibility Whenever Possible

Every version should be understandable without ambiguity.

---

# Relationship with Other Components

```
Creator Workflow

↓

Engine Workflow

↓

Production Workflow

↓

Versioning

↓

Publishing

↓

Archive
```

Versioning supports every stage of the project lifecycle.

It is not a separate workflow, but a foundational capability shared across the entire system.

---

# Future Expansion

Future versions may support:

- automatic version generation
- dependency graph visualization
- change impact analysis
- collaborative revision tracking
- release branching
- rollback support
- production dashboards

These capabilities improve project governance while preserving the same versioning principles.

---

# Summary

Versioning provides the foundation for managing change across the entire Suro & Buya ecosystem.

By assigning structured versions to every document, planning artifact, production asset, and published release, the project maintains consistency, transparency, and complete traceability throughout its lifecycle.

Every artifact has a history.

Every release is immutable.

Every change is documented.

This ensures that the Universe Bible remains the single source of truth while allowing the project to evolve safely over time.