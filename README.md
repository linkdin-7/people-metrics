# People Metrics

Salary management for an HR Manager: maintain employee salary data and understand how the organization pays its people from one web app.

All data in this project is synthetic.

## Status

Planning complete. Implementation in progress. See `docs/requirements.md` and `docs/plan.md`.

## Stack

Django and Django REST Framework, PostgreSQL, React with TypeScript, shadcn/ui.

## Configuration

Configuration comes from environment variables. Real values are never committed.
Copy `.env.example` to `.env` and fill it in once it exists. Variables: `SECRET_KEY`, `DATABASE_URL`, `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD`, `ALLOWED_HOSTS`, `DEBUG`.

## Documentation

- `docs/requirements.md`: one-page requirements
- `docs/plan.md`: architecture and implementation plan
- `docs/ai/`: how AI was used during development

Setup, seeding, tests and deployment instructions are added as each part is built.
