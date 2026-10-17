# Frontend CI setup

Date: 2026-10-17. Starting revision: `9163207` with existing review-skill and
commit-skill edits preserved.

## Request and changes

The user chose the smallest CI improvement first: automate the existing frontend
formatting, lint, test and build commands, leaving container/browser/deployment
checks for later. The agent added `.github/workflows/frontend.yml` and documented
its triggers, Node version and limitations in `docs/DeveloperGuide.md`.

The workflow runs on relevant pushes and pull requests, with a manual trigger.
It uses Node 24 to match the Docker build, `npm ci`, the four existing package
scripts, read-only repository permissions, and commit-pinned official actions.
Official tag references for checkout v7.0.1 and setup-node v7.1.0 were checked
against the GitHub API before choosing their pins. No application secrets,
deployment steps or live AI calls were added.

Reference: [GitHub's Node.js CI guide](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs).

## Observed local verification

Windows, Node v24.15.0, npm 11.12.1; commands run from `frontend/`.

| Check | Observed result |
| --- | --- |
| `npm ci --no-audit --no-fund --fetch-retries=0 --fetch-timeout=20000` | Passed; installed 122 packages. The lockfile hash was unchanged. |
| `npm run lint` | Exit 0, with seven existing React/hooks warnings. Warnings were not fixed or suppressed. |
| `npm test` | Initially blocked by sandbox `spawn EPERM`; rerun outside that sandbox passed 109 tests in 11 files. |
| `npm run build` | Initially blocked during Vite config loading; rerun outside that sandbox passed TypeScript compilation and Vite production bundling. |
| `npm run format:check` | Failed on 52 files in the Windows CRLF checkout. |
| Formatting diagnosis | `git ls-files --eol` showed LF in the index and CRLF in the working tree. The same check with `--end-of-line auto` passed; all 52 targeted files also passed the default Prettier rules after LF normalization in memory, without rewriting files. |
| New workflow YAML | Prettier parsed the file and its formatting check passed. |
| Tracked CI/documentation diff | Scoped `git diff --check` passed. |

The workflow retains the original `npm run format:check`; it does not relax the
formatting policy to accommodate this local checkout. No frontend source,
lockfile, formatter configuration or existing skill edits were changed.

## Limits

No GitHub Actions run, commit, push, branch-protection change, deployment,
browser end-to-end test or live AI check was performed. Local Windows results
and the LF-formatting diagnostic are not a completed Ubuntu CI run. The first
remote run still needs inspection after the changes are committed and pushed.
