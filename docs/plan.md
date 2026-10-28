# Architecture and implementation plan

## Architecture

Browser (React SPA) -> Django (DRF API, serves the built SPA via WhiteNoise, basic-auth middleware) -> PostgreSQL.

Backend layers per Django app: views (thin) -> services (rules) -> selectors (queries) -> models.
Apps: `employees` (Department and Employee models, country list) and `insights` (dashboard, insights, ask).

Countries come from a committed static file, `employees/data/countries.json` (ISO 3166-1 alpha-2 code, name, default currency). It is loaded once at start-up. There is no runtime API or database table for countries.

## Schema

```
departments(id PK, name)            -- name stored trimmed and whitespace-collapsed
                                    -- UNIQUE on lower(name)
employees(id PK, first_name, last_name,
          email,                    -- UNIQUE on lower(email)
          department_id FK PROTECT, job_title,
          country CHAR(2),          -- must exist in countries.json
          currency CHAR(3),         -- ISO 4217, stored per employee, must exist in countries.json
          annual_salary INTEGER CHECK > 0,   -- whole units of the employee's currency
          hire_date, created_at, updated_at)
```

Indexes: department_id, country, currency, annual_salary, (last_name, first_name).

`currency` defaults to the country's currency when omitted on create, and can be set explicitly, for example for someone paid in a different currency than their country's.

## API (/api/v1)

| Method | Path | Purpose |
|---|---|---|
| GET | `/employees` | List with pagination, search, filters and sorting |
| POST | `/employees` | Create an employee |
| GET | `/employees/{id}` | View one employee |
| PATCH | `/employees/{id}` | Edit part of an employee, for example only the salary |
| PUT | `/employees/{id}` | Edit by replacing all fields |
| DELETE | `/employees/{id}` | Delete an employee |
| GET | `/departments` | List departments |
| POST | `/departments` | Create a department; the name is normalized, a duplicate returns 409 |
| GET | `/lookups` | Countries with default currency, currencies, departments and distinct job titles for forms and filters |
| GET | `/insights/summary`, `/by-country`, `/by-department`, `/by-job-title`, `/distribution` | Aggregated pay figures, always split by currency |
| POST | `/insights/ask` | One question in, `{status, interpretation, answer, columns, rows, suggestions}` out |
| GET | `/health` | Health check, exempt from basic auth |

List parameters: `page`, `page_size`, `q`, `country`, `currency`, `department`, `job_title`, `min_salary`, `max_salary`, `sort`.

Errors use `{code, message, details}`: 422 validation, 404 missing, 409 duplicate email or department.

## Currency rule

Salary figures are never summed, averaged or compared across currencies. Every salary aggregate is grouped by currency, and a result for a single currency is labelled with it. Headcount is unaffected.

## Ask a Question

question -> rule-based parser -> query spec -> validate -> resolve names -> executor (shared with Insights) -> template answer and table.
Status is one of `answered`, `needs_clarification`, `unsupported`.
A salary question that would span several currencies is answered per currency.

## Frontend

Sidebar tabs: Dashboard, Employees, Insights, Ask a Question (`/dashboard`, `/employees`, `/insights`, `/ask`).
Structure: `src/api`, `src/features/{employees,dashboard,insights,ask}`, `src/components/ui` (shadcn), `src/hooks`, `src/types`.
The Dashboard salary figures are shown for one selected currency.

## Testing

Test first: write a failing test, make it pass, then refactor in a separate commit.
pytest-django on PostgreSQL (`--reuse-db`, transactional tests) and Vitest with React Testing Library.

Focused cases, in build order:

- Country list: every entry has an alpha-2 code and a currency, codes are unique, an unknown code is rejected.
- Department: name is trimmed and whitespace-collapsed, names differing only by case or spacing are duplicates, a department with employees cannot be deleted.
- Employee validation: salary must be positive, email is valid and unique ignoring case, country and currency must be in the list, currency defaults from the country, an explicit currency is kept.
- Employees API: create, view, partial and full edit, delete, 404 and 409 responses, pagination boundaries, filter combinations, stable sort.
- Seed: exact count, deterministic for a fixed seed, idempotent, every row valid.
- Insights: median for odd, even, single and empty sets, results always split by currency, never mixed.
- Ask a Question: parser table tests, entity resolution, the three statuses.
- Basic auth: fails closed when credentials are not configured, health check exempt.

## Phases

| # | Phase |
|---|---|
| 0 | Setup: repo, requirements, plan, standards, AI log, README |
| 1 | Django, PostgreSQL, Department and Employee models, countries file |
| 2 | Seed command and tests |
| 3 | Employees and departments API: create, view, edit, delete, search, filters, sort, pagination |
| 4 | Insights API |
| 5 | Basic-auth middleware and secrets hygiene |
| 6 | Frontend shell |
| 7 | Employees UI: table, filters, add and edit drawer, delete with confirmation |
| 8 | Dashboard and Insights UI |
| 9 | First deploy and smoke test |
| 10 | Ask a Question |
| 11 | Docs, redeploy, demo video |

Phases 0 to 9 give a deployed, working app before Ask a Question is added.

## Submission checklist

- Seeded 10k data live, and the smoke test passes on the deployed URL.
- README covers setup, seed, tests and deploy. Architecture diagram, trade-offs and performance notes are included.
- `docs/ai/` is complete. Demo video link is in the README.
- Git history scanned for secrets. No `.env` or credentials committed.
- Reply to the original email with the repo link. The deployed login is sent outside the repo.
