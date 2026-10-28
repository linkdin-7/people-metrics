# ACME Salary Management: Requirements

**Goal.** Give the HR Manager one web application to maintain salary data for about 10,000 employees across countries, and to understand how the organization pays its people without spreadsheets.

**User.** One HR Manager. They need fast lookup and editing, and aggregates they can trust.

## Scope: what we build

The app has a left sidebar with four tabs: **Dashboard, Employees, Insights, Ask a Question**.

1. **Employees.** Create, view, edit and delete employees (name, email, department, job title, country, annual salary and its currency, hire date). Each employee belongs to a department (a managed list of unique names). Any ISO 3166 country is accepted from a static list, and each employee stores their own currency, defaulting to the country's currency. Server-side pagination, search by name or email, filters (country, department, job title, salary range) and sorting.
2. **Dashboard.** The overview. Headcount KPIs, headcount by country and department, and salary KPIs (min, median, average, max) for one selected currency.
3. **Insights.** The detailed analysis. Pay breakdowns by country, department and job title (headcount, min, median, average, max), salary distribution, and highest and lowest paid. Filters for country and department. Salary figures are always split by currency and never mixed.
4. **Ask a Question.** The HR Manager types one plain-English question and gets one answer, for example "median salary of software engineers in Germany" or "top 5 job titles by average salary in the UK". A rules-based parser maps the question to a fixed set of supported query types, and the database computes the result. The screen shows how the question was interpreted. Unclear or unsupported questions get a clarification or example questions, never a guess.
5. **Seed data.** A repeatable script that creates 10,000 synthetic employees across 15 to 20 countries, with realistic headcount weights and salary ranges.
6. **Quality.** Input validation with clear errors, fast deterministic automated tests, a deployed instance and a demo video.

## Deliberately out of scope

| Left out | Reason |
|---|---|
| User accounts and roles | One persona. The deployed site uses one shared basic-auth login, with credentials in environment variables and never in the repo. |
| LLM or AI features in the product | Salary answers must be exact and repeatable, so the database computes every figure. Avoids an external dependency, cost and extra secrets. |
| Multi-turn chat, free-form SQL, edits by natural language | Not needed for the MVP. Single question and answer keeps it simple and reliable. |
| Currency conversion and cross-currency aggregation | Needs exchange rates and a policy. Salary figures stay in their own currency, so there are no meaningless cross-currency averages. |
| Downloadable or saved reports, Excel import and export | The seed covers initial data. Roadmap items. |
| Salary history, audit trail | Valuable next step, but it roughly doubles the data model. |
| Payroll, tax, bonuses, equity | The problem is base-salary visibility, not payroll. |

## Key decisions

- **Stack:** Django and Django REST Framework, PostgreSQL, React with TypeScript, shadcn/ui. Django serves the built UI, so there is one origin.
- **Salary storage:** a whole-currency-unit integer with a validated positive value, so no floating-point error, plus an explicit currency code on each employee.
- **Countries:** a committed static ISO 3166 alpha-2 JSON list, validated in code, with no runtime API dependency.
- **Aggregations:** computed in the database (Postgres `percentile_cont` for the median), never in the browser. Lists are always paginated.
- **Data:** all synthetic. Emails use the reserved `example.com` domain, and the seed is deterministic.
- **Secrets:** all configuration comes from environment variables. A `.env.example` holds placeholders only.

## Success criteria (targets)

- Find an employee and edit their salary in under 30 seconds.
- List and insight responses well under 500 ms at 10,000 rows.
- Core logic covered by fast, deterministic tests.

## Assumptions and open points
- The country list is the ISO standard. Territories without a clear single currency are noted in `docs/tradeoffs.md`.
- Basic auth is a stopgap for a single-user tool. Real authentication is on the roadmap.
