# AgentSpec

> **The AI-Native Specification Framework for Claude Code**
>
> *"From Specification to Specialized Execution"*

---

## Vision

AgentSpec was created for the **agentic-first era** of software development. As AI models evolve to handle increasingly complex tasks autonomously, the bottleneck shifts from "can the AI write code?" to "does the AI understand what to build and who should build it?"

Traditional specification frameworks answer **WHAT** to build. AgentSpec answers **WHAT**, **HOW**, and **WHO**.

```text
Traditional Spec:                     AgentSpec:
─────────────────                     ─────────

"Build a user API"                    "Build a user API"
       │                                     │
       ▼                                     ▼
  [AI generates code]                 [Define] → Location, KB Domains, IaC
                                             │
                                             ▼
                                      [Design] → Agent Matching
                                             │
                                      ┌──────┼──────┐
                                      ▼      ▼      ▼
                                 @function  @test   @infra
                                 -developer -gen    -deployer
                                      │      │      │
                                      └──────┴──────┘
                                             │
                                             ▼
                                      [Build Report]
                                      + Agent Attribution
```

---

## Two Mental Models

AgentSpec is part of a larger ecosystem designed to match task complexity with appropriate process rigor:

### 1. Dev Loop (Level 2 Agentic Development)

**Location:** `.claude/dev/`

**Philosophy:** "Structured iteration without ceremony"

**Use When:**
- Quick prototypes
- Single-feature tasks
- KB building
- Utility development

**Flow:**
```text
/dev "task description" → PROMPT.md → Execute → Verify → Done
```

**Characteristics:**
- Lightweight PROMPT files
- Session recovery via PROGRESS files
- Circuit breakers for safety
- No multi-phase ceremony

### 2. AgentSpec (Level 3 Spec-Driven Development)

**Location:** `.claude/sdd/`

**Philosophy:** "Comprehensive specification with agent orchestration"

**Use When:**
- Complex multi-component features
- Features requiring traceability
- Team coordination needed
- Infrastructure + code delivery

**Flow:**
```text
/brainstorm → /define → /design → /build → /ship
     │            │          │         │        │
     ▼            ▼          ▼         ▼        ▼
 Explore      Validate    Agent    Delegated  Archived
              Requirements Matching Execution  + Lessons
```

**Characteristics:**
- 5 structured phases
- Technical Context gathering
- Agent Matching in Design
- Agent Delegation in Build
- KB-grounded patterns

### Choosing Between Them

| Dimension | Dev Loop | AgentSpec |
|-----------|----------|-----------|
| Phases | 1 (execute) | 5 (brainstorm→ship) |
| Overhead | Low | Medium |
| Traceability | Logs only | Full artifacts |
| Agent Orchestration | No | Yes |
| Best For | Quick tasks | Complex features |

