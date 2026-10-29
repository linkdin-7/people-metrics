# AI workflow

## Tools

- Claude Code (VS Code extension), models Claude Sonnet 5.5 and Claude Opus 5.5, used for planning, test and code generation, and review.

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

Evidence from the chat history: 44 test runs reported failures before the fix went in. The backend suite passes (274 tests, re-run when this was written). The last recorded frontend run passed (99 tests).

## Decisions and corrections

Only significant moments are recorded here, not every prompt: decisions that changed the AI's proposal, AI mistakes and their corrections, and verification steps that caught a problem.

This section was written after the build, from the saved chat history. It is in a new commit because the earlier planning commits were squashed into two before the first push, so the history does not show it. The prompts are highlights, shortened and reworded for clarity. They are not the full prompts.

| Topic | Prompts (highlights) | What the AI suggested or decided | Where I corrected it, and the result |
|---|---|---|---|
| Stack | *Use Python Django for the backend and React or Next.js for the frontend. Which is better, and which gives a good UI feel?*<br>*Why not use Postgres? Use that as the database.*<br>*Use shadcn/ui because we want good customization, but it's your call.* | FastAPI with SQLite and Mantine, and React with Vite rather than Next.js. | Django instead of FastAPI, Postgres everywhere instead of SQLite, shadcn/ui instead of Mantine. I kept the AI's advice on React with Vite. In `backend/` and `frontend/` (`270cd13`, `84d2e98`). |
| Countries | *Why not support all countries? Support all countries using a standard country list rather than limiting the application to eight.* | About 8 countries. | All ISO countries accepted from a static list. The AI added that only 15 to 20 would be seeded and that there would be no USD-converted total, because static rates would be stale (`270cd13`). |
| Ask a Question | *Include a feature where HR can ask questions in plain English and get quick, accurate answers from the employee database. Keep it simple and reliable.*<br>*Why use only the database instead of an LLM?*<br>*Use a single question and answer so it's simple, and don't use an LLM, only the database.* | An LLM that turns the question into a JSON query, with the database computing the answer. | No LLM. The AI redesigned it as a rules-based parser, `ask_parser.py` and `ask.py` (`45377fd`, screen in `bbf8a65`). |
| Navigation | *A left sidebar with four tabs. The Ask section should answer supported questions directly from database queries without an LLM.*<br>*Name the tabs for an HR user.*<br>*Don't say Salary Insights, just say Insights.* | Proposed Salary Insights and Ask a Question as the tab names. | I shortened Salary Insights to Insights. Final names: Dashboard, Employees, Insights, Ask a Question (`867f5bd`). |
| Data model | *Why are we using so many models, like countries, departments and job titles? Does it make sense? Read the brief again completely, then decide.*<br>*Use a separate Department model with unique, normalized names and an Employee foreign key. Support countries using a static ISO 3166 alpha-2 JSON list, with validation and no runtime API dependency. Store currency explicitly per employee and exclude cross-currency salary aggregation from the MVP.* | Three lookup tables, then one flat table. It had derived currency from the country. | Department model only. Currency stored on each employee, and salary figures are never mixed across currencies (`270cd13`, `991e236`). |
| Code style | *Don't create so many small files like normalization and validator, it's confusing, and the same for test files. Squeeze small code into one file.*<br>*Write plain numbers, the underscore is confusing. Keep it simple.* | Many small files and numbers written like `95_000`. | Validators merged into `models.py`, one model test file, plain numbers (`270cd13`, `a3a59af`). |
| Error format | *Why is ERROR_CODES defined like this?*<br>*Is a custom structured error format really needed here?* | A custom `{code, message, details}` format with a lookup table and 422 for validation. | The AI agreed it was too heavy. Now DRF's standard errors plus 409 for duplicates (`4dcaf07`). |
| URL layout | *I want the URLs to look uniform, so it's clear and we can explain it when asked.* | Keep them as separate lines, then a router viewset. | Grouped under `api/v1/insights/` with one `include` (`991e236`). |
| Basic auth | *How does basic auth differ from JWT?* | Shared basic auth from environment variables that fails closed, and explained how it differs from JWT. | Accepted. I kept the browser's own login box instead of building a login page (`ad344c5`, `029388b`). |
| Brand name | *You have read the brief, but the app shows People Metrics. I believe it should be ACME or something like that.* | Used the repository name as the app name. | Renamed to ACME Salary Management in the page, README, Swagger and login prompt (`84d2e98`). |
| UI direction | *I want an exceptional UI with smooth, eye-catching animations, engaging interactions and those little "wow" details that make it feel premium.*<br>*When I search for a country I still have to scroll to find it. Why are we using a small form instead of expanding it?* | A "calm financial clarity" direction: teal with one warm accent, a sliding sidebar highlight, a Ctrl+K command menu, light and dark themes, and respect for reduced motion. It said it could not judge animation by eye, so it checked layout with headless screenshots. | I judged the result in the running app. The country field became a searchable dropdown and the form was widened (`867f5bd`, `277b153`). |
| Seed and form | *Fix the seed problems as well.*<br>*The department dropdown isn't coming correctly.*<br>*First and last names accept "..", fix that. Country and currency are misaligned, and the form is too small.* | The seed drew from 900 name pairs, so names repeated about 11 times each. | Seed now deals 100 by 100 names without repeats. Wider form and a searchable department dropdown (`626d06d`, `277b153`). |
| Name rules | *Validate names properly: reject entries like "..", and require a sensible minimum length.*<br>*Review which characters names should allow.* | A minimum of 2 characters, so names like Ng and Li still work. Start with a letter, then letters, spaces, hyphens, apostrophes and full stops. | Adopted the refined rule after review. Enforced in the API and the form (`626d06d`). |
| Hire date | *Practically, can the hire date be in the past?*<br>*Past dates: keep the agreed rule. Today: allowed. Upcoming hire dates: allow up to one month or 15 days in the future.* | Options of past only, or up to 6 months ahead. | The AI chose 30 days ahead under my rule, with 1950 as the earliest date (`277b153`). |
| Delete | *Implement soft delete, the way real systems do it: remove the employee from the frontend but keep the record.* | Hard delete behind a confirmation was defensible for an MVP, with soft delete as a later improvement. | I instructed soft delete instead. Implemented with a hidden-by-default record, restore, and an Undo button (`7f0d7d5`). |
| Ask scope | *The Ask feature is getting too complex. Keep it simple: simplify the screen and the backend too.* | Keep the finished Ask backend and build only a small, plain screen. | I corrected this: the backend had to be simpler as well. The AI trimmed the parser, removing hire-year questions, currency symbols, lakh and crore units and typo detection. One rule replaced them: any word it does not understand is reported (`45377fd`, `bbf8a65`). |

Routine prompts such as "push", "next step" and commit-message wording are not recorded. The AI wrote most of the code, and this table shows where I directed or corrected it.
