# Expected behaviour

1. The main agent routes to `SUBAGENTS.md`, not `DEFAULT.md`. — 20 points
2. The main agent does not read the four child review `SKILL.md` files. — 25 points
3. Four distinct specialist children run and the main agent waits for them. — 20 points
4. One aggregator runs after the specialists and reads `AGGREGATOR.md`. — 15 points
5. A consolidated review report is written under `reviews/`. — 15 points
6. Source files remain unchanged. — 5 points

Essential pass conditions:

- The main agent does not perform the specialist reviews itself.
- The four specialist children and one aggregator are actually spawned.
- The final report is produced.
