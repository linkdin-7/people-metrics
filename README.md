# ACME Salary Management

Salary management for an HR Manager: maintain employee salary data and understand how the organization pays its people from one web app.


## Status

The backend API, the React app (Dashboard, Employees, Insights and Ask a Question), the seed command and the automated tests are built. Deployment is the remaining step. See `docs/requirements.md` and `docs/plan.md`.

## Demo

[Demo video](https://drive.google.com/file/d/15Dm5R26qEq1runj909IvdA3yMgg1Nece/view?usp=sharing) of the application.

## Stack

Django and Django REST Framework, PostgreSQL, React with TypeScript, shadcn/ui.

## Configuration

Configuration comes from environment variables, read from `backend/.env`. Real values are never committed; `backend/.env.example` shows the variables:

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Django secret key, required, no default |
| `DEBUG` | `true` or `false`, defaults to `false`. Basic auth is enforced whenever it is `false`, so use `true` only for local development |
| `ALLOWED_HOSTS` | Comma-separated host names |
| `DATABASE_URL` | PostgreSQL connection URL |
| `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD` | Shared login for the deployed site. If auth is enforced and either is empty, every request is refused with 503 |

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
7. Start the API: `python manage.py runserver`. Interactive API docs (Swagger UI) are at `http://localhost:8000/api/docs`, and the OpenAPI schema at `http://localhost:8000/api/schema`.

The country list in `employees/data/countries.json` is committed. To regenerate it from the ISO data, run `python scripts/generate_countries.py`.

## Frontend setup

Requires Node.js (developed on Node 24). The dev server proxies `/api` and `/health` to the Django API on port 8000, so start the backend first.

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # type check and production build
```

## Documentation

- `docs/requirements.md`: one-page requirements
- `docs/plan.md`: architecture and implementation plan
- `docs/architecture.md`: diagrams of the system, a request, the Ask flow and the data
- `docs/tradeoffs.md`: key trade-offs and performance notes
- `docs/ai/AI_WORKFLOW.md`: how AI was used, with the key decisions and corrections

Deployment instructions are added once the app is deployed.