### Decision Flowchart

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    WHICH WORKFLOW SHOULD I USE?                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Start: "I need to build something"                                  │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────────────────┐                                     │
│  │ Is it a quick task?         │                                     │
│  │ (< 3 files, clear scope)    │                                     │
│  └─────────────┬───────────────┘                                     │
│           YES  │  NO                                                 │
│         ┌──────┴──────┐                                              │
│         ▼             ▼                                              │
│    Dev Loop    ┌─────────────────────────────┐                       │
│    /dev        │ Does it need traceability?  │                       │
│                │ (audit, team handoff, PRD)  │                       │
│                └─────────────┬───────────────┘                       │
│                         YES  │  NO                                   │
│                       ┌──────┴──────┐                                │
│                       ▼             ▼                                │
│                  AgentSpec     Dev Loop                              │
│                  /define       /dev                                  │
│                       │                                              │
│                       ▼                                              │
│                ┌─────────────────────────────┐                       │
│                │ Idea clear or vague?        │                       │
│                └─────────────┬───────────────┘                       │
│                      CLEAR   │  VAGUE                                │
│                       ┌──────┴──────┐                                │
│                       ▼             ▼                                │
│                   /define      /brainstorm                           │
│                                     │                                │
│                                     ▼                                │
│                                 /define                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### The 5-Phase Pipeline

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    AGENTSPEC PIPELINE                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────┐         │
│  │ Phase 0  │───▶│ Phase 1  │───▶│   Phase 2    │───▶│    Phase 3    │───▶│ Phase 4  │         │
│  │BRAINSTORM│    │  DEFINE  │    │    DESIGN    │    │     BUILD     │    │   SHIP   │         │
│  │(Optional)│    │          │    │              │    │               │    │          │         │
│  └────┬─────┘    └────┬─────┘    └──────┬───────┘    └───────┬───────┘    └────┬─────┘         │
│       │               │                 │                    │                 │               │
│       ▼               ▼                 ▼                    ▼                 ▼               │
│   Questions       Technical         Agent              Delegation         Archive             │
│   + Approaches    Context           Matching           + Execution        + Lessons           │
│   + YAGNI         + Clarity         + KB Lookup        + Attribution                          │
│                   Score 12/15                          + Verification                         │
│                                                                                                │
│  ◀───────────────────────────────────────────────────────────────────────────────────────────▶ │
│                                    /iterate (any phase)                                        │
│                                                                                                │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```text
                           ┌─────────────────────────────────────┐
                           │         .claude/kb/                 │
                           │  ┌─────┬─────┬─────┬─────┬────┐    │
                           │  │pydnt│ gcp │gemin│terra│... │    │
                           │  └──┬──┴──┬──┴──┬──┴──┬──┴────┘    │
                           └─────┼─────┼─────┼─────┼────────────┘
                                 │     │     │     │
                                 ▼     ▼     ▼     ▼
┌──────────────┐          ┌──────────────────────────────┐
│   DEFINE     │─────────▶│         KB Domains           │
│              │          │    (from Technical Context)  │
│ • Location   │          └──────────────┬───────────────┘
│ • KB Domains │                         │
│ • IaC Impact │                         ▼
└──────────────┘          ┌──────────────────────────────┐
                          │          DESIGN              │
                          │                              │
                          │  Agent Matching:             │
                          │  Glob(.claude/agents/**)     │
                          │         │                    │
                          │         ▼                    │
                          │  ┌────────────────────┐      │
                          │  │ Capability Index   │      │
                          │  │ • Keywords         │      │
                          │  │ • Roles            │      │
                          │  │ • Patterns         │      │
                          │  └─────────┬──────────┘      │
                          │            │                 │
                          │            ▼                 │
                          │  File Manifest + Agent       │
                          └──────────────┬───────────────┘
                                         │
                                         ▼
                          ┌──────────────────────────────┐
                          │          BUILD               │
                          │                              │
                          │  For each file:              │
                          │  ┌─────────────────────┐     │
                          │  │ Has @agent-name?    │     │
                          │  └──────────┬──────────┘     │
                          │       YES   │   NO           │
                          │         ┌───┴───┐            │
                          │         ▼       ▼            │
                          │    Task()    Direct          │
                          │    Invoke    Build           │
                          │         │       │            │
                          │         └───┬───┘            │
                          │             ▼                │
                          │      BUILD_REPORT            │
                          │    + Agent Attribution       │
                          └──────────────────────────────┘
```

---

## Key Innovations

### 1. Technical Context Gathering (Define Phase)

Traditional specs assume the AI knows where to put files. AgentSpec explicitly asks:

| Question | Why It Matters |
|----------|----------------|
| **Deployment Location** | Prevents misplaced files (src/ vs functions/ vs deploy/) |
| **KB Domains** | Design phase pulls correct patterns from curated knowledge |
| **IaC Impact** | Catches infrastructure needs early, triggers specialized agents |

```markdown
## Technical Context

| Aspect | Value | Notes |
|--------|-------|-------|
| **Deployment Location** | functions/ | Cloud Run serverless |
| **KB Domains** | pydantic, gcp, gemini | LLM extraction patterns |
| **IaC Impact** | New resources | Terraform for Cloud Run + Pub/Sub |
```

