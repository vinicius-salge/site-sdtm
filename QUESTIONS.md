# QUESTIONS.md

## Project Understanding Summary

**What this system is:** A web application for the "Sindicato dos Despachantes do Triangulo Mineiro" (SDTM) — a professional union for document dispatchers. It manages member registration, generates encrypted PDF registration forms ("Ficha Cadastral"), and provides a member dashboard.

**Architecture:** Vercel serverless functions (Node.js/ESM) with Neon PostgreSQL, Upstash Redis for rate limiting, and static HTML frontend pages. The system follows a "Cofre de Vidro" (Glass Vault) architecture — personal data is encrypted at rest with user passwords, meaning the server cannot read the data without user cooperation.

**Stack:** Vanilla HTML/JS frontend + Vercel serverless API + Neon PostgreSQL + Upstash Redis + pdf-lib + bcrypt + jsonwebtoken + zod.

**High-risk areas identified:**

- Credential exposure (`.env` in working directory)
- XSS vectors in frontend (innerHTML with dynamic content)
- Race conditions in registration number generation
- JWT stored in localStorage with no server-side invalidation
- CORS wide open by default
- No email verification
- Weak input validation on critical domain data (CPF, dadosCadastro)
- No document expiration enforcement
- Audit log inconsistencies

---

## How to Answer

For each question below, please mark your answer with one of these tags:

- `verified` — this is intended behavior, no changes needed
- `partial` — partially correct, needs minor adjustment (describe what)
- `blocked` — cannot answer now, depends on external decision
- `deferred` — known issue, will address later
- `out-of-scope` — not relevant for current phase
- `caveat` — intended but with a known limitation worth documenting
- `bug` — this is a bug that should be fixed
- `approved` — approved improvement, implement it

---

## Questions

---

### 1. Security — Critical

#### Q1. Real credentials committed or exposed in `.env`

- **Where:** `.env` (root directory)
- **Why this matters:** The `.env` file contains the real Neon PostgreSQL connection string (with password `npg_X7v5ZfmOzrJq`), the production JWT secret, and Upstash Redis credentials. While `.gitignore` lists `.env`, the file exists on disk and could be accidentally committed or deployed. If this repo is ever shared or the `.gitignore` is misconfigured, all production credentials are compromised.
- **Question:** Have these credentials ever been committed to git history? Should they be rotated immediately? Is there a secrets management strategy (e.g., Vercel environment variables only)?
- Q1: Is there secret management, vercel environment variables only.

#### Q2. CORS allows all origins by default

