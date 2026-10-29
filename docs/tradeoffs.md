# Key trade-offs

## Data model

| Decision | Alternative | Why | Cost or limit |
|---|---|---|---|
| `Department` is its own model with a unique, normalized name; `Employee` references it by foreign key | Free-text department on the employee | One spelling per department, so groupings never split. Renaming is one row. Deleting a department that has employees is blocked. | An extra table and join. Departments need a way to be created (`POST /departments`). Rename and delete are not in the MVP. |
| `job_title` stays a plain text column | A `JobTitle` model | The brief does not need it, and titles change more often than departments. A model would add more tables than the problem justifies. | Spelling variants can split a group. The form suggests existing titles to reduce this. Promoting it to a model later is a straightforward migration. |
| Country is an ISO 3166 alpha-2 code on the employee, validated against `employees/data/countries.json` | A `countries` table, or a runtime API such as REST Countries | No network dependency, no outage or rate-limit risk, no seed or migration step, and the file is reviewable in git. | No database-level foreign key; validation lives in code. The file must be regenerated to pick up ISO changes. |
| Currency is stored explicitly on each employee, defaulting to the country's currency | Derive currency from the country on every read | Pay is not always in the country's currency (relocations, contractors), and the figure stays correct if a country changes currency. | One more field to validate and keep consistent. A country can contain several currencies, so aggregates cannot be keyed by country alone. |
| Deleting is a soft delete: `deleted_at` is set and the default manager hides those rows everywhere | Hard delete that removes the row | HR records must survive mistakes and departures, deletes can be undone, and no query can forget the filter because it lives in the default manager. | Rows accumulate, uniqueness has to be scoped to active employees, and the seed reset uses a separate manager to wipe everything. |
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

## Ask a Question

- **Fixed rules.** A parser turns the question into a small structured query, and the database calculates the answer using the same code as the Insights page. The same question always gives the same number.
- **Nothing is guessed.** Words it doesn't understand are reported, with a "did you mean" when possible, never silently ignored. Salary rankings need one currency, so currencies are never mixed.
- **Cost:** only a small set of English patterns is understood (counts, median, average, lowest, highest, grouping, a few filters). Anything else gets examples.

## Performance

- Lists are always paginated on the server, and filtered and sorted columns are indexed: department, country, currency, salary and name.
- Aggregates are computed in the database, and the browser only receives the results.
- The seed inserts in batches of 1,000 inside one transaction. Measured on a development machine: 10,000 employees in about 2 seconds.
- Target: list and insight responses well under 500 ms at 10,000 rows.
- Measured on the seeded 10,000 rows (development machine, in-process, warm): employee list about 15 ms, name or email search about 40 ms, filters with sorting 10 to 15 ms, lookups about 6 ms. The first request after a process starts takes about 270 ms of one-off warm-up.
- Insights are computed in one grouped SQL query each, with the median as Postgres `percentile_cont`. On the seeded rows: summary about 14 ms, breakdown by country about 14 ms, by department about 20 ms, by job title about 26 ms. The database figures were cross-checked against an independent Python calculation for all 14 currencies. The salary histogram takes about 13 ms: the database returns the minimum and maximum, labels each employee with a bucket number and counts per bucket, so memory stays constant however large the table grows. The top-earners list takes about 6 ms, and both were cross-checked against Python. Distribution and earners need a single currency, because ranges and rankings across currencies would be meaningless.
- Name search uses a plain case-insensitive match, which scans the table. At 10,000 rows that is about 40 ms, so a trigram index is not needed yet. It would be the next step if the table grew by orders of magnitude.
