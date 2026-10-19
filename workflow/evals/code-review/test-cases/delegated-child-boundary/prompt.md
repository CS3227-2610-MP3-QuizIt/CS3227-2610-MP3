Use the $code-review skill with subagents. Review the product changes in
`fixture-base..fixture-target`, with `fixture-target` as the fixed revision,
against the assignment brief and tests. The later
`eval: prepare controlled workspace` commit contains harness inputs, not product
changes; exclude it from the review. Spawn the four specialist reviewers and
then one aggregator. Do not perform the specialist reviews in the main agent.
Write the canonical report under workflow/reviews/ and do not modify source files.
