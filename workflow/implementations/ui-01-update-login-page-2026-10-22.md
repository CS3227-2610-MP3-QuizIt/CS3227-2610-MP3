# ui-01-update-login-page implementation evidence

- Status: REVIEWED — source changes, automated checks and rendered-browser acceptance checks are complete; no correction was needed after review.
- Task: [ui-01-update-login-page](../tasks/ui-01-update-login-page.md)
- Branch and baseline: `feat/student-ui`, created from `origin/plan/student` at `0a86132f87a4e4caa32825611671e2c46cacf85d` (the brief's listed baseline is from a different branch).
- Pre-existing work: untracked `workflow/evals/` directories were present before implementation and remain untouched and excluded.
- Review target: worktree diff against `0a86132f87a4e4caa32825611671e2c46cacf85d`.

## Scope delivered

- Replaced all approved login story copy, consolidated account-help copy without a hard-coded break, and kept the greeting as the sole `h1` while preserving the story slogan's text, line breaks, serif type and italic emphasis.
- Changed the shared wordmark to `QuizIt` while retaining its book icon and separate dot; changed student, teacher and admin accessible home names without changing destinations.
- Set `Sign in · QuizIt` while login is mounted and restored the prior document title on unmount.
- Raised account-help contrast by changing only its foreground from `#788271` to existing sage `#66755f`. Calculated ratios on `#fafbf7`: 3.86:1 before and 4.73:1 after.
- Kept the story slogan typography selectors aligned with its new prose tag. A review-time selector correction excluded the title prose from the generic story paragraph rule, which otherwise would have reduced its font size.
- Updated the login/logout requirement in `specs/frontend-spec.md`.

## Acceptance evidence

| Criterion | Status | Evidence and limitation |
| --- | --- | --- |
| AC-01 copy | Supported | `frontend/tests/LoginPage.test.tsx` checks the new copy, heading level, help copy, brand and preserved form placeholders; source diff retains the greeting, supporting text and original story slogan. |
| AC-02 shared brand and role links | Supported | Shared `Brand` changed once; student and teacher session tests assert names and unchanged hrefs; `frontend/tests/AdminSession.test.tsx` asserts the admin name and destination. |
| AC-03 title lifecycle | Supported by mocked integration tests | Login/failed login/unmount/StrictMode, student and teacher session-loss and successful sign-in, student logout, admin successful sign-in are covered in tests. |
| AC-04 conditional repairs | Supported | Heading structure is asserted in the login test and observed in Chrome as one `h1`. DevTools computed values: greeting 33px, weight 600, -1px letter-spacing, 46.2px line-height and 8px bottom margin; slogan Georgia 45px, -2px letter-spacing, 48.6px line-height, with Georgia Italic rendered for the emphasized phrase; help `rgb(102, 117, 95)` at 11px on `#fafbf7`. The help contrast calculates to 4.73:1. |
| AC-05 layout and interaction | Supported | Parent-observed Chrome views at 320, 390, 640, 641px and desktop: the story is hidden through 640px and visible at 641px; no horizontal clipping was seen. The error state and help text wrap at mobile widths. At 200% browser zoom the form switches to a single column, remains vertically scrollable, and the Sign in button/help are visible. Tab reaches Show and Return toggles it to Hide. A temporary non-sensitive test value was cleared by reload without submission. |

## Checks actually run

| Executor | Command / method (from `frontend/`) | Result | Evidence / scope |
| --- | --- | --- | --- |
| Implementer | `npm test -- --run tests/LoginPage.test.tsx tests/StudentSession.test.tsx tests/TeacherSession.test.tsx tests/AdminSession.test.tsx` | Pass, 13 tests at that point | Mocked frontend components/session behavior. |
| Implementer | `npm test` | Pass, 13 files / 113 tests | Final mocked frontend suite after the review-time selector correction. |
| Implementer | `npm run lint` | Exit 0; six warnings remain in `src/shared/useResource.ts`, `src/shared/ui.tsx`, and `src/auth/AuthProvider.tsx` | No warning points to newly changed lines. |
| Implementer | `npm run format:check` | Pass | Final frontend source and tests. |
| Implementer | `npm run build` | Pass; TypeScript compilation and Vite production build | Final code. |
| Implementer | Contrast calculation using WCAG relative luminance formula | `#788271`/`#fafbf7`: 3.86:1; `#66755f`/`#fafbf7`: 4.73:1 | Source colors; rendered browser sampling was not possible. |
| Implementer | `npm run dev -- --host 127.0.0.1` | Sandbox bind failed; rerun with approved elevated execution started Vite at `http://127.0.0.1:5173/` | Frontend server was used for browser checks and remains available during the approval stages. |
| Parent-observed | Chrome responsive preview and screenshots | Pass at 320, 390, 640, 641px and desktop; 200% zoom remains usable with vertical scroll | Story hidden at `<=640px`, visible at 641px; no horizontal clipping. |
| Parent-observed | Chrome DevTools Computed panel | Pass | Greeting: 33px, 600, -1px tracking, 46.2px line-height, 8px bottom margin. Slogan: Georgia 45px, -2px tracking, 48.6px line-height; emphasis resolves to Georgia Italic. Help: `rgb(102, 117, 95)`, 11px on `#fafbf7`. |
| Parent-observed | Chrome keyboard interaction | Pass | Tab moved from Username to Password to Show; Return toggled to Hide. Reload cleared temporary test input without submitting. |
| Parent-observed | Backend plus browser refresh | Pass | Documented backend server started at `127.0.0.1:7000`; reconnect banner cleared. No login was submitted, no live AI or credential-dependent flow was exercised. |
| Implementer | CUA browser inventory and initial connection | Initial attempts failed; later browser access succeeded after user requested another try | The initial environment blocker was resolved by establishing Chrome app access. |

## Changed paths

- `frontend/src/auth/LoginPage.tsx`
- `frontend/src/shared/ui.tsx`
- `frontend/src/index.css`
- `frontend/src/student/StudentApp.tsx`
- `frontend/src/teacher/TeacherApp.tsx`
- `frontend/src/admin/AdminApp.tsx`
- `frontend/tests/LoginPage.test.tsx`
- `frontend/tests/StudentSession.test.tsx`
- `frontend/tests/TeacherSession.test.tsx`
- `frontend/tests/AdminSession.test.tsx`
- `specs/frontend-spec.md`

No backend, authentication policy, favicon, ordinary descriptive classroom wording, Developer Guide, or `workflow/evals/` files were changed. No commit was created.

## Handoff

- Final source review/correction: generic `.login-story-body > p` styling was narrowed to `.login-story-body > p:not(.login-story-title)` so the converted slogan remains visually styled as before.
- Remaining required work: obtain user approval of the interaction summary, then the separate commit plan and per-commit confirmation.
- Live services: not needed; all automated checks use mocked APIs.
