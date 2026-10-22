# UI-03 200% browser geometry follow-up — run 006

Date: 2026-10-22

## Status

**IMPLEMENTED — the remaining 200% rendered-geometry evidence gap is closed.** This was a verification-only follow-up; no product source, tests, specification, or user guide changed.

## Target and workspace

- Brief: [ui-03-organize-my-quizzes](../tasks/ui-03-organize-my-quizzes.md)
- Baseline HEAD: `b683612e13e21cb7bdad18dea9df94e15ce0c8d7`
- The source diff target is unchanged from run-005: tracked diff SHA-256 `dd66c070b65971eeb8dc1321d3941808ff4fb3addcf42b089a6e19b4a4ff4f43`; untracked `frontend/src/student/quizListPreferences.ts` SHA-256 `2c72fb3f7667337859a3c6360788714f64ce4688c4bd9112a4365b7c26946d7a`.
- This record is the only new workspace file. Existing implementation, review, evaluation and plan artifacts were preserved.
- `git diff --check` from the repository root passed (exit 0).

## Fixture and isolation

Recreated `/private/tmp/ui03-browser-fixture` from `frontend/`, linked the existing frontend dependencies, and served it with Vite at `127.0.0.1:5178`. A temporary fixture-only service worker returned fixed local API responses for a synthetic student and the same five quiz shapes used in run-005: an in-progress item, not-started items, duplicate class names under different IDs, submitted zero score, submitted null score, and long titles. All `/api/v1/*` requests were intercepted locally. No backend, database, or AI provider was contacted.

The tested page was the agent-created fixture tab, not the user's signed-in `localhost:5173` application. Chrome responsive/device emulation was turned off before measuring. Chrome's page zoom control visibly reported **200%**. With DevTools undocked so it did not narrow the page viewport, the target page reported `innerWidth=756`, consistent with the default window at 200% zoom. After capture, page zoom was reset to 100%, the fixture tab was closed, the Vite server was stopped, and the temporary fixture directory was removed.

## Exact rendered measurements

Read-only DevTools console expressions evaluated `getBoundingClientRect()` on the rendered page. At the confirmed 200% browser zoom:

- `innerWidth`: **756 CSS px**
- `document.documentElement.scrollWidth`: **756 CSS px** — no horizontal document overflow
- `devicePixelRatio`: **4**
- Refresh quizzes: **105.52 × 44 CSS px**
- Sign out: **44 × 44 CSS px**
- Five cards rendered in one column at this effective viewport width. Each action was **44 CSS px high**. The card rectangle is listed as `[top, bottom, width, action bottom, action height, title height, title scroll height]`, rounded to the nearest pixel except exact action height:

| Fixture card | Bounds `[top, bottom, width, action bottom, action height, title height, title scroll height]` |
| --- | --- |
| In-progress long title | `[407, 622, 486, 597, 44, 50, 50]` |
| Submitted long title, score 0 | `[642, 916, 486, 891, 44, 76, 76]` |
| Submitted title, score unavailable | `[936, 1160, 486, 1135, 44, 25, 25]` |
| Not-started title | `[1180, 1371, 486, 1346, 44, 25, 25]` |
| Not-started long title | `[1391, 1632, 486, 1607, 44, 76, 76]` |

Every title's `scrollHeight` matched its rendered height, so none was clipped. The 756px viewport wrapped the cards to one column; the three-column, two-row action-bottom equality was measured at 1280 CSS px in run-005 (row-one actions at 704.78px; row-two actions at approximately 1016px). Run-005 also records 320px and 390px results. Together, the follow-ups cover the requested desktop/intermediate/narrow/200% rendered geometry.

## Evidence and limitations

The exact console output for the viewport/control check was:

```json
{"w":756,"sw":756,"dpr":4,"heights":[44,44,44,44,44]}
```

The exact compact card output was:

```json
{"w":756,"sw":756,"dpr":4,"cards":[[407,622,486,597,44,50,50],[642,916,486,891,44,76,76],[936,1160,486,1135,44,25,25],[1180,1371,486,1346,44,25,25],[1391,1632,486,1607,44,76,76]]}
```

Chrome's toolbar displayed `Zoom: 200%` while the measurements were captured; responsive emulation showed `Value: 0` (off). No screenshot file was persisted; the measurements above are the browser-produced evidence. The fixture's stubbed SSE request returned JSON and emitted a MIME warning in DevTools; this did not affect the rendered collection. No application test/build was rerun because no product code changed.

## Acceptance follow-up

This closes the remaining run-005 gap: the nonempty fixture's card and action bounds, target heights, title wrapping, and document overflow were measured at 200% browser zoom using the full default page viewport without responsive emulation. No implementation finding was discovered; `VR-ui03-01` remains Fixed. No commit or push was made.