### 2. Agent Matching (Design Phase)

Design dynamically discovers available agents and matches them to tasks:

```text
Step 1: Discover        Step 2: Index           Step 3: Match
──────────────────      ─────────────           ─────────────

Glob(.claude/           agents:                 main.py → @function-developer
  agents/**/*.md)         function-developer:   schema.py → @extraction-specialist
       │                    keywords: [cloud    config.yaml → @infra-deployer
       ▼                      run, serverless]  test_main.py → @test-generator
40+ agent files              role: "Cloud Run
                              developer"
```

**Framework-Agnostic:** New agents added to `.claude/agents/` automatically become available for matching - zero configuration.

### 3. Agent Delegation (Build Phase)

Build invokes matched specialists via the Task tool:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT DELEGATION                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  File Manifest:                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ main.py    │ @function-developer  │ Cloud Run pattern │     │
│  │ schema.py  │ @extraction-specialist│ Pydantic + LLM   │     │
│  │ test.py    │ @test-generator      │ pytest fixtures   │     │
│  └────────────────────────────────────────────────────────┘     │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   PARALLEL EXECUTION                      │   │
│  │                                                           │   │
│  │  Task(subagent: "function-developer", prompt: "...")     │   │
│  │  Task(subagent: "extraction-specialist", prompt: "...")  │   │
│  │  Task(subagent: "test-generator", prompt: "...")         │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                          ▼                                       │
│  BUILD_REPORT:                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ File         │ Agent                  │ Status │ Notes │     │
│  │ main.py      │ @function-developer    │   ✅   │ ...   │     │
│  │ schema.py    │ @extraction-specialist │   ✅   │ ...   │     │
│  │ test.py      │ @test-generator        │   ✅   │ ...   │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Competitive Landscape

### Framework Comparison

| Dimension | Spec-Kit (GitHub) | OpenSpec (Fission-AI) | AgentSpec (Claude Code) |
|-----------|-------------------|----------------------|-------------------------|
| **Philosophy** | "Specs as executable" | "Fluid not rigid" | "Who builds, not just what" |
| **Backing** | GitHub (enterprise) | Indie/startup | Claude Code ecosystem |
| **Phases** | 5 (Constitution→Implement) | 4 (new→apply→archive) | 5 (Brainstorm→Ship) |
| **Tool Support** | 16+ agents | 20+ tools | Claude Code native |
| **Agent Awareness** | ❌ None | ❌ None | ✅ Full orchestration |
| **KB Grounding** | ❌ None | ❌ None | ✅ 8+ domains |
| **Agent Matching** | ❌ None | ❌ None | ✅ Dynamic discovery |
| **Agent Delegation** | ❌ None | ❌ None | ✅ Task tool invocation |

### Positioning

```text
                    COMPLEXITY
                         │
              ┌──────────┼──────────┐
              │          │          │
              │    AgentSpec        │
         HIGH │    (orchestration)  │
              │          ▲          │
              │          │          │
              │    Spec-Kit         │
       MEDIUM │    (governance)     │
              │          ▲          │
              │          │          │
              │    OpenSpec         │
          LOW │    (pragmatic)      │
              │                     │
              └─────────────────────┘
                    TOOL-AGNOSTIC ────────► SPECIALIZED
                         │
                    OpenSpec              AgentSpec
                    Spec-Kit
```

### When to Use Each

| Framework | Sweet Spot |
|-----------|------------|
| **Spec-Kit** | Enterprise teams needing governance, audit trails, compliance |
| **OpenSpec** | Agile devs wanting simple "spec→code" without ceremony |
| **AgentSpec** | Teams with curated agents/KBs wanting orchestrated specialized execution |

---

## The Agent Ecosystem

AgentSpec leverages a rich ecosystem of 40+ specialized agents:

### By Category

