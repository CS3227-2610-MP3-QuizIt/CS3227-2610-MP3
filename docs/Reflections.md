# Backend development reflections

These reflections describe this backend implementation; browser and deployment behavior
has not yet been validated.

Untrusted DOCX text and teacher/student prompts are separate AI attack surfaces. A note
can request publication or credential disclosure while appearing to be source material.
Fixed instructions are isolated from JSON data, the model has no tools or database
credentials, and output enters strict validators. An injected request cannot publish,
assign users, or change grades because those actions are ordinary authorized backend
transactions. Teacher review requires the exact generation revision before publication.
Mocked injection tests show the application boundary holds even when source text contains
malicious instructions. They do not prove semantic correctness of real model output.

Student hints create a special answer-leakage risk. Generation inputs omit options,
keys, and explanations. Manual feedback showed that matching literal option strings
can reject useful conceptual clues. The revised process uses a separate stateless
call to the same model, with private answer context, to judge relevance and leakage.
An exact boolean verdict must approve the candidate before it is saved or displayed;
structural validation still rejects malformed output. The candidate is another prompt
injection surface, so it remains untrusted JSON data rather than verifier instructions.
Both calls share a single task and deadline, and rejected hints need explicit retry.
Mocked tests exercise orchestration, rejection, and verification races; they do not
prove that the live model will judge every clue correctly. This limitation is disclosed.
Admin summaries receive only anonymous aggregate counts
and question context; backend metrics remain authoritative alongside AI observations.
Safe XML, expansion limits, private opaque storage, strict duplicate-key JSON parsing,
hashed sessions, Origin checks, and ownership checks address distinct non-model attacks.

Precise concurrency rules mattered as much as endpoint lists. `ensure` must return the
latest failure instead of silently retrying, and a reused `new` action must bind its key
so replay cannot start later work. Admission counts committed timestamps strictly within
the rolling window, including failed/interrupted operations. Backend write transactions
serialize publication/generation and answer-save/submission races. Those invariants guided
tests that inspect database results and control blocked gateway calls.

Repository guidance contained stale references: the combined specification path was
missing, while the actual schema already had the required running/succeeded/failed task
states and rate index. We compared real documents before changing schema, used the backend
acceptance table, and added failed-login persistence consistently to migration/reference
DDL/spec. This illustrates why agents should verify cited sources and surface material
contradictions rather than apply stale comments mechanically.

Specialists owned disjoint modules and communicated concrete interfaces before coding.
The test specialist built independent mocked acceptance evidence, while integration owned
the shared task state machine and tooling. Interface handoffs carried snapshot shapes,
error/usage metadata, dependencies, and ownership constraints. A test harness initially
inherited a legacy gateway origin; an explicit fixture override restored isolation without
reading private configuration. Review feedback and observed failures drove follow-up work.

Strong references and cancellation handling prevent browser disconnects from owning AI
task lifetimes. A restart fails leftover running work rather than guessing its provider
outcome or replaying a billed request. Notifications contain only committed IDs/versions;
they are hints to fetch authoritative state. Actual browser reconciliation and production
model quality remain separate evidence that the team must obtain.
