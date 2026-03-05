# PROMPT: [NAME]

> Replace [NAME] with your task identifier (e.g., SPARK_KB, DATE_PARSER, CACHE_FEATURE)

---

## Goal

[One sentence describing what "done" looks like — be specific and verifiable]

---

## Quality Tier

<!-- Choose ONE tier that sets expectations for this task -->

**Tier:** production

| Tier | Expectations |
|------|--------------|
| `prototype` | Speed over perfection. Skip edge cases. Minimal tests. |
| `production` | Tests required. Best practices. Full verification. |
| `library` | Backward compatibility. Full documentation. API stability. |

---

## Context

[Optional: Background info, constraints, file references, or links to existing code/docs]

---

## Tasks (Prioritized)

<!--
Priority Order: Execute RISKY first, then CORE, then POLISH
Mark tasks with: - [ ] (pending) or - [x] (done)
Use @agent-name to invoke specific agents
Add verification with: Verify: `command`
-->

### 🔴 RISKY (Do First)
<!-- Architectural decisions, unknown unknowns, integration points -->

- [ ] [Architectural or integration task]

### 🟡 CORE
<!-- Main feature implementation -->

- [ ] [Main feature task]
- [ ] @agent-name: [Task that needs a specific agent]
- [ ] [Task with verification]: Verify: `pytest tests/test_foo.py`

### 🟢 POLISH (Do Last)
<!-- Cleanup, optimization, nice-to-haves -->

- [ ] [Cleanup or optimization task]

---

## Exit Criteria

<!--
List OBJECTIVE, VERIFIABLE conditions that indicate completion.
Each criterion should be checkable with a command.
-->

- [ ] All tests pass: `pytest --tb=short`
- [ ] Types check: `pyright src/` or `mypy src/`
- [ ] Lint passes: `ruff check src/`
- [ ] File exists: `ls path/to/expected/file`
- [ ] [Custom criterion]: `[verification command]`

---

## Progress

<!--
AUTO-UPDATED by the executor after each iteration.
This is the "memory bridge" that prevents token burn from re-exploration.
-->

**Status:** NOT_STARTED

| Iteration | Timestamp | Task Completed | Key Decision | Files Changed |
|-----------|-----------|----------------|--------------|---------------|
| - | - | - | - | - |

---

## Config

```yaml
mode: hitl                # hitl (human-in-loop) | afk (autonomous)
quality_tier: production  # prototype | production | library
max_iterations: 30        # Stop after N loops
max_retries: 3            # Retry failed tasks N times
circuit_breaker: 3        # Stop if no progress for N loops
small_steps: true         # One logical change per task
feedback_loops:           # Commands to run between tasks
  - pytest
  - pyright
  - ruff check
```

---

## Notes

[Optional: Any additional notes, reminders, architectural decisions, or TODOs]

---

## References

<!-- Links to relevant documentation, PRDs, or external resources -->

- [Related PRD or Spec](.claude/sdd/features/PRD_*.md)
- [External documentation](https://...)
