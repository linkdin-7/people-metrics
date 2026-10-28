# People Metrics

Salary management for an HR Manager: maintain employee salary data and understand how the organization pays its people from one web app.


## Status

Implementation in progress. The Django project, country list and models are in place. See `docs/requirements.md` and `docs/plan.md`.

## Stack

Django and Django REST Framework, PostgreSQL, React with TypeScript, shadcn/ui.

## Configuration

Configuration comes from environment variables, read from `backend/.env`. Real values are never committed; `backend/.env.example` shows the variables:

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Django secret key, required, no default |
| `DEBUG` | `true` or `false`, defaults to `false` |
| `ALLOWED_HOSTS` | Comma-separated host names |
| `DATABASE_URL` | PostgreSQL connection URL |
| `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD` | Shared login for the deployed site, added with the auth phase |

## Backend setup

Requires Python 3.12 or newer and PostgreSQL (developed on Python 3.13 and PostgreSQL 17).

1. Create an empty PostgreSQL database, for example `people_metrics`. The database user must be allowed to create databases, because the tests create their own.
2. Install dependencies:
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate          # macOS and Linux: source .venv/bin/activate
   pip install -r requirements-dev.txt
   ```
3. Copy `.env.example` to `.env`, then set `SECRET_KEY` and `DATABASE_URL`.
4. Create the tables: `python manage.py migrate`
5. Seed 10,000 synthetic employees: `python manage.py seed_employees`. The data is fictional and deterministic. Options: `--count`, `--seed`, and `--reset` to replace existing employees (without it, the command refuses to run on a non-empty table).
6. Run the tests: `pytest`

The country list in `employees/data/countries.json` is committed. To regenerate it from the ISO data, run `python scripts/generate_countries.py`.

## Documentation

- `docs/requirements.md`: one-page requirements
- `docs/plan.md`: architecture and implementation plan
- `docs/ai/`: how AI was used during development

Seeding, frontend and deployment instructions are added as each part is built.
