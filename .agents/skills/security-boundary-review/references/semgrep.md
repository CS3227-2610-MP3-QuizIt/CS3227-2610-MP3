# Semgrep security scan

Use the reviewed target and [configured scan](../../../../workflow/security/semgrep.md).
Inspect ONLY relevant setup, target paths and finding context.

1. Check CLI availability/version and the shared script's configured rules/scope.
   Missing configuration: `Not configured`. Missing executable, denied network
   or scanner failure: `Blocked`. Do not install or log in during review.
   Downloads of the script's configured Registry packs are part of scanning;
   respect runtime permissions and do not change packs during review.
2. Reuse supplied results only when target, rules/engine and coverage match.
   Otherwise run the shared command against current source. Honor its scope
   and exclusions for private data and generated files.
   Report the actual scanned/skipped paths, not assumed coverage.
3. Run from the repository root; keep output local:

   ```text
   sh workflow/security/semgrep.sh
   ```

   The script disables metrics/version checks and auto-fixes. Do NOT apply fixes,
   add suppressions, change rules/ignore files or upload findings. Redact sensitive
   finding text.
4. Inspect results and errors, not just exit status: a default scan may return
   zero with findings. Record parser failures, timeouts, exclusions and unsupported
   syntax as coverage limits. A failed/partial scan is not a clean result.
5. Trace relevant findings to inputs, enforcement and impact. Classify confirmed
   defects, false positives and unresolved risks with reasons. Separate introduced
   or worsened issues from unrelated pre-existing findings; route fixes out of review.

Record target, directory, command, CLI/engine version, rules/version, coverage,
exit result, findings and limitations in the security artifact or in-memory
findings. Verification review may consume this evidence without duplicating scans.
Zero matches means only no matches within the recorded coverage; it does not
prove ownership rules, runtime safety or agent injection resistance.

For CLI questions, consult the [official reference](https://docs.semgrep.dev/cli-reference).
