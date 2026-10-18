# Engineering Decisions --- Newtonite Ops

This document records important implementation choices, their
trade-offs, and follow-up work. It should describe the code that is
actually present in the repository; update it whenever the
implementation changes.

## 1. React + Vite frontend and Express API

**Decision:** Keep the frontend and backend as separate applications,
with React/Vite for the user interface and Express for the API.

**Why:** The separation makes the UI and API easier to develop, test,
configure, and deploy independently.

**Trade-offs:** The applications need explicit API URL configuration,
CORS configuration, and coordinated deployment settings.

**Follow-up:** Document the exact production build/start commands and
API environment variable names from the repository's package scripts and
configuration.

## 2. MongoDB and Mongoose data model

**Decision:** Store users, teams, work items, comments, and activity
records in MongoDB using Mongoose models.

**Why:** The data model fits the existing Node.js stack and supports
references between users, teams, work items, comments, and history.

**Trade-offs:** Referenced documents and multi-document changes require
deliberate consistency and authorization handling. Schema validation
alone does not guarantee that related writes succeed atomically.

**Follow-up:** Verify indexes and validation against real query
patterns, and ensure existing work items have valid `dueDate` values now
that the field is required.

## 3. Team-scoped authorization

**Decision:** Check the requesting user's team membership and role
before allowing access to team resources and work items.

**Why:** A user should not be able to read or mutate another team's data
simply by changing an ID in a URL.

**Trade-offs:** Authorization checks must be applied consistently to
every relevant endpoint, including nested resources such as comments and
activity history. Missing one check can expose data.

**Verification:** Automated tests should cover allowed same-team access
and denied cross-team access for read and write operations.

## 4. Optimistic concurrency for work-item updates

**Decision:** Include a work-item version in update requests and reject
updates when the stored version no longer matches the client's version.
A stale/conflicting update returns HTTP `409 Conflict`.

**Why:** This prevents a client with outdated data from silently
overwriting a more recent update.

**Trade-offs:** The frontend must handle `409` responses by informing
the user and refreshing the latest item. Clients may need to reapply
their change after reviewing the current state.

**Verification:** Tests should prove that a stale update returns `409`
and does not modify the saved status or version.

## 5. Activity history and transactional consistency

**Decision:** Record meaningful work-item actions in an activity history
so users can understand what changed and when.

**Why:** History improves traceability and makes collaboration easier to
audit.

**Trade-offs:** Writing the main resource and its activity record
creates a multi-document consistency problem.

**Known follow-up:** Work-item creation and activity logging have been
identified as using compensating deletion rather than a MongoDB
transaction. Replace that path with a transaction where the MongoDB
deployment supports transactions, and test that a failure in activity
logging rolls back the work-item creation. Do not claim this path is
atomic until that change is implemented and verified.

## 6. Duplicate detection with explicit confirmation

**Decision:** Detect likely duplicate work items and let the user
discard the new item or explicitly choose to create it anyway.

**Why:** This helps prevent accidental duplicates without blocking
legitimate work that happens to share similar details.

**Trade-offs:** Duplicate detection is not a substitute for database
uniqueness constraints or concurrency-safe request handling. Similarity
rules may flag legitimate items or miss duplicates.

**Follow-up:** Review the race between simultaneous create requests and
the confirmation flow. If confirmation tokens are used, validate their
binding to the user, team, and proposed item and make their use safe
under retries.

## 7. Automated tests

**Decision:** Use Vitest and Supertest for automated tests of API
behavior, authorization, concurrency, comments, and rollback scenarios.

**Why:** These tests exercise the API and help catch regressions in
high-risk workflows.

**Trade-offs:** Tests can pass while the production configuration,
browser interactions, deployment environment, or untested edge cases
remain incorrect.

**Verification:** Run the complete suite against an isolated test
database, run the frontend production build, and perform a manual
end-to-end smoke test after deployment.

## Deferred work and known limitations

-   Replace compensating deletion with a MongoDB transaction for
    work-item creation plus activity logging.
-   Review idempotency for retried create/comment/update requests after
    uncertain network outcomes.
-   Review duplicate-confirmation token semantics and concurrent
    duplicate creation.
-   Complete production deployment verification, including CORS,
    secrets, database access, and authentication.
-   Keep this document synchronized with the implementation; distinguish
    implemented behavior from planned improvements.
