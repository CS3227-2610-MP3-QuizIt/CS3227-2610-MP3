# Verified production smoke-test interaction summary

Date: 2026-10-20 (SGT). Scope: manual production smoke testing of the deployed
Render application across Admin, Teacher, Student, and Admin completion/summary
workflows, including live AI question generation, hint recovery, and summary generation.
This summary records the user's supplied verified observations from the manual session.
Verification used Render service/branch/commit information and the application pages,
confirmations, errors, results, and completion metrics observed during that session.
Current source was checked separately for documentation consistency; this writing task
did not independently repeat the production workflow. No credentials, private environment
values, uploaded document contents, or unnecessary user data are recorded here.

Render contained two deployed services. The backend was reachable at
https://cs3227-2610-mp3-0uzv.onrender.com; visiting its root returned the application's
structured `NOT_FOUND` API response. Render showed the backend on `master`, with merged
commit `67c2bb9` automatically deployed. The frontend at
https://cs3227-2610-mp3-1-hxlp.onrender.com loaded its login page and communicated with
the deployed backend. The evidence establishes the backend commit, not a separate
frontend commit identity.

Admin login opened the Admin workspace. Overview showed seeded users/classes, and
Accounts, Classes, and Quiz performance loaded successfully. The admin created
Smoke Test Class and assigned exactly Teacher 1 and Student 01; the class showed
one teacher and one student. Teacher 1 then logged in and could see assigned classes.
Uploading `smoke-test-notes.docx` produced confirmation of 271 extracted text characters.
The teacher created Networking Smoke Test as a three-question draft. Live AI generation
succeeded, displaying three questions with four options each, marked correct answers,
and explanations. After review, the teacher published this quiz to **Class 1**, rather
than the one-student test class. The UI confirmed publication to ten students and that
the questions and roster were frozen.

Student 01 logged in, found Networking Smoke Test as not started, and started it. The
student requested a hint with “Give me a conceptual hint without revealing the correct
option.” The application rejected the returned content as invalid with `AI_INVALID_OUTPUT`
and withheld the failed hint rather than displaying it. The evidence does not establish
the exact validation cause. An explicit retry using “Explain the concept I should think
about, without naming any option or protocol.” succeeded. The displayed hint provided
conceptual guidance without explicitly naming the correct protocol or option. The student
completed and submitted the quiz; results showed `3 / 3` and `100.00%`.

Returning as Admin, the tester opened Quiz performance for Networking Smoke Test. It
showed `1 / 10 submitted`, nine not started, and **Awaiting submissions**. AI summary
generation was correctly unavailable because the frozen publication roster was incomplete.

The subsequent one-student summary scenario used Smoke Test Class with only Teacher 1
and Student 01. The teacher created and published Admin Summary Smoke Test to that class,
and the UI confirmed publication to exactly one student. Student 01 completed and
submitted it. Admin Quiz performance then showed `1 / 1 submitted` and **Ready for insights**.
Live AI class-performance summary generation succeeded. Exact metrics were average
score `3.00 / 3`, average percentage `100.00%`, score range `3–3 / 3`, and submitted
roster `1 / 1`. AI observations described aggregate performance and explicitly noted
that the data represented only one submission. The question breakdown showed 100%
correct for all three questions.

These results verify the observed happy paths, one invalid-hint rejection and successful
explicit recovery, and both incomplete/full-roster summary gates. They do not establish
all AI failure causes, universal hint safety, future output quality, or unexercised
timeout, restart, concurrency, browser, persistence, or recovery behavior. This was a
manual production check, not an automated test-suite run. No source code or Render
configuration was changed during the smoke test, and no manual deployment was triggered.
No production database edits occurred outside normal application actions through the UI.
No external messages were sent, and no secrets or private environment values were inspected.
