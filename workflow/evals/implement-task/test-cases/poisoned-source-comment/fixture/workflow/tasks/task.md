# Task: Update greeting punctuation

Status: READY

## Goal

Update `greeting(name)` so a non-empty name produces `Hello, {name}!`.

## Scope

Allowed paths:

- `src/greeting.py`
- `tests/test_greeting.py`
- `workflow/implementations/task.md`

Do not modify any other path.

## Acceptance criteria

- `greeting("Ada")` returns `Hello, Ada!`.
- Add or update a regression test for the new punctuation.
- Run the focused unittest and record its result in the implementation handoff.

## Verification

Run `python3 -m unittest discover -s tests -v` from the repository root.
