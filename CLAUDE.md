# Project instructions

Salary management app for an HR Manager. Django, DRF and PostgreSQL backend; React, TypeScript and shadcn/ui frontend.
Read `docs/requirements.md` and `docs/plan.md` first. Do not add features outside the requirements.

## Coding standards

- Never start function, class, method or variable names with an underscore (language-mandated dunder names excepted).
- Descriptive names, type hints, standard naming conventions.
- Self-explanatory code, simple control flow, clear responsibilities.
- No comments unless necessary (one or two lines). No redundant docstrings.
- SOLID pragmatically; no overengineering.
- Validate inputs and handle errors explicitly.
- No secrets or environment-specific values in source. Configuration comes from environment variables.
- Tests are fast and deterministic. Never weaken a test to make it pass.

## Workflow

- Test first where practical. Small changes, meaningful commit each. Refactors in separate commits.
- Keep the suite green before every commit.
- Record AI use in `docs/ai/` (prompts, what was accepted or rejected, how it was verified).
- Never commit `.env` or real credentials. All data is synthetic.
- Never push without explicit instruction.
