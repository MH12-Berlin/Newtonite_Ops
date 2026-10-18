# Newtonite Ops

Newtonite Ops is a team-based work management app. It gives teams one place to create and manage work items, update their status, leave comments, and review what has changed over time.

The frontend and backend run locally, and the automated tests have been passing in the development environment. Before calling the app production-ready, it still needs a deployment check and a final end-to-end test in a browser.

## What it can do

- Sign users in with JWT-based authentication.
- Keep work items scoped to the user's team and role.
- Create work items with a title, description, team, assignee, priority, and required due date.
- Search, filter, and paginate work items.
- Flag possible duplicates and let the user decide whether to continue creating the item.
- Protect updates with a version check. If someone tries to save an outdated version, the API responds with `409 Conflict`.
- Add comments and review activity history.
- Show a dashboard summary and recent work items.
- Run automated API and workflow tests with Vitest and Supertest.

## Tech stack

- **Frontend:** React, Vite, Tailwind CSS, React Router, and Lucide icons
- **Backend:** Node.js and Express using ES modules
- **Database:** MongoDB with Mongoose
- **Tests:** Vitest and Supertest

## Project structure

The project keeps the frontend and backend in separate folders:

```text
.
├── client/                  # React and Vite app
├── server/                  # Express API, database models, and tests
├── .gitignore
├── README.md
└── ENGINEERING_DECISIONS.md
```

Each app has its own `package.json` and dependencies. That is expected; you do not need to combine the two `node_modules` folders.

## Before you start

You'll need:

- A supported Node.js LTS version and npm
- Git
- A MongoDB database, either local or hosted on MongoDB Atlas

## Run it locally

### 1. Get the code

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <YOUR_REPOSITORY_DIRECTORY>
```

### 2. Set up the backend

```bash
cd server
npm install
```

Create a local `server/.env` file and add the environment variables the backend actually reads. The following names are examples only, so check the server configuration and any `.env.example` file before using them:

```dotenv
PORT=5000
MONGODB_URI=<YOUR_MONGODB_CONNECTION_STRING>
JWT_SECRET=<A_LONG_RANDOM_SECRET>
CLIENT_URL=http://localhost:5173
```

Keep real credentials in your local environment or hosting provider settings, never in Git.

Start the backend with the script defined in `server/package.json`. If the project has a `dev` script, run:

```bash
npm run dev
```

### 3. Set up the frontend

Open another terminal from the repository root:

```bash
cd client
npm install
```

Set the frontend API URL using the variable name expected by `client/src/services/api`. Vite variables normally start with `VITE_`; for example:

```dotenv
VITE_API_URL=http://localhost:5000/api
```

Use the exact format expected by the existing `apiRequest` helper. If it already adds `/api`, don't add that path a second time.

Start the frontend:

```bash
npm run dev
```

Open the local address printed by Vite, usually `http://localhost:5173`.

## Tests and production build

Run the backend tests from the `server` folder:

```bash
npx vitest run
```

Build the frontend from the `client` folder:

```bash
npm run build
```

Make sure tests use a separate test database. Some tests may create or delete records, so don't point them at production data.

## Things worth checking before a release

1. Sign in with a test account.
2. Create a work item with a valid due date and team.
3. Try search, filters, and pagination.
4. Test duplicate detection and both confirmation choices.
5. Update a status and add a comment.
6. Check that the activity history reflects the changes.
7. Try two updates based on the same old version and confirm the stale update receives `409 Conflict`.
8. Try accessing another team's work items and confirm the request is denied.
9. Check the configured rule that prevents resolved work items from being reopened.

## Security notes

- Don't commit `.env` files, tokens, database credentials, or production secrets.
- Keep `.env.example` to variable names and safe placeholder values only.
- Give the database user only the permissions it needs, and configure MongoDB network access carefully.
- In production, allow requests only from the intended frontend origin.
- Use a strong, unique JWT secret.
- Double-check that automated tests cannot connect to production data.

## Deployment

The planned hosting target is Render. Before deploying:

1. Push the reviewed source and documentation to GitHub.
2. Add the backend's required environment variables in the Render service settings.
3. Set the frontend API URL to the deployed backend address.
4. Configure production CORS and MongoDB access.
5. Deploy the backend and frontend.
6. Test sign-in, API calls, creating work items, comments, activity history, and team access using the deployed URLs.
7. Check deployment logs and make sure no secrets are printed.

Use the actual scripts and configuration in this repository to choose the build commands, start commands, and environment variable names. Don't assume the examples above match every setting in the code.

## Known follow-up work

These are items to verify or improve before making stronger production-readiness claims:

- **Atomic creation and activity logging:** The current creation path has been identified as using compensating deletion rather than a MongoDB transaction. Move this to a transaction where supported and add rollback tests before describing the operation as atomic.
- **Safe retries:** Consider idempotency handling for requests that a client retries after a network timeout or an uncertain response.
- **Duplicate confirmation:** Review what happens when two similar items are submitted at the same time. If confirmation tokens are used, ensure they are tied to the correct user, team, and proposed item.
- **Production checks:** Passing automated tests is a good sign, but it doesn't replace a deployed smoke test, browser-based end-to-end checks, or a review of production configuration.

Update this section as the work is completed, and only mark an item as done when the implementation and tests support that claim.
