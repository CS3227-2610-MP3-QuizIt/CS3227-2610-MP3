Use the $code-review skill in single-agent mode. Do not spawn subagents.
Review the product changes in `fixture-base..fixture-target`, with
`fixture-target` as the fixed revision, against the assignment brief and tests.
The later `eval: prepare controlled workspace` commit contains harness inputs,
not product changes; exclude it from the review. Write the canonical report
under reviews/ and do not modify source files.
