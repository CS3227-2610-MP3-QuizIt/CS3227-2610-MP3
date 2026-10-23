# Project usage report: CS3227-2610-MP3

**Project root:** `.` · **Updated:** `2026-10-23T02:00:57.149284+00:00`

## Workload split (Real Project Work vs Harness Eval Calls)

| Workload | Root sessions / trials | Subagents | Judges | Turns | Uncached input | Cached input (hit %) | Billed output | Est. API cost |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Real Project Work** | 31 | 115 | 0 | 124 | 6,549,843 | 199,167,104 (96.8%) | 1,497,016 | $40.8686 |
| **Harness Eval Calls** | 68 | 99 | 206 | 274 | 9,424,919 | 42,700,416 (81.9%) | 662,782 | $3.2050 |
| **Combined Total** | 99 | 214 | 206 | 398 | 15,974,762 | 241,867,520 (93.8%) | 2,159,798 | $44.0737 |

> **Cost note:** `Est. API cost` is an API-equivalent estimate at public OpenAI list prices (as of 2026-10-12, platform.openai.com/pricing (API list prices, Standard tier, short+long context); long-context tier at 272,000 input tokens). It is not actual subscription or credit spend.

## 1. Real project work — Skill usage

| Skill | Installed in project | Sessions triggered | Explicit / Implicit | Uncached input | Cached input | Billed output | Est. cost |
|---|---|---:|---:|---:|---:|---:|---:|
| `code-review` | Yes | 31 | 29 / 2 | 6,549,843 | 199,167,104 | 1,497,016 | $40.8686 |
| `code-quality-review` | Yes | 22 | 1 / 21 | 6,382,198 | 198,088,192 | 1,460,253 | $40.7694 |
| `security-boundary-review` | Yes | 22 | 1 / 21 | 6,382,198 | 198,088,192 | 1,460,253 | $40.7694 |
| `spec-contract-review` | Yes | 22 | 1 / 21 | 6,382,198 | 198,088,192 | 1,460,253 | $40.7694 |
| `verification-review` | Yes | 22 | 1 / 21 | 6,382,198 | 198,088,192 | 1,460,253 | $40.7694 |
| `commit` | Yes | 2 | 1 / 1 | 5,251,967 | 186,551,168 | 1,280,369 | $39.8993 |
| `implement` | Yes | 2 | 2 / 0 | 5,251,967 | 186,551,168 | 1,280,369 | $39.8993 |
| `implement-task` | Yes | 2 | 0 / 2 | 5,251,967 | 186,551,168 | 1,280,369 | $39.8993 |
| `logging` | Yes | 2 | 0 / 2 | 5,251,967 | 186,551,168 | 1,280,369 | $39.8993 |
| `vercel-react-best-practices` | Yes | 2 | 0 / 2 | 5,251,967 | 186,551,168 | 1,280,369 | $39.8993 |
| `owasp-threat-modeling` | Yes | 1 | 0 / 1 | 1,785,445 | 66,020,224 | 461,439 | $1.9874 |
| `plan-task` | Yes | 1 | 0 / 1 | 3,466,522 | 120,530,944 | 818,930 | $37.9120 |
| `python-general` | Yes | 0 | 0 / 0 | 0 | 0 | 0 | $0.0000 |
| `web-design-guidelines` | Yes | 0 | 0 / 0 | 0 | 0 | 0 | $0.0000 |

## 1b. Real project work — Subagent usage

| Agent role | Configured in `.codex/agents` | Spawns | Sessions used | Commands (failed) | Uncached input | Cached input | Billed output | Est. cost |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `default` | Built-in / ad-hoc | 35 | 7 | 161 (0) | 283,828 | 3,492,736 | 75,292 | $0.2170 |
| `code_quality_reviewer` | Yes | 15 | 6 | 120 (0) | 456,372 | 3,153,536 | 46,115 | $0.8633 |
| `security_boundary_reviewer` | Yes | 15 | 6 | 138 (0) | 499,890 | 4,788,224 | 50,407 | $1.1291 |
| `spec_contract_reviewer` | Yes | 15 | 6 | 124 (0) | 459,683 | 3,604,992 | 50,698 | $1.0494 |
| `verification_reviewer` | Yes | 15 | 6 | 144 (0) | 592,728 | 6,908,672 | 64,262 | $2.2366 |
| `review_aggregator` | Yes | 13 | 6 | 62 (0) | 252,644 | 1,125,632 | 44,315 | $0.2176 |
| `task_implementer` | Yes | 7 | 2 | 295 (0) | 964,872 | 47,816,192 | 260,712 | $4.5967 |

## 1c. Real project work — Recent sessions

