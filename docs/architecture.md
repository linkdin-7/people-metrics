# Architecture

Diagrams are written in Mermaid, which GitHub draws automatically.

## 1. The system

One Django application serves both the React app and the API, and everything sits behind one login.

```mermaid
flowchart LR
    user([HR Manager]) --> auth
    subgraph app[Django application]
        auth[Basic auth<br/>credentials from environment] --> spa[React app<br/>built static files]
        auth --> api[REST API<br/>/api/v1]
        api --> crud[Employees and<br/>departments]
        api --> insights[Insights queries<br/>median, average, distribution]
        api --> ask[Ask a Question<br/>rules parser]
        ask --> insights
    end
    crud --> db[(PostgreSQL)]
    insights --> db
    seed[[seed command<br/>10,000 synthetic employees]] --> db
```

Django serves the built React app once deployed. In local development the Vite dev server runs the React app and proxies `/api` to Django, and auth is off.

## 2. A request, from login to data

The browser shows its own login box once, then sends the login with every request automatically.

```mermaid
sequenceDiagram
    participant B as Browser
    participant D as Django
    participant P as PostgreSQL
    B->>D: open the site
    D-->>B: 401, please log in
    B->>D: same request with username and password
    D-->>B: React app
    B->>D: GET /api/v1/employees?country=IN
    D->>D: check the login
    D->>P: query with filters, 25 per page
    P-->>D: rows
    D-->>B: JSON
```

## 3. How a question is answered

Fixed rules turn the question into a small query, and the database calculates the answer.

```mermaid
flowchart LR
    q[Question] --> parser[Parser<br/>removes the words it understands]
    parser -->|understood| run[Run the query<br/>same code as Insights]
    parser -->|unclear or unknown word| help[Clarification<br/>with suggestions]
    parser -->|not about pay or headcount| examples[Example questions]
    run --> db[(PostgreSQL)]
    db --> answer[Answer, table and<br/>how it was understood]
```

## 4. The data

Salary is a whole number in the employee's own currency, so figures are never mixed across currencies. Deleting sets `deleted_at` and the record is kept.

```mermaid
erDiagram
    DEPARTMENT ||--o{ EMPLOYEE : has
    DEPARTMENT {
        int id PK
        string name UK
    }
    EMPLOYEE {
        int id PK
        string first_name
        string last_name
        string email UK
        string job_title
        string country
        string currency
        int annual_salary
        date hire_date
        datetime deleted_at
    }
```