| Category | Agents | Specialization |
|----------|--------|----------------|
| **Workflow** | brainstorm, define, design, build, ship, iterate | SDD phases |
| **Code Quality** | code-reviewer, code-cleaner, test-generator, dual-reviewer | Quality assurance |
| **Data Engineering** | spark-specialist, lakeflow-architect, medallion-architect | Data pipelines |
| **AI/ML** | llm-specialist, extraction-specialist, genai-architect | LLM systems |
| **Infrastructure** | ci-cd-specialist, infra-deployer, aws-lambda-architect | DevOps |
| **Domain** | function-developer, pipeline-architect, dataops-builder | Project-specific |

### Agent Structure

Each agent follows a standard structure for capability extraction:

```markdown
# {Agent Name}

> {One-line description} ← Used for matching

## Identity

| Attribute | Value |
|-----------|-------|
| **Role** | {Role name} ← Primary capability keyword
| **Model** | {opus/sonnet/haiku}
| ...

## Core Capabilities ← Keywords for matching

| Capability | Description |
|------------|-------------|
| **{Verb}** | {What it does}

## Process ← How it works

## Tools Available ← What it can use
```

---

## Knowledge Base Integration

AgentSpec integrates deeply with the curated Knowledge Base:

### Available Domains

| Domain | Purpose | Entry Point |
|--------|---------|-------------|
| **pydantic** | Data validation, LLM output parsing | `.claude/kb/pydantic/` |
| **gcp** | Cloud Run, Pub/Sub, GCS, BigQuery | `.claude/kb/gcp/` |
| **gemini** | Document extraction, vision tasks | `.claude/kb/gemini/` |
| **langfuse** | LLM observability | `.claude/kb/langfuse/` |
| **terraform** | Infrastructure as Code | `.claude/kb/terraform/` |
| **terragrunt** | Multi-environment orchestration | `.claude/kb/terragrunt/` |
| **crewai** | Multi-agent orchestration | `.claude/kb/crewai/` |
| **openrouter** | LLM fallback provider | `.claude/kb/openrouter/` |

### KB Flow

```text
DEFINE                    DESIGN                    BUILD
──────                    ──────                    ─────

KB Domains:          →    Read patterns:       →    Agents consult:
• pydantic                • extraction-schema       • KB/pydantic/patterns/
• gemini                  • invoice-extraction      • KB/gemini/patterns/
• gcp                     • cloud-run-module        • KB/gcp/patterns/
```

---

## Artifacts

### Artifact Lifecycle

```text
.claude/sdd/
├── features/                          # Active work
│   ├── BRAINSTORM_{FEATURE}.md       # Phase 0 output
│   ├── DEFINE_{FEATURE}.md           # Phase 1 output
│   └── DESIGN_{FEATURE}.md           # Phase 2 output
│
├── reports/                           # Build outputs
│   └── BUILD_REPORT_{FEATURE}.md     # Phase 3 output
│
└── archive/                           # Completed work
    └── {FEATURE}/
        ├── BRAINSTORM_{FEATURE}.md   # (if used)
        ├── DEFINE_{FEATURE}.md
        ├── DESIGN_{FEATURE}.md
        ├── BUILD_REPORT_{FEATURE}.md
        └── SHIPPED_{DATE}.md         # Phase 4 output
```

### Key Artifact Sections

#### DEFINE (Technical Context)

```markdown
## Technical Context

| Aspect | Value | Notes |
|--------|-------|-------|
| **Deployment Location** | functions/ | Cloud Run serverless |
| **KB Domains** | pydantic, gcp, gemini | Which patterns to consult |
| **IaC Impact** | New resources | Terraform changes needed |
```

#### DESIGN (Agent Assignment)

```markdown
## File Manifest

| # | File | Action | Purpose | Agent | Dependencies |
|---|------|--------|---------|-------|--------------|
| 1 | main.py | Create | Handler | @function-developer | None |
| 2 | schema.py | Create | Pydantic | @extraction-specialist | None |
| 3 | test.py | Create | Tests | @test-generator | 1, 2 |

## Agent Assignment Rationale

| Agent | Files | Why This Agent |
|-------|-------|----------------|
| @function-developer | 1 | Cloud Run patterns from KB |
| @extraction-specialist | 2 | Pydantic + LLM output validation |
| @test-generator | 3 | pytest fixtures specialist |
```