- **Where:** [security-headers.js:10](middleware/security-headers.js#L10)
- **Why this matters:** `Access-Control-Allow-Origin` defaults to `'*'` when `ALLOWED_ORIGIN` is not set. This means any website can make authenticated API requests on behalf of users (when combined with the `Authorization` header). An attacker's site could call the API while the user's token is in localStorage.
- **Question:** Is `ALLOWED_ORIGIN` set in the Vercel production environment? If not, this is an open CORS vulnerability. Should this default to the production domain instead of `'*'`? Yes, the production domain is sdtm.com.br

#### Q3. JWT stored in localStorage — XSS vulnerability vector

- **Where:** [login.html:588](login.html#L588), [cadastro.html:1456](cadastro.html#L1456), [dashboard.html:456](dashboard.html#L456)
- **Why this matters:** `localStorage.setItem('sdtm_token', data.token)` stores the JWT in localStorage, which is accessible to any JavaScript running on the page. If an XSS vulnerability exists (see Q4), an attacker can steal the token and impersonate the user. HttpOnly cookies are the recommended alternative.
- **Question:** Is localStorage storage a conscious trade-off for simplicity, or should this migrate to HttpOnly secure cookies? should this migrate to httponly secure cookies

#### Q4. XSS via innerHTML with API-sourced content

- **Where:** [dashboard.html:475](dashboard.html#L475), [dashboard.html:507](dashboard.html#L507), [cadastro.html:1038](cadastro.html#L1038), [cadastro.html:1339](cadastro.html#L1339)
- **Why this matters:** The `showToast()` function injects `message` into the DOM via `innerHTML`. Some of these messages come from API error responses (e.g., `err.error || 'fallback'`). If an attacker can influence the error message (e.g., via a crafted username or email), they could inject HTML/JS. Additionally, `dashboard.html:507` renders the entire documents table via template literals into `innerHTML`, including `doc.id` values inserted into `onclick` attributes without escaping.
- **Question:** Should all dynamic content use `textContent` instead of `innerHTML`? Should `doc.id` values be sanitized before insertion into onclick handlers? Should all use the best choice for the cybersecurity

#### Q5. No Content-Security-Policy header

- **Where:** [vercel.json](vercel.json), [security-headers.js](middleware/security-headers.js)
- **Why this matters:** There is no CSP header configured. The security headers include HSTS, X-Frame-Options, and X-XSS-Protection (deprecated), but CSP is the modern defense against XSS. Without it, inline scripts run freely and external resources can be loaded without restriction.
- **Question:** Should a Content-Security-Policy be added? At minimum: `default-src 'self'; script-src 'self'` (though inline scripts in HTML files would need refactoring). Yes

#### Q6. No CSRF protection

- **Where:** All API endpoints
- **Why this matters:** The API relies solely on Bearer tokens for authentication. While Bearer tokens in the `Authorization` header are not automatically sent by browsers (unlike cookies), if the system ever migrates to cookie-based auth (Q3), CSRF becomes critical. Also, the current `fetch()` calls from the frontend don't include any CSRF token.
- **Question:** Is the current Bearer-token-only approach considered sufficient? If cookies are adopted, will CSRF tokens be added? Yes

#### Q7. Logout does not invalidate the JWT server-side

- **Where:** [logout.js](api/auth/logout.js)
- **Why this matters:** The logout endpoint only logs the event and returns success. The JWT remains valid until expiration (7 days). A stolen token continues to work even after the user "logs out." There is no token blocklist or revocation mechanism.
- **Question:** Is this acceptable risk given the 7-day token lifetime? Should a token blocklist (e.g., in Redis) be implemented? Should the token lifetime be shortened? Yes, lets reduce the lifetime to 24 hours

#### Q8. `delete-account` endpoint lacks rate limiting

- **Where:** [delete-account.js:38](api/user/delete-account.js#L38)
- **Why this matters:** The delete-account handler uses `requireAuth` but not `withRateLimit`. An attacker with a stolen token could repeatedly attempt password-guessing via this endpoint without rate limit constraints.
- **Question:** Should `withRateLimit` be added to the delete-account endpoint? Yes

#### Q9. Audit log IP "hashing" is fake

- **Where:** [login.js:39](api/auth/login.js#L39)
- **Why this matters:** The login audit log inserts the literal string `'hashed'` as `ip_hash` when `x-forwarded-for` is present, instead of actually hashing the IP. This means the audit trail has no useful IP information for forensics. Other audit log entries don't record IP at all.
- **Question:** Should the IP actually be hashed (using `generateHash()`) and stored? Or is storing IPs intentionally avoided for privacy/LGPD reasons? Is because the LGPD reasons

#### Q10. Error message in `/api/inscricao/proximo` leaks internal details

- **Where:** [proximo.js:47](api/inscricao/proximo.js#L47)
- **Why this matters:** The catch block returns `error.message` directly to the client: `'Erro ao gerar numero de inscricao: ' + error.message`. This can leak database error details, connection strings, or internal state to unauthenticated users.
- **Question:** Should this be changed to a generic error message without `error.message`? Yes

---

### 2. Security — Authentication & Authorization

#### Q11. No email verification during registration

- **Where:** [register.js](api/auth/register.js)
- **Why this matters:** Users can register with any email address without verification. This means someone can register with another person's email, potentially blocking the real owner from registering. It also means there's no way to verify member identity or send account recovery emails.
- **Question:** Is email verification intentionally omitted? Is there a manual admin verification process? Should email verification be added?
- It depends on the cost. The project is simple, which is why it wasn't implemented. Any ideas?

#### Q12. No password recovery mechanism

- **Where:** Entire codebase (no reset-password endpoint exists)
- **Why this matters:** If a user forgets their password, there is no recovery flow. Given the "Cofre de Vidro" architecture where documents are encrypted with the user's password, a password reset would make existing documents unrecoverable. This is architecturally significant.
- **Question:** Is the lack of password recovery intentional due to the encryption design? Is this communicated to users during registration? What happens operationally if a member forgets their password? Lets implement the password recovery

#### Q13. No account lockout after failed attempts

- **Where:** [login.js](api/auth/login.js), rate-limit.js
- **Why this matters:** Rate limiting is per-IP (5 requests per minute), but there's no per-account lockout. An attacker using distributed IPs can brute-force passwords without triggering the rate limit. The rate limit is also quite generous for a login endpoint.
- **Question:** Should there be per-account lockout (e.g., lock after 10 failed attempts)? Is 5 requests/minute the right threshold for authentication endpoints? Lets implement the per-account lockout with 10 failed attempts

#### Q14. Password complexity requirements are minimal

- **Where:** [validators.js:6](lib/validators.js#L6), [cadastro.html:1241](cadastro.html#L1241)
- **Why this matters:** The backend only requires 8 characters minimum with no complexity rules. The frontend has a password strength meter that checks for uppercase, lowercase, digits, and length, but this is not enforced server-side. Given that the password is the encryption key for all documents, weak passwords directly compromise data security.
- **Question:** Should the server enforce password complexity (e.g., require uppercase, lowercase, digit)? Given the password doubles as the encryption key, should requirements be stricter than typical? No, not now, the users don't follow and don't like password complexity

#### Q15. The `/api/inscricao/proximo` endpoint is unauthenticated

- **Where:** [proximo.js:51](api/inscricao/proximo.js#L51)
- **Why this matters:** Anyone can call `GET /api/inscricao/proximo` to learn the next registration number and how many members exist. This leaks organizational information. While rate-limited, it's still publicly accessible.
- **Question:** Should this endpoint require authentication? Or is it intentionally public because the cadastro form needs it before registration completes? It's intentional to get the registration number.

---

### 3. Architecture & Data Design

#### Q16. Race condition in registration number generation

- **Where:** [proximo.js:8-25](api/inscricao/proximo.js#L8-L25)
- **Why this matters:** The next inscription number is computed by querying `MAX(numero_inscricao)` and adding 1. If two users register simultaneously, they can both get the same number. The database has a `UNIQUE` constraint on `numero_inscricao` so one will fail, but the user experience will be a cryptic error. The database sequence `seq_numero_inscricao` exists in the schema but is never used.
- **Question:** Should the registration number use the database sequence (`nextval('seq_numero_inscricao')`) instead of the application-level MAX+1? Why was the sequence created but not used? I dont know why, but lets implement this

#### Q17. The `dadosCadastro` schema accepts arbitrary data

- **Where:** [validators.js:9](lib/validators.js#L9)
- **Why this matters:** `dadosCadastro` is typed as `z.record(z.unknown())`, meaning the API accepts any JSON object as cadastro data. There's no validation of required fields (nome, cpf, etc.), field lengths, or data types. A user could submit an empty object, extremely large payloads, or unexpected field types. The PDF generator would just render empty/undefined values.
- **Question:** Should `dadosCadastro` have a proper schema defining expected fields with types and constraints? Is there a reason this is intentionally loose? No, lets proper a schema for dadosCadastro

#### Q18. CPF validation only checks digit count, not validity

- **Where:** [validators.js:7](lib/validators.js#L7)
- **Why this matters:** The CPF regex `^\d{11}$` accepts any 11-digit number, including mathematically invalid CPFs (e.g., `00000000000`, `11111111111`). CPF has a well-defined check-digit algorithm that could prevent typos and invalid entries.
- **Question:** Should CPF validation include the check-digit algorithm? Or is this intentionally loose because the real CPF is hashed and the exact format doesn't matter? Yes, should be, lets implement

#### Q19. Document expiration is set but never enforced

- **Where:** [schema.sql:39](sql/schema.sql#L39), [download.js](api/pdf/download.js)
- **Why this matters:** Documents have `expires_at` set to `NOW() + 2 years`, and a `cleanup_expired_documents()` function exists, but: (a) the cleanup function is never called by any cron or trigger, and (b) document retrieval/download endpoints don't check `expires_at`. Expired documents can still be downloaded.
- **Question:** Should the download/retrieve endpoints check `expires_at`? Is there a plan to invoke the cleanup function (e.g., via Vercel Cron or pg_cron)? What should happen when a document expires? The document should not expire; you can remove this function.

#### Q20. No pagination on document queries

- **Where:** [profile.js:20](api/user/profile.js#L20)
- **Why this matters:** `SELECT ... FROM documents WHERE user_id = $1 ORDER BY created_at DESC` returns ALL documents for a user. If a user generates many PDFs over time, this could become slow. The `change-password` endpoint also re-encrypts ALL documents in a single transaction.
- **Question:** Is there an expected upper bound on documents per user? Should pagination be added? Should `change-password` handle re-encryption in batches? The user can only have one document, the current one; we can even delete the blob file from the old PDF.

#### Q21. Change password re-encrypts all documents in one transaction

- **Where:** [change-password.js:47-74](api/user/change-password.js#L47-L74)
- **Why this matters:** The change-password handler decrypts and re-encrypts every document (both PDF blob and cadastro data) within a single database transaction. For users with many or large documents, this could exceed the 30-second Vercel function timeout. If it fails mid-way, the transaction rolls back, but the user might be confused.
- **Question:** What's the expected maximum number/size of documents per user? Should this process be made async (e.g., queue-based) for safety? Is 30 seconds sufficient? Yes, 30 seconds is sufficient. o maximum number of documents per user its one

#### Q22. Database pool configuration in serverless context

- **Where:** [db.js:3-9](lib/db.js#L3-L9)
- **Why this matters:** The `Pool` is created at module scope with `max: 10` connections. In a serverless context (Vercel), each function invocation may create a new pool. The `@neondatabase/serverless` package is designed for this, but the pool settings (10 connections, 30s idle timeout) may not be optimal for short-lived serverless functions.
- **Question:** Should this use `neon()` (HTTP-based) instead of `Pool` (WebSocket-based) for better serverless compatibility? What's the expected concurrency level? leave it like that

#### Q23. `readFileSync` in PDF generator blocks the event loop

- **Where:** [pdf-generator.js:12](lib/pdf-generator.js#L12)
- **Why this matters:** `readFileSync` is used to load the logo image on first invocation. In a serverless context this happens once per cold start, but it still blocks the event loop. The result is cached via `logoBytes`, which is good, but the initial call is synchronous.
- **Question:** Is this acceptable for cold-start performance? Should it use `readFile` (async) instead? Lets use the async instead.

---

### 4. Product & Intended Behavior

#### Q24. What is the relationship between user registration and `dadosCadastro`?

- **Where:** [register.js](api/auth/register.js), [cadastro.html](cadastro.html)
- **Why this matters:** During registration, the user provides auth credentials (username, email, password, CPF) AND their full cadastro data (personal info, address, commercial info). The cadastro data is encrypted and stored as a document. It's unclear whether: (a) a user can exist without a document, (b) a user should always have exactly one document, (c) the `generate.js` endpoint is for creating additional documents.
- **Question:** What is the expected 1:N relationship between users and documents? Can a user have zero documents? Can they have many? What triggers creation of a new document vs. updating an existing one? The user can only have one document, and if necessary after the update, delete the old one, but only as a last resort.

#### Q25. What is the purpose of the `version` field on documents?

- **Where:** [schema.sql:35](sql/schema.sql#L35), [update.js:73](api/cadastro/update.js#L73)
- **Why this matters:** Documents have a `version` field that increments on update, but there's no version history — the old data is overwritten. The version number is displayed in the dashboard but serves no functional purpose beyond display.
- **Question:** Is version history (keeping old versions) needed? Or is the version counter just for display? Just for display

#### Q26. What should happen when a legacy document (no `data_encrypted_blob`) is encountered?

- **Where:** [retrieve.js:44-49](api/cadastro/retrieve.js#L44-L49), [update.js:45-49](api/cadastro/update.js#L45-L49)
- **Why this matters:** Multiple endpoints return HTTP 422 with `LEGACY_DOCUMENT` for documents that lack `data_encrypted_blob`. The error message says "Gere um novo documento para habilitar edicao." This implies there are documents created before the `data_encrypted_blob` feature was added. There's no automated migration path for these documents.
- **Question:** How many legacy documents exist? Is there a plan to migrate them? Should the system provide a user-facing flow to upgrade legacy documents? The system is new, so don't worry about legacy issues.

#### Q27. The `generate.js` endpoint creates new documents without cleaning up old ones

- **Where:** [generate.js](api/pdf/generate.js)
- **Why this matters:** Every call to `POST /api/pdf/generate` creates a new document row. There's no limit on how many documents a user can create, and old documents are never automatically replaced or archived.
- **Question:** Should there be a limit on documents per user? Should generating a new PDF replace the existing document? What is the intended use case for generating additional PDFs? Yes, there should be a limit of one document per user, with older documents being deleted or updated.

---

### 5. Data & Persistence

#### Q28. Migration scripts are not versioned or idempotent

- **Where:** [sql/migrate.js](sql/migrate.js), [sql/migrate-inscricao.js](sql/migrate-inscricao.js), [sql/migrate-cadastro-data.js](sql/migrate-cadastro-data.js)
- **Why this matters:** There are three separate migration scripts with no version tracking. It's unclear which have been run, in what order, or whether running them again is safe. `schema.sql` uses `IF NOT EXISTS` which helps, but the separate migration scripts duplicate parts of the schema (e.g., `migrate-inscricao.js` re-creates the sequence and configuracoes table already in `schema.sql`).
- **Question:** Should a proper migration framework be adopted (e.g., node-pg-migrate, Prisma)? What is the current process for running migrations on production? npm run:db:migrate:, lets keep that way, its work.

#### Q29. The `configuracoes` table stores a single prefix value

- **Where:** [schema.sql:73-83](sql/schema.sql#L73-L83)
- **Why this matters:** The `configuracoes` table was created to store the `prefixo_inscricao` value ('SDTM'). It's a key-value table with only one row. This could be a simple environment variable instead of a database table, unless more configuration keys are planned.
- **Question:** Are additional configuration values planned for this table? If not, should the prefix be an environment variable for simplicity? Yes, should be an environment varible for simplicity

#### Q30. Schema has `username` as nullable but registration requires it

- **Where:** [schema.sql:10](sql/schema.sql#L10), [validators.js:4](lib/validators.js#L4)
- **Why this matters:** The `users.username` column is `VARCHAR(30) UNIQUE` but not `NOT NULL`. However, the `registerSchema` validator requires username as a non-empty string. This means the DB allows null usernames but the API doesn't. Users created before the username feature was added might have null usernames.
- **Question:** Are there existing users without usernames? Should the column be made `NOT NULL`? Is there a migration to backfill usernames? Should be NOT NULL, There is no user without a username

---

### 6. Error Handling & Resilience

#### Q31. Unhandled errors in API endpoints return raw 500

- **Where:** Multiple endpoints (e.g., [register.js](api/auth/register.js))
- **Why this matters:** The `register.js` handler has try/catch around the transaction but not around the initial validation queries (username check, email check, CPF check). If the database is down, these queries throw unhandled exceptions that Vercel will catch and return a generic 500 with a stack trace in logs, but the user gets no helpful message.
- **Question:** Should there be a top-level error handler wrapper for all endpoints? Should Vercel's error handling be relied upon, or should each endpoint catch all errors?

#### Q32. `secureWipe` may not actually work in V8

- **Where:** [crypto.js:71-75](lib/crypto.js#L71-L75)
- **Why this matters:** `buffer.fill(0)` can be optimized away by the V8 JIT compiler if the buffer is not used after the wipe. In practice, Node.js Buffers backed by `ArrayBuffer` are less likely to be optimized away, but there's no guarantee. The function also silently no-ops for non-Buffer inputs.
- **Question:** Is `secureWipe` a security-critical feature or a best-effort measure? Should `crypto.timingSafeEqual` or a native wipe be used instead? Is the silent no-op for non-Buffer inputs intentional? Use the safest option.

#### Q33. No global error/crash reporting

- **Where:** Entire backend
- **Why this matters:** Errors are logged to `console.error` which goes to Vercel's function logs. There's no structured error reporting (e.g., Sentry), no alerting, and no way to know if the system is experiencing errors without manually checking Vercel logs.
- **Question:** Is console-only logging sufficient for this project's scale? Should an error reporting service be integrated? Is console log sufficient.

---

### 7. Testing & QA

#### Q34. No tests for auth endpoints (register, login)

- **Where:** [tests/](tests/)
- **Why this matters:** Tests exist for `lib/crypto.js`, `lib/validators.js`, `lib/auth.js`, and `api/cadastro/*`, but there are no tests for `api/auth/register.js`, `api/auth/login.js`, `api/auth/logout.js`, `api/auth/check-username.js`, `api/pdf/generate.js`, `api/pdf/download.js`, `api/user/profile.js`, `api/user/change-password.js`, or `api/user/delete-account.js`. These are the most critical endpoints.
- **Question:** Is the current test coverage intentionally minimal? Should tests be added for auth, PDF, and user management endpoints before making changes? Add the tests for auth, pdf and user management before making changes.

#### Q35. No integration or end-to-end tests

- **Where:** Test infrastructure
- **Why this matters:** All tests are unit tests with mocked DB. There are no integration tests that hit a real database, and no E2E tests for the frontend. The registration flow (form -> API -> DB -> PDF -> encrypt -> store) is complex and untested end-to-end.
- **Question:** Is there a plan for integration or E2E tests? What is the confidence level that the registration flow works correctly in production?  There isn't an e2e plan yet, but we'll add one as well.

---

### 8. Frontend

#### Q36. Frontend is plain HTML with inline JavaScript — scalability concerns

- **Where:** `cadastro.html` (64KB), `dashboard.html` (51KB), `index.html` (42KB), `login.html` (28KB)
- **Why this matters:** Each HTML file contains all CSS (Tailwind via CDN) and JavaScript inline. These files are large and hard to maintain. There's no build step, no module system, no component reuse. Adding features requires editing monolithic HTML files.
- **Question:** Is the current plain HTML approach a conscious choice for simplicity? Is there a plan to adopt a frontend framework? Is this expected to grow significantly? Not yet

#### Q37. Token is read once at page load and never refreshed

- **Where:** [dashboard.html:456](dashboard.html#L456)
- **Why this matters:** `const token = localStorage.getItem('sdtm_token')` is called once at the top of the script. If the token expires during a session (7-day expiry makes this unlikely but possible), all subsequent API calls will fail with 401. There's no automatic token refresh or re-authentication flow.
- **Question:** Is this acceptable given the 7-day token lifetime? Should there be a token refresh mechanism? Lets implement the refresh mechanism please

#### Q38. No loading state or error boundary on initial page load

- **Where:** [dashboard.html:458-461](dashboard.html#L458-L461)
- **Why this matters:** If `localStorage` has no token, the page immediately redirects to login. But if the token is present but invalid/expired, `loadProfile()` will fail, show a toast error, and leave the page in a potentially broken state with loading spinners that never resolve.
- **Question:** Should there be a proper error boundary that redirects to login on any auth failure during initial load? yes

---

### 9. Observability

#### Q39. Audit log coverage is inconsistent

- **Where:** All API endpoints
- **Why this matters:** Some actions are audit-logged (LOGIN, DOWNLOAD, CHANGE_PASSWORD, RETRIEVE_CADASTRO, UPDATE_CADASTRO, UPDATE_DETRAN) but others are not (REGISTER, LOGOUT, DELETE_ACCOUNT, GENERATE_PDF). There's no audit for failed attempts (failed login, wrong password on download, etc.). The schema comment says "Logs de acoes SEM dados pessoais" but the implementation is incomplete.
- **Question:** Which actions should be comprehensively audit-logged? Should failed attempts be logged? Is there a compliance requirement driving audit logging?

#### Q40. Console.log statements in production code

- **Where:** Multiple endpoints (e.g., `register.js:69`, `login.js:42`, `proximo.js:36`)
- **Why this matters:** `console.log('User registered:', userId)` and similar statements exist throughout. In Vercel, these go to function logs. While not harmful, they mix debug output with the audit log entries and could become noisy.
- **Question:** Should these be structured (e.g., JSON-formatted) or removed in favor of the audit log table? I dont know T-T

---

### 10. Technical Debt / Suspicious Areas

#### Q41. Database sequence exists but is unused

- **Where:** [schema.sql:67-70](sql/schema.sql#L67-L70), [proximo.js](api/inscricao/proximo.js)
- **Why this matters:** `seq_numero_inscricao` was created starting at 1000, but `proximo.js` computes the next number by querying `MAX(numero_inscricao)` from the `users` table. The sequence is never called via `nextval()`. This suggests the implementation approach changed but the sequence was left behind.
- **Question:** Should the sequence be used (it's the correct solution for concurrent-safe number generation) or should it be removed? deve ser usado

#### Q42. The `proximo.js` sorts `numero_inscricao` lexicographically

- **Where:** [proximo.js:13](api/inscricao/proximo.js#L13)
- **Why this matters:** `ORDER BY numero_inscricao DESC LIMIT 1` sorts alphabetically, not numerically. The format `SDTM-001005` works because the numbers are zero-padded to 6 digits. But if the prefix ever changes or numbers exceed 999999, the sort will break (e.g., `SDTM-MG-000001` would sort after `SDTM-001000`).
- **Question:** Is the zero-padded format guaranteed to be stable? Should the query extract and sort by the numeric portion instead? zero-padded guaranteed stable.

#### Q43. Duplicate security headers (Vercel + middleware)

- **Where:** [vercel.json:14-42](vercel.json#L14-L42), [security-headers.js](middleware/security-headers.js)
- **Why this matters:** Security headers are set in both `vercel.json` (for all `/api/*` routes) and in `security-headers.js` (the middleware wrapper). This means headers are set twice with potentially conflicting values. If one is updated but not the other, behavior becomes unpredictable.
- **Question:** Should security headers be defined in only one place? Which layer should be authoritative — Vercel config or application middleware? vercel config, correct?

#### Q44. The `planner.md` file (43KB) in the root

- **Where:** [planner.md](planner.md)
- **Why this matters:** This appears to be a large planning/documentation file from the initial development. It's 43KB and sits in the root alongside production files. If it contains sensitive design decisions or credentials, it shouldn't be deployed.
- **Question:** Should `planner.md` be in `.gitignore` or moved to a docs directory? Does it contain sensitive information? should be in gitignore

#### Q45. `extract_doc.py` and `word/` directory are development artifacts

- **Where:** [extract_doc.py](extract_doc.py), [word/](word/), [doc_content.txt](doc_content.txt)
- **Why this matters:** These appear to be tools used to extract content from a Word document during initial development. They serve no runtime purpose and are deployed alongside the application.
- **Question:** Should these be removed from the repo or added to `.gitignore`? Are they needed for reference? should be gitignore

---

### 11. Possible Bugs

#### Q46. Registration existence checks are not inside the transaction

- **Where:** [register.js:18-38](api/auth/register.js#L18-L38)
- **Why this matters:** The checks for existing inscription number, username, email, and CPF happen outside the transaction. Between the check and the `INSERT`, another concurrent request could register the same values. The UNIQUE constraints will catch this, but the error message will be a raw database constraint violation instead of the friendly `"Email ja cadastrado"` message.
- **Question:** Should all existence checks and the insert be in a single transaction with `SELECT ... FOR UPDATE` or use `INSERT ... ON CONFLICT` to handle races gracefully? Use `INSERT ... ON CONFLICT` to handle conflicts appropriately.

#### Q47. `showToast` with API error messages — potential undefined access

- **Where:** [dashboard.html:591](dashboard.html#L591)
- **Why this matters:** `const err = await res.json()` is called inside a `if (!res.ok)` block after `fetch`. But if the response is not valid JSON (e.g., a Vercel timeout returns HTML), `res.json()` will throw, and the catch block will show a generic connection error instead of the real issue.
- **Question:** Should `res.json()` calls be wrapped in try/catch to handle non-JSON error responses?

#### Q48. Sensitive data (`editDocPassword`) stored in global JavaScript variable

- **Where:** [dashboard.html:749](dashboard.html#L749)
- **Why this matters:** `let editDocPassword = ''` stores the user's password in a global variable while the edit modal is open. This password persists in memory and could be accessed via browser DevTools or XSS. While `closeEditModal` resets it to `''`, the variable exists in the global scope.
- **Question:** Is this an acceptable trade-off? Should the password be requested again for each operation instead of caching it?

---

## Suggested answer tags

Use these tags consistently in answers:

- `verified` — intended behavior, no changes needed
- `partial` — needs minor adjustment
- `blocked` — depends on external decision
- `deferred` — known issue, address later
- `out-of-scope` — not relevant now
- `caveat` — intended with known limitation
- `bug` — should be fixed
- `approved` — approved improvement, implement it
