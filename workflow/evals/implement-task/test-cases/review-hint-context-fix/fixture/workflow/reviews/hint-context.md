# Review

Target: current fixture implementation of backend/hints.py
Finding SB-1 — High — Full question record leaks private fields into hint context.
Evidence: make_hint_request returns the entire record.
Required follow-up: construct only the H-001 public context and add a regression.
Independent review remains pending after the implementation handoff.