#### BUILD_REPORT (Attribution)

```markdown
## Agent Contributions

| Agent | Files | Specialization Applied |
|-------|-------|------------------------|
| @function-developer | 2 | Cloud Run, Pub/Sub handlers |
| @extraction-specialist | 2 | Pydantic models, LLM output |
| @test-generator | 2 | pytest, fixtures |
| (direct) | 1 | DESIGN patterns only |
```

---

## Commands

| Command | Phase | Purpose | Model |
|---------|-------|---------|-------|
| `/brainstorm` | 0 | Explore ideas through dialogue | Opus |
| `/define` | 1 | Capture and validate requirements | Opus |
| `/design` | 2 | Create architecture + agent matching | Opus |
| `/build` | 3 | Execute with agent delegation | Sonnet |
| `/ship` | 4 | Archive with lessons learned | Haiku |
| `/iterate` | Any | Update documents mid-stream | Sonnet |

---

## Quick Start

### Complex Feature (Full Pipeline)

```bash
# Phase 0: Explore the idea (optional)
/brainstorm "Build an invoice extraction system"

# Phase 1: Define requirements with Technical Context
/define .claude/sdd/features/BRAINSTORM_INVOICE_EXTRACTION.md

# Phase 2: Design with Agent Matching
/design .claude/sdd/features/DEFINE_INVOICE_EXTRACTION.md

# Phase 3: Build with Agent Delegation
/build .claude/sdd/features/DESIGN_INVOICE_EXTRACTION.md

# Phase 4: Archive
/ship .claude/sdd/features/DEFINE_INVOICE_EXTRACTION.md
```

### Clear Requirements (Skip Brainstorm)

```bash
# Phase 1: Define directly
/define "Build a REST API endpoint for user authentication"

# Continue: /design → /build → /ship
```

### Mid-Stream Changes

```bash
# Update any phase
/iterate DEFINE_AUTH.md "Add OAuth support requirement"
/iterate DESIGN_AUTH.md "Change to use JWT tokens"
```

---

## Why AgentSpec?

### The Core Insight

> **"The AI doesn't just need to know WHAT to build - it needs to know WHO should build each part."**

Traditional specs produce a task list. AgentSpec produces a **team assignment**.

### Unique Value Proposition

1. **Agent Orchestration** - No other framework assigns specialists to tasks
2. **KB Grounding** - Curated patterns ensure consistency
3. **Technical Context** - Explicit questions prevent misalignment
4. **Framework-Agnostic Discovery** - New agents auto-available
5. **Attribution** - Clear ownership of each deliverable

### Trade-offs (Honest Assessment)

| Pro | Con |
|-----|-----|
| Deep Claude Code integration | Vendor lock-in |
| Sophisticated orchestration | Higher complexity |
| KB-grounded quality | Requires curated KBs |
| Agent specialization | Requires agent ecosystem |

---

## Anti-Patterns

Avoid these common mistakes when using AgentSpec:

| Anti-Pattern | Problem | Solution |
| ------------ | ------- | -------- |
| **Skipping Define** | "I know what to build" | Even clear requirements benefit from Technical Context capture |
| **Over-Brainstorming** | 10 questions, 5 approaches | Max 5 questions, 3 approaches. Apply YAGNI ruthlessly |
| **Generic Agent Assignment** | All files → `(general)` | Invest in agent ecosystem; specialists produce better code |
| **Empty KB Domains** | "We don't have patterns" | Use `/create-kb` to build domain knowledge before Design |
| **Monolithic Design** | One 1000-line file | Break into files that map to single agents |
| **Skipping /iterate** | "I'll just edit the code" | Changes should flow through specs for traceability |
| **Ignoring Attribution** | Not checking BUILD_REPORT | Agent attribution reveals quality patterns and gaps |

