# Security matrix

| ID | Boundary | Control owner / control | Verification | Evidence |
|---|---|---|---|---|
| SEC-OWN | Attempt reads | Backend checks student ownership | Another student is denied | Inspected attempts.py; execution pending |
| SEC-KEEP | Private hint verification | Backend keeps answer context private | Candidate cannot bypass verification | Historical entry; not part of this change |