| Started | Thread ID | Model (effort) | Turns | Skills | Subagents | Billed output | Est. cost | First prompt |
|---|---|---|---:|---|---:|---:|---:|---|
| `2026-10-22T03:35:11` | `01a161ad-545` | `gpt-6.1-sol (high)` | 65 | `code-quality-review`, `code-review`, `commit`, `implement`, `implement-task`, `logging`, `plan-task`, `security-boundary-review`, `spec-contract-review`, `vercel-react-best-practices`, `verification-review` | 45 | 818,930 | $37.9120 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-22T00:01:36` | `01a160e9-c2c` | `gpt-6-luna (medium)` | 30 | `code-quality-review`, `code-review`, `commit`, `implement`, `implement-task`, `logging`, `owasp-threat-modeling`, `security-boundary-review`, `spec-contract-review`, `vercel-react-best-practices`, `verification-review` | 15 | 461,439 | $1.9874 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-19T05:50:55` | `01a152b6-7d5` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 0 | 4,264 | $0.0178 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-19T05:48:58` | `01a152b4-bc6` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 0 | 3,612 | $0.0147 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-19T05:47:08` | `01a152b3-046` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 0 | 3,920 | $0.0148 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-19T05:43:58` | `01a152b0-1c0` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 5 | 10,788 | $0.0577 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-19T05:40:46` | `01a152ad-3ad` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 5 | 10,837 | $0.0536 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-19T05:37:39` | `01a152aa-529` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 5 | 11,239 | $0.0652 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-19T04:39:47` | `01a15275-5bc` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 5 | 12,286 | $0.0722 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-19T02:30:40` | `01a151ff-2d0` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 0 | 4,571 | $0.0124 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-19T02:28:50` | `01a151fd-7c9` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 0 | 4,211 | $0.0160 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-19T02:26:58` | `01a151fb-c64` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 0 | 3,650 | $0.0117 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-19T02:22:48` | `01a151f7-fc0` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 5 | 15,987 | $0.0918 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-19T01:49:26` | `01a151d9-6da` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 0 | 4,243 | $0.0138 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-19T01:47:42` | `01a151d7-cad` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 0 | 3,840 | $0.0123 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-19T01:46:02` | `01a151d6-529` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 0 | 3,459 | $0.0144 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-19T01:42:03` | `01a151d2-a27` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 5 | 14,621 | $0.0649 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-19T01:38:28` | `01a151cf-5b2` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 5 | 13,259 | $0.0748 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-18T11:23:35` | `01a14ec0-b6f` | `gpt-5.6-luna (low)` | 1 | `code-review` | 0 | 3,391 | $0.0083 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-18T11:20:56` | `01a14ebe-4af` | `gpt-5.6-luna (low)` | 1 | `code-review` | 0 | 4,150 | $0.0117 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-18T11:18:38` | `01a14ebc-31d` | `gpt-5.6-luna (low)` | 1 | `code-review` | 0 | 4,218 | $0.0098 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-18T11:15:12` | `01a14eb9-0c9` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 5 | 13,476 | $0.0660 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-18T10:54:15` | `01a14ea5-dcf` | `gpt-5.6-luna (low)` | 1 | `code-review` | 0 | 4,188 | $0.0109 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-18T10:52:05` | `01a14ea3-e3d` | `gpt-5.6-luna (low)` | 1 | `code-review` | 0 | 4,346 | $0.0128 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-18T10:50:15` | `01a14ea2-331` | `gpt-5.6-luna (low)` | 1 | `code-review` | 0 | 3,335 | $0.0102 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-18T10:46:44` | `01a14e9e-f95` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 5 | 13,729 | $0.0618 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-18T10:42:10` | `01a14e9a-ca9` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 5 | 15,030 | $0.0752 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-17T16:37:57` | `01a14aba-222` | `gpt-5.6-luna (low)` | 1 | `code-review` | 0 | 4,344 | $0.0110 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-17T16:35:07` | `01a14ab7-8ec` | `gpt-5.6-luna (low)` | 1 | `code-review` | 0 | 3,790 | $0.0121 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-17T16:32:14` | `01a14ab4-ebf` | `gpt-5.6-luna (low)` | 1 | `code-review` | 0 | 5,001 | $0.0124 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |
| `2026-10-17T16:28:01` | `01a14ab1-148` | `gpt-5.6-luna (low)` | 1 | `code-quality-review`, `code-review`, `security-boundary-review`, `spec-contract-review`, `verification-review` | 5 | 12,862 | $0.0591 | # AGENTS.md instructions for /Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-M |

## 2. Harness eval calls (`eval.py run` workers, eval subagents & semantic judges)

| Evaluated skill | Experiments | Worker trials (`with-skill` / `baseline`) | Eval subagents | Semantic judges | Worker billed out | Judge billed out | Worker cost | Judge cost | Total eval cost |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `code-review` | 6 | 31 (31 / 0) | 88 | 93 | 213,527 | 183,308 | $1.1104 | $1.2098 | $2.3202 |
| `implement` | 2 | 15 (15 / 0) | 11 | 45 | 37,298 | 95,467 | $0.1282 | $0.3309 | $0.4591 |
| `plan-task` | 2 | 13 (13 / 0) | 0 | 25 | 23,159 | 5,841 | $0.0616 | $0.0251 | $0.0867 |
| `implement-task` | 2 | 9 (9 / 0) | 0 | 43 | 32,266 | 71,916 | $0.0928 | $0.2462 | $0.3390 |
