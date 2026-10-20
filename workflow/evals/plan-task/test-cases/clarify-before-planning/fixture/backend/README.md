# Attempt service

From `backend/`, run:
`python3 -B -m unittest discover -s . -p 'test_*.py'`.

The in-memory records are synthetic. Tests cover owner isolation, saved-answer
restoration and the pre-submission result boundary. No external service is used.
