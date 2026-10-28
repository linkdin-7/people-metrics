# AI workflow

## Tools

- Claude Code (VS Code extension), model Claude Sonnet 5.5, used for planning, test and code generation, and review.

## How AI is used

| Stage | AI role | Human role |
|---|---|---|
| Planning | Extract requirements, propose options and trade-offs | Decide scope, stack and naming |
| Tests | Draft test cases from the requirements | Read every test; confirm it fails when the code is broken |
| Implementation | Generate code in small steps against the tests | Review the diff; reject or rewrite what does not fit the standards |
| Review | Check changes for bugs and simplification | Decide what to apply |

## Verification rules

- Every generated test is read before it is committed.
- A new test must be seen failing before the code that makes it pass.
- The full suite stays green before each commit.
- Generated code is checked against the standards in `CLAUDE.md`.

## Decisions and corrections

Only significant moments are recorded here, not every prompt: decisions that changed the AI's proposal, AI mistakes and their corrections, and verification steps that caught a problem.
