# Semgrep setup and baseline

Run from the repository root:

```sh
sh workflow/security/semgrep.sh
```

JSON goes to stdout; scanner diagnostics go to stderr. An optional local output
path saves JSON instead; relative output paths resolve from the repository root:

```sh
sh workflow/security/semgrep.sh /tmp/quizit-semgrep.json
```

The [script](semgrep.sh) defines rules and scope. No Semgrep account/token or
platform upload is used; findings remain local.

For local setup, use an isolated tool environment rather than backend dependencies:

```sh
uv tool install --python 3.13 semgrep==1.170.0
```

Installation is a setup action, not a review action. Record the actual local
version when sharing scan evidence.

## Policy and scope

- Existing community packs: [Python](https://semgrep.dev/p/python) and
  [TypeScript](https://semgrep.dev/p/typescript). No custom rules or suppressions.
- The script downloads these configured packs from the Semgrep Registry.
  Network permission is still required. Registry packs can change; the CLI pin
  does not freeze their contents. Record scan date, version and coverage, and
  do not claim byte-identical rules across runs without a retained snapshot.
- Source targets only: backend Python and frontend TypeScript/TSX under the
  script's two source roots. Semgrep's normal ignore/language filters still apply.
  Tests, dependency trees, credentials, private uploads and build outputs are
  outside the selected roots; this is not a dependency or whole-repository audit.
- Metrics/version checks and auto-fixes are disabled. JSON may contain source
  snippets; redact sensitive values before sharing reports.
- Initial mode is advisory: findings and coverage warnings require assessment,
  but do not automatically fail the scan command. Scanner execution/configuration failures
  retain their nonzero status. Exit zero means execution completed, not a
  security pass. Agree blocking rules after triage; do not suppress issues to
  obtain green checks.
- Reviewers reuse evidence only for matching source, rules/engine and coverage.
  A committed-source result does not cover later uncommitted changes. Unknown rule
  equivalence or coverage limits remain explicit; verification review does not
  duplicate the security reviewer's scan.

## Initial observed baseline — 18 October 2026 (SGT)

Source: `53005e0e2593a270cd3c7bd4dd24bc726cbf7d4d`, application source unchanged
in the worktree. Semgrep 1.170.0, OSS engine, the two packs and source roots above:

- 225 rules: 151 Python, 74 TypeScript.
- 42 source files scanned: 17 Python, 25 TypeScript/TSX.
- Zero findings; one `PartialParsing` warning at
  [`backend/src/quiz_backend/ai.py:301`](../../backend/src/quiz_backend/ai.py).
  The parser rejected the unparenthesized multi-exception handler used by this
  Python 3.14 project. The reported parsed-line coverage was approximately 99.9%.
- This is partial scanner coverage, not a clean security verdict. Preserve the
  application code; address scanner compatibility separately and retain manual
  review of the affected path.
- The first sandboxed version check failed during certificate-store initialization;
  the version check and baseline scan succeeded outside that sandbox. Do not
  disable TLS verification to work around environment failures.

The initial direct scan and the shared script produced the same finding/file
counts and parser warning. The script was also run from `/tmp` with an absolute
script/output path, verifying repository-root resolution.

Local JSON: `/tmp/quizit-semgrep.Psw7tx/baseline.json` and `configured.json` in
the same directory. These are not committed and may expire. Shell syntax,
invalid-argument/remote-output/missing-tool exits, local links and whitespace
checks passed. No application fixes or eval changes were made.

Method: [Semgrep local rules](https://docs.semgrep.dev/running-rules).
