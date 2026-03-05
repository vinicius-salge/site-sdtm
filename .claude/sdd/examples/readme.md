# AgentSpec Examples

> Real-world example artifacts from the GCP Pipeline Deployment feature

---

## Contents

| File | Phase | Description |
| ---- | ----- | ----------- |
| `BRAINSTORM_GCP_PIPELINE_DEPLOYMENT.md` | 0 | Exploratory session for invoice pipeline deployment |
| `DEFINE_GCP_PIPELINE_DEPLOYMENT.md` | 1 | Requirements for 4 Cloud Run functions + infrastructure |
| `DESIGN_GCP_PIPELINE_DEPLOYMENT.md` | 2 | Technical architecture with Agent Matching |
| `BUILD_REPORT_GCP_PIPELINE_DEPLOYMENT.md` | 3 | Implementation report with Agent Attribution |

---

## Using These Examples

These examples demonstrate the full AgentSpec workflow for a real GCP serverless pipeline:

```text
/brainstorm "Deploy invoice extraction pipeline" → BRAINSTORM_*.md
         ↓
/define BRAINSTORM_*.md                         → DEFINE_*.md
         ↓
/design DEFINE_*.md                             → DESIGN_*.md
         ↓
/build DESIGN_*.md                              → Code + BUILD_REPORT_*.md
```

---

## Key Patterns Demonstrated

### Phase 0: Brainstorm

- Discovery questions (5 total)
- Sample data inventory
- 3 approaches with trade-offs
- YAGNI applied (5 features removed)
- Incremental validations (7)

### Phase 1: Define

- Problem statement
- Target users with pain points
- Success criteria (8 items)
- Technical Context (Location, KB Domains, IaC Impact)
- Constraints and assumptions

### Phase 2: Design

- ASCII architecture diagrams
- Key decisions with rationale
- File manifest with **Agent column**
- Agent Assignment Rationale section
- Code patterns (copy-paste ready)

### Phase 3: Build Report

- Task execution with **Agent Attribution**
- Agent Contributions summary
- Files created with agent ownership
- Verification results

---

## Note

These examples use project-specific details (GCP, Cloud Run, Gemini) but the structure and patterns are framework-agnostic. Use them as templates for your own features.
