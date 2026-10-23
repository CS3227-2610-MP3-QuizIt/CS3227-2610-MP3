# Web security baseline audit — 23 October 2026

## Status and scope

- Target: `/private/tmp/mp3-quiz-results`, branch `feat/quiz-results`, HEAD `06e060c`, including existing uncommitted diagnostics changes in `main.py`, backend specification and Developer Guide. Integrated release tree is represented on remote master by `10a1301`; pending diagnostics are **not deployed**.
- Overall: **FINDINGS**. This is a common-control baseline review, not exhaustive penetration testing or ASVS certification.
- Independent human review: **NOT READY for an unrestricted production-security assurance**. The public demo has explicit shared-account and deployment limitations. This does not determine assignment acceptance.
- Review only: no application, configuration, dependency, Git or deployment changes made by this audit. This report is the only repository artifact added.

## Research baseline

The [OWASP Top 10:2025](https://top10.owasp.org/2025/) supplies risk categories; [ASVS 5.0.0](https://asvs.owasp.org/) supplies a more detailed verification framework. This report groups common controls using those sources; it does not mark individual ASVS requirements compliant.

Specific references: [CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [HTTP security headers](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html), [password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [security logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

## Checks and evidence

| Check | Result and limits |
| --- | --- |
| Source/control review | Backend request middleware, authentication, core ownership/state controls, upload parser, AI/task boundaries, frontend rendering, Nginx, CI and security artifacts inspected. Not every endpoint/browser interleaving exhaustively exercised. |
| Fresh static scan | `sh workflow/security/semgrep.sh /private/tmp/mp3-web-security-semgrep.json`: Semgrep 1.170.0 OSS; 225 rules; 45 targets; zero findings; exit 0. Approximately 99.9% parsing, with `PartialParsing` warning at `backend/src/quiz_backend/ai.py:301`. Tracked source only; not dependency, infrastructure or runtime assurance. |
| Fresh dependency advisory check | `npm audit --json` in frontend: exit 0, zero known advisories, 186 total dependency entries reported. First sandbox request failed DNS; approved network retry succeeded. No fix/install/lock changes. Backend dependency vulnerability audit not executed: `pip-audit` unavailable. Container image vulnerability scan not executed. |
| Fresh live headers | Public frontend HTTPS GET returned HTTP 200. No Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security or Referrer-Policy in that response. |
| Origin runtime evidence | Earlier same-day live preflight echoed `https://mp3-audit-untrusted.example` with credentials allowed. Fresh repeat during this review returned 502 (`x-render-routing: no-deploy`), so it does not independently reconfirm the earlier CORS result or establish its cause. Exact Origin enforcement remains bypassable by wildcard in source. |
| Earlier same-day executed regression probes | Temporary `/private/tmp/mp3-feedback-audit/check.py` and results: nine cross-owner student/teacher requests denied without changing database tables or gateway-call count; seven ASCII/Unicode password boundary cases; more than 100 quizzes remain accessible. These are representative targeted checks, not a complete endpoint matrix. |
| Historical release CI | Integrated master CI previously recorded 175 backend tests, 198 frontend tests and advisory Semgrep passing. These runs predate pending diagnostics changes. Not rerun for this audit. |
| Historical live authentication | Earlier same-day admin/teacher/student login, identity, role workspace reads and logout passed. No fresh cookie-attribute inspection, live AI or destructive data actions during this audit. |
| Build/packaging | Not rerun; no product modifications in this audit. |
| Specification alignment | Wildcard production Origin mode and seeded demo accounts are documented choices. Hardening them requires coordinating behavior/specification/deployment decisions. |

## Common-control coverage

“Present” means an inspected control exists, with the stated evidence; it does not certify immunity to that attack class.

| Area | Assessment | Evidence / limitation |
| --- | --- | --- |
| Server authentication | Present | Backend session lookup; protected routes derive identity server-side, not from frontend role claims. |
| Roles and object ownership / IDOR | Present, representative tests | `auth.py`, `core.py` class/quiz/attempt guards; fresh denial/state-preservation probes. Complete endpoint-role-state matrix remains unverified. |
| Answer privacy | Present | Unsubmitted student views omit answer keys/explanations; results require owned submitted attempt. Hint verifier is an additional probabilistic boundary. |
| Password hashing | Present | `core.py` uses Argon2id with library-generated salts; no plaintext storage. OWASP recommends Argon2id. |
| Input bounds / mass assignment | Present | Strict request schemas reject extra fields, bound text/options/counts; upload and ordinary mutation body caps before parsing. |
| SQL injection | Present in inspected paths | Bound SQL parameters for user values; dynamic column/projection fragments inspected are internal constants. No comprehensive injection fuzzing. |
| XSS / unsafe HTML | Present in inspected paths | React text rendering; source search found no `dangerouslySetInnerHTML`, `innerHTML` or `eval(` in application source. No browser payload campaign; CSP absent. |
| Sessions | Present with gaps | Random 32-byte token, hash stored in DB, eight-hour absolute expiry, logout revocation; HttpOnly/SameSite=Lax and production Secure cookie configured. No idle timeout/periodic rotation identified; deployed flags not freshly inspected. |
| CSRF / CORS | Open configuration risk | Exact Origin mode exists; wildcard mode skips mutation Origin protection and reflects arbitrary origins with credentials. SameSite=Lax is useful but not proof of comprehensive CSRF prevention. |
| Authentication abuse | Partial | Five failures per username/IP pair per rolling window; distributed attempts/account rotation can evade a single pair's limit. No aggregate abuse stress test or proxy-IP verification. |
| Demo credential lifecycle | Deliberate demo risk | Fresh production databases seed documented shared accounts, including admin. No password-change/recovery API identified. Suitable only with explicit demo-data assumptions. |
| HTTPS / transport | Partial | Public HTTPS succeeds; gateway HTTP client verifies TLS; Nginx verifies upstream TLS. No live TLS protocol/cipher or HTTP-redirect audit; HSTS absent in observed page response. |
| Browser response headers / clickjacking | Gap | No observed framing restriction, CSP, nosniff or explicit referrer policy; Nginx contains none. Missing framing protection is actionable even without a demonstrated XSS injection. |
| Private response caching | Partial | Auth/error paths use no-store; proxy cache disabled. Successful private domain reads do not uniformly set no-store. No shared-cache leak demonstrated. |
| Uploads / XXE / ZIP traversal / expansion | Present | DOCX allowlist/structure validation, 5 MiB compressed/20 MiB expanded caps, member limits, traversal rejection, defused XML, no disk extraction or external fetching; private opaque stored names and restrictive permissions. No general antivirus/CDR. |
| SSRF / command execution / deserialization | Limited surface | Gateway base URL is operator configuration; no user-selected URL fetch, upload relationship retrieval, shell execution or pickle load found in application paths. No egress-network penetration test. |
| AI prompt/output trust | Present, partial assurance | Fixed feature routing, separated instructions/data, strict JSON validation, no AI authority to publish/grade, private hint verification and late-result state checks. Mocked tests cannot establish live semantic safety; correlated verifier mistakes remain possible. |
| Resource exhaustion / cost | Partial and spec constrained | Body/file bounds, AI rolling admission and 300-second timeout. No general global request/concurrency protection established. Course spec explicitly forbids adding queues/semaphores/per-user AI rate gates; preserve it when choosing mitigations. |
| Replay / races / business integrity | Present, representative tests | Transactions, frozen publication roster/content, deterministic immutable submission, idempotency/task eligibility and late-result checks. Not a general concurrency proof. |
| Secret handling | Present with verification limits | Backend-only provider secret; build-context exclusions and no tracked secret filenames found in inspected paths. No full Git-history secret scan or operator-account audit. |
| Exceptional conditions | Partial; local fix pending | Generic error envelopes protect raw provider/internal details; new reference-based unexpected-error diagnostics remain uncommitted/undeployed. No fresh automated exception-path test for that fix. |
| Security events / monitoring | Gap | Login failures stored for throttling; no complete structured security audit trail, admin-action monitoring, alerting or incident-retention policy identified. Error diagnostics alone do not satisfy this. |
| Dependencies / CI integrity | Partial | Lockfiles, SHA-pinned Actions, read-only workflow permissions, isolated pinned Semgrep; fresh npm advisory check clean. No backend/image audit or automated dependency-advisory job established; Semgrep advisory findings do not automatically fail CI. |
| Deployment / least privilege | Partial | Backend nonroot container, private storage permissions; full platform IAM, network isolation, proxy/IP trust and image posture unverified. Public API docs are not by themselves a proven vulnerability. |
| Backup / restore / retention | Unverified | No checked-in backup scheduler; actual production restore, at-rest encryption, deletion/retention and incident recovery not verified. Restart persistence is not the same as backup recovery. |

## Findings

### SB-web-001 — Production Origin policy can disable the existing browser mutation guard

- Severity: **Medium**, status **Open**; risk/configuration gap, not a demonstrated authenticated cross-site exploit.
- Location: `backend/src/quiz_backend/main.py:44-45,132-133`; `backend/src/quiz_backend/config.py` production origin validation; `workflow/security/security-matrix.md:78`.
- Evidence: wildcard bypass in source, earlier live arbitrary credentialed-origin preflight, explicit previously open matrix row. Fresh preflight currently failed with 502.
- Impact: removes an intended trust-boundary check; exposure depends on cookies/browser/site context and endpoint semantics. SameSite=Lax does not make wildcard CORS a generally safe production policy.
- Confidence: high for source behavior/earlier observation; current live policy unconfirmed by failed repeat.
- Follow-up: agree exact production frontend origins; configure them and prevent production wildcard unless explicitly accepted; coordinate approved specs. Verify allowed/disallowed/missing/null/duplicate Origins and actual deployed behavior, preserving state on denial. Do not claim the failed preflight passed.

### SB-web-002 — Public document lacks browser framing and content security protections

- Severity: **Medium**, status **Open**; hardening gap.
- Location: `frontend/nginx.conf` server block and observed public root response.
- Evidence: HTTP 200 response lacks CSP/frame-ancestors, X-Frame-Options and nosniff; HSTS/referrer policy also absent.
- Impact: no explicit browser framing barrier against clickjacking; fewer secondary controls against MIME confusion/injection. Missing CSP is not evidence an XSS sink exists.
- Confidence: high for this response and checked-in configuration.
- Follow-up: add suitable frame policy and nosniff; design/test CSP, referrer policy and HTTPS/HSTS at the correct deployment layer. Exercise SPA assets, API calls, fonts, routing and intended embeddings before rollout.

### SB-web-003 — Shared administrator access is unsuitable for confidential real use

- Severity: **High for real/private deployment**, status **Open**; intentional demo-account risk, not an assignment defect by itself.
- Location: `backend/src/quiz_backend/seed.py:12` and `main.py` startup seeding; documented demo accounts.
- Evidence: production seeding is enabled; known shared credentials; earlier live admin login succeeded; no password-change flow identified.
- Impact: anyone with demo credentials can exercise the documented role, so public demo data cannot be treated as private or trustworthy.
- Confidence: high.
- Follow-up: explicitly keep synthetic demo data; decide a separate provisioning/credential lifecycle before real use. Do not unilaterally remove grader/demo access.

### SB-web-004 — Security monitoring and recovery assurance are incomplete

- Severity: **Medium**, status **Open**; operational assurance gap.
- Location: `core.py` login throttling, `main.py` error handler, `docs/DeveloperGuide.md` deployment/recovery limitations.
- Evidence: no complete admin/auth-denial audit event stream or alert policy identified; production restore not exercised; new error references pending deployment.
- Impact: harder to detect/investigate abuse and establish recovery after data loss.
- Confidence: high for checked-in scope, limited for external platform operations.
- Follow-up: verify platform logs/backups/retention first, then choose minimal sanitized security events and alerting. Never log passwords, session tokens, prompts or raw provider bodies. Verify restore using an isolated copy.

## Were the security skills used?

Two relevant installed skills exist under `.agents/skills/`: `owasp-threat-modeling` and `security-boundary-review`. The planning skill routes security-sensitive planning through threat modeling; the code-review axis/profile routes changed security boundaries through the reviewer. This audit applied the latter.

Recorded evidence of earlier use includes `workflow/security/security-matrix.md`, UI-02's `security.md`, and UI-03/UI-06 `security-boundaries.md` reports. UI-06 explicitly records the named security specialist, checklist and scan; it also explicitly says Origin/CORS, uploads and deployment were unchanged and not re-audited. These are evidence of recorded workflow use, not independent proof of every claimed subagent/tool invocation. Full raw-trace verification was not performed here.

The matrix already left wildcard production Origin mode open. Some development-agent adversarial scenarios are marked planned, not executed. Routing-evaluation success does not establish resistance to hostile instructions or authenticity of worker evidence. Application security, coding-agent security, static scanning and deployment verification are distinct evidence categories.

## Next actions and handoff

- Implementation follow-up required: **YES**, after prioritizing/agreeing deployment-policy changes.
- Edit documentation: **AFTER CODE FIX** for changed policies; preserve current limitations until verified.
- Rerun code review: **AFTER FOLLOW-UP WORK**.
- Next responsible owner: maintainer/operator for production Origin, headers, demo-data policy, logs and backups; implementation agent for approved code/config/spec/tests.
- Recommended order: restore/confirm deployment health and exact Origin policy; browser frame/nosniff protections; finish and test pending safe diagnostics; decide monitoring and backup verification. Broader CSP/session/abuse/dependency controls can follow a scoped risk decision.
- Constraints: preserve existing uncommitted work; no provider calls, bulk/destructive security tests, dependency installs, Git changes or deployment changes from this audit. Do not violate the assignment's AI concurrency/admission restrictions.
- Verification: explicit Origin denial/state-preservation tests; fresh deployed preflight and response headers; browser regression smoke; targeted error-handler tests; backend/image advisory scan with existing approved tooling when available; isolated backup restore.
- Manual checks remaining: actual production cookie flags and browser CSRF/framing behavior, proxy/IP trust, production role workflow, platform IAM/logging/backup settings, real restore. New 502 requires operator/deployment investigation; a single response does not identify the cause.
- Success criteria: each accepted finding fixed and verified or explicitly accepted with scope/owner; no broad security PASS based solely on UI reviews or zero scanner matches.
