# Key trade-offs

## Data model

| Decision | Alternative | Why | Cost or limit |
|---|---|---|---|
| `Department` is its own model with a unique, normalized name; `Employee` references it by foreign key | Free-text department on the employee | One spelling per department, so groupings never split. Renaming is one row. Deleting a department that has employees is blocked. | An extra table and join. Departments need a way to be created (`POST /departments`). Rename and delete are not in the MVP. |
| `job_title` stays a plain text column | A `JobTitle` model | The brief does not need it, and titles change more often than departments. A model would add more tables than the problem justifies. | Spelling variants can split a group. The form suggests existing titles to reduce this. Promoting it to a model later is a straightforward migration. |
| Country is an ISO 3166 alpha-2 code on the employee, validated against `employees/data/countries.json` | A `countries` table, or a runtime API such as REST Countries | No network dependency, no outage or rate-limit risk, no seed or migration step, and the file is reviewable in git. | No database-level foreign key; validation lives in code. The file must be regenerated to pick up ISO changes. |
| Currency is stored explicitly on each employee, defaulting to the country's currency | Derive currency from the country on every read | Pay is not always in the country's currency (relocations, contractors), and the figure stays correct if a country changes currency. | One more field to validate and keep consistent. A country can contain several currencies, so aggregates cannot be keyed by country alone. |
| Salary is a positive integer in whole units of the employee's currency | Decimal with minor units | Exact arithmetic with no floating-point error, and annual salaries are quoted in whole units. | Cents are not stored. Revisit if the data ever needs them. |

## Currency

| Decision | Alternative | Why | Cost or limit |
|---|---|---|---|
| Salary aggregates are always split by currency and never mixed | Convert everything to one currency with exchange rates | Averaging across currencies gives a meaningless number. Conversion needs a rate source, a date policy and a decision about whose rate is right. | No single org-wide salary figure. Headcount is unaffected. |

## Countries without a clear single currency

The ISO 3166 list includes territories, and a few have no single clear currency (Antarctica has none). These are included as they appear in the source data, flagged in the file, and never given a guessed currency. Entries with no currency can still be chosen, and the employee's currency must then be supplied explicitly.

## Architecture

| Decision | Alternative | Why | Cost or limit |
|---|---|---|---|
| PostgreSQL | SQLite | Persistent data when deployed, one engine for development, tests and production, and `percentile_cont` for exact medians. | Needs a running database. Reviewers can use the optional `docker-compose.yml`. |
| Aggregations run in the database | Aggregate in Python or the browser | Exact, fast on 10,000 rows, and one tested code path for the dashboard, Insights and Ask a Question. | Median needs a small custom aggregate on Postgres. |
| Django serves the built React app | Separate frontend host | One origin and one login prompt, no CORS, a single deployment. | The frontend is rebuilt as part of the backend deploy. |
| Shared basic auth from environment variables, failing closed | Full user accounts | One persona. Keeps salary data off an open URL without building an auth system. | Not real authentication. Listed as roadmap. |
| Ask a Question uses a rules-based parser over the database | An LLM that interprets the question | Deterministic, exact and testable, with no external dependency or secrets. | Only a defined set of question patterns is understood. Unsupported questions get examples instead of a guess. |

## Performance

- Lists are always paginated on the server, and filtered and sorted columns are indexed: department, country, currency, salary and name.
- Aggregates are computed in the database, and the browser only receives the results.
- The seed inserts in batches and is timed against the 10,000-row target.
- Target: list and insight responses well under 500 ms at 10,000 rows. This is measured and recorded here once the endpoints exist.