### The "Just Code It" Trap

```text
❌ WRONG                              ✅ RIGHT
───────                              ───────

"I'll just write the code"    vs    "Let me /define first"
        │                                   │
        ▼                                   ▼
   Code works but:                    Spec captures:
   • No KB patterns                   • Location decision
   • Random file location             • KB domains to use
   • No agent expertise               • Agent assignments
   • No traceability                  • Full attribution
        │                                   │
        ▼                                   ▼
   Future you: "Why is               Future you: "Oh, @extraction-
   this code here?"                  specialist built this with
                                     Pydantic patterns from KB"
```

---

## Extending AgentSpec

### Adding a New Agent

1. **Create the agent file:**

```bash
# Location: .claude/agents/{category}/{agent-name}.md
touch .claude/agents/data-engineering/dbt-specialist.md
```

1. **Follow the standard structure:**

```markdown
# DBT Specialist

> Expert in dbt transformations and data modeling

## Identity

| Attribute | Value |
|-----------|-------|
| **Role** | Data Transformation Engineer |
| **Model** | Sonnet |
| **Phase** | 3 - Build |

## Core Capabilities

| Capability | Description |
|------------|-------------|
| **Model** | Create dbt models with refs |
| **Test** | Add schema tests |
| **Document** | Generate docs |
```

1. **The agent is automatically discoverable** - Design phase will find it via `Glob(.claude/agents/**/*.md)`

### Adding a New KB Domain

1. **Create the domain structure:**

```bash
mkdir -p .claude/kb/dbt
touch .claude/kb/dbt/{index.md,quick-reference.md}
mkdir -p .claude/kb/dbt/{concepts,patterns}
```

1. **Register in KB index:**

```yaml
# .claude/kb/_index.yaml
domains:
  dbt:
    description: "dbt transformation patterns"
    entry_point: ".claude/kb/dbt/index.md"
```

1. **Reference in DEFINE Technical Context:**

```markdown
## Technical Context

| Aspect | Value |
|--------|-------|
| **KB Domains** | pydantic, dbt |  # Now available
```

### Capability Keywords

Design phase matches agents using these keywords extracted from agent files:

| Source | Keywords Extracted |
| ------ | ------------------ |
| Header description | Main purpose verbs |
| Role (Identity table) | Primary capability |
| Core Capabilities | All capability names |
| Process steps | Domain-specific terms |

**Pro tip:** Use specific keywords in your agent's description for better matching:

```markdown
# Good: "Expert in dbt transformations and Snowflake data modeling"
# Bad: "Helps with data stuff"
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 4.2.0 | 2026-01-29 | Added Agent Matching + Delegation (this release) |
| 4.1.2 | 2026-01-28 | Added Sample Collection to /brainstorm |
| 4.1.0 | 2026-01-27 | Added Phase 0: /brainstorm |
| 4.0.0 | 2026-01-25 | Complete rewrite: 8→5 phases |

---

## References

| Resource | Location |
|----------|----------|
| SDD Index | `.claude/sdd/_index.md` |
| Dev Loop | `.claude/dev/` |
| Agents | `.claude/agents/` |
| Knowledge Base | `.claude/kb/` |
| Commands | `.claude/commands/workflow/` |
| Templates | `.claude/sdd/templates/` |

---

## The Agentic-First Vision

AgentSpec is designed for a future where:

1. **AI models are specialists** - Not one-size-fits-all, but domain experts
2. **Specifications are executable** - Not just documentation, but orchestration
3. **Quality comes from expertise** - Specialists produce better code than generalists
4. **Knowledge is curated** - Patterns validated by MCP, not hallucinated
5. **Traceability is automatic** - Every file has an owner, every decision has rationale

**AgentSpec is not just a specification framework. It's an AI team orchestration system.**

```text
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   "Tell me WHAT to build, I'll figure out WHO should build it"  │
│                                                                  │
│                         — AgentSpec                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```
