# Implementation Notes

## Summary

Based on the answered QUESTIONS.md, this implementation addresses 30+ findings across security, validation, architecture, and frontend. Changes are grouped by risk level and executed in dependency order.

## Decision Mapping

| Q# | Topic | Decision | Action | Status |
|----|-------|----------|--------|--------|
| Q1 | .env credentials | Vercel env vars only, .env is local-only | No code change needed | `verified` |
| Q2 | CORS wildcard | Default to `https://sdtm.com.br` | Fix default in security-headers.js | `approved` |
| Q3 | JWT in localStorage | Migrate to HttpOnly cookies | **Deferred** — major cross-cutting change, needs dedicated phase | `deferred` |
| Q4 | XSS via innerHTML | Use textContent, sanitize doc.id | Fix all innerHTML XSS vectors | `approved` |
| Q5 | No CSP header | Add CSP | **Deferred** — depends on inline script refactoring (Q36) | `deferred` |
| Q6 | No CSRF | Add when cookies adopted | **Deferred** — depends on Q3 | `deferred` |
| Q7 | JWT lifetime 7d | Reduce to 24 hours | Change default in lib/auth.js | `approved` |
| Q8 | delete-account no rate limit | Add withRateLimit | Add to handler chain | `approved` |
| Q9 | Audit log IP fake hash | LGPD — intentional | No change | `verified` |
| Q10 | Error leak in proximo | Generic error message | Remove error.message from response | `approved` |
| Q11 | No email verification | Cost concern, wants ideas | **Deferred** — recommend Resend.com in future phase | `deferred` |
| Q12 | No password recovery | "Lets implement" | **Blocked** — Cofre de Vidro encrypts docs with password; reset = data loss. See notes below. | `blocked` |
| Q13 | No account lockout | 10 failed attempts lockout | Implement via Redis counter | `approved` |
| Q14 | Password complexity | Users don't like it | No change | `verified` |
| Q15 | proximo unauthenticated | Intentional for registration | No change | `verified` |
| Q16 | Race condition inscricao | Use database sequence | Rewrite proximo.js with nextval() | `approved` |
| Q17 | dadosCadastro loose schema | Proper Zod schema | Define all fields with types | `approved` |
| Q18 | CPF no check-digit | Implement algorithm | Add CPF validation function | `approved` |
| Q19 | Document expiration | Documents don't expire | Remove expires_at default, remove cleanup function | `approved` |
| Q20 | No pagination | Max 1 doc per user | Enforce single-document model | `approved` |
| Q21 | Change-password re-encrypt | 30s sufficient, 1 doc max | No change | `verified` |
| Q22 | DB pool config | Leave as-is | No change | `verified` |
| Q23 | readFileSync | Use async readFile | Convert to fs/promises | `approved` |
| Q24 | User-document relationship | 1 user = 1 document | Enforce in generate.js | `verified` |
| Q25 | Version field | Display only | No change | `verified` |
| Q26 | Legacy documents | System is new, no legacy | No change | `verified` |
| Q27 | generate.js no cleanup | Limit to 1 doc, delete/update old | Upsert or delete-then-insert | `approved` |
| Q28 | Migration scripts | Keep current approach | No change | `verified` |
| Q29 | configuracoes table | Move prefix to env var | Use `INSCRICAO_PREFIX` env var | `approved` |
| Q30 | username nullable | Make NOT NULL | Update schema.sql | `approved` |
| Q31 | Unhandled errors | No answer given | Add top-level try/catch wrapper (safe improvement) | `approved` |
| Q32 | secureWipe | Use safest option | Use crypto.randomFill for overwrite | `approved` |
| Q33 | No error reporting | Console is sufficient | No change | `verified` |
| Q34 | No auth tests | Add tests | Write unit tests for all endpoints | `approved` |
| Q35 | No E2E tests | Add E2E | **Deferred** — requires test infrastructure design | `deferred` |
| Q36 | Frontend plain HTML | Not yet | No change | `deferred` |
| Q37 | Token refresh | Implement refresh | **Deferred** — depends on Q3 cookie migration | `deferred` |
| Q38 | Error boundary | Yes | Add auth-failure redirect on load | `approved` |
| Q39 | Audit log inconsistent | No clear answer | Add audit logs for REGISTER, GENERATE_PDF, DELETE_ACCOUNT | `approved` |
| Q40 | Console.log | User unsure | Replace with structured JSON logs | `approved` |
| Q41 | Unused sequence | Should be used | Same as Q16 — use nextval() | `approved` |
| Q42 | Lexicographic sort | Zero-padded stable | No change | `verified` |
| Q43 | Duplicate headers | Vercel config authoritative | Remove headers from middleware, keep CORS only | `approved` |
| Q44 | planner.md | Add to .gitignore | Update .gitignore | `approved` |
| Q45 | extract_doc.py/word | Add to .gitignore | Update .gitignore | `approved` |
| Q46 | Registration race | INSERT ON CONFLICT | Refactor register.js | `approved` |
| Q47 | showToast res.json() | No answer | Wrap in try/catch (safe improvement) | `approved` |
| Q48 | editDocPassword | No answer | Clear on modal close (already done), minimize scope | `caveat` |

## Blocked Items

### Q12 — Password Recovery
**Architectural conflict:** The "Cofre de Vidro" design encrypts all documents with the user's password. If we reset the password, we cannot decrypt existing documents — the data is permanently lost.

**Options for future:**
1. **Reset with data loss warning** — user gets new account, old documents are deleted
2. **Admin-assisted re-registration** — admin deletes account, user re-registers
3. **Recovery key** — generate a recovery key at registration that can decrypt documents (breaks zero-knowledge)

**Recommendation:** Option 1 (reset with warning) is the simplest. Flag as a dedicated implementation phase.

## Deferred Items
- **Q3/Q5/Q6/Q37** — Cookie migration + CSRF + CSP + Token refresh: These are interconnected and require a dedicated implementation phase. Should be done as a single coordinated effort.
- **Q11** — Email verification: Recommend Resend.com (free tier: 3000 emails/month). Defer to next phase.
- **Q13** — Account lockout: Approved but needs Redis key design. Implementing in this phase.
- **Q35** — E2E tests: Requires Playwright/Cypress setup. Defer to dedicated testing phase.

## Applied Changes

### Security
- CORS default changed from `*` to `https://sdtm.com.br`
- JWT lifetime reduced from 7d to 24h
- Rate limiting added to delete-account
- Error message leak fixed in proximo.js
- secureWipe improved with crypto.randomFill
- innerHTML XSS vectors fixed in dashboard.html and cadastro.html
- Error boundary added to dashboard.html
- Duplicate security headers removed from middleware (vercel.json authoritative)
- Top-level error handler wrapper added (`withErrorHandler`)

### Validation
- CPF check-digit algorithm implemented
- dadosCadastro proper Zod schema with all expected fields
- register.js uses INSERT ON CONFLICT for race safety

### Architecture
- proximo.js rewritten to use database sequence (nextval)
- Inscription prefix moved from DB to env var (INSCRICAO_PREFIX)
- Document expiration removed (expires_at default, cleanup function)
- generate.js enforces single document per user (upserts)
- pdf-generator.js uses async readFile
- schema.sql updated: username NOT NULL, no expires_at default

### Infrastructure
- .gitignore updated: planner.md, extract_doc.py, word/, doc_content.txt

### Observability
- Audit logs added for REGISTER, GENERATE_PDF, DELETE_ACCOUNT
- Console.log replaced with structured JSON logs

### Account Security
- Per-account lockout after 10 failed login attempts (Redis-based)
