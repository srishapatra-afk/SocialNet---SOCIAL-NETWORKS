# DBMS DA3: Social Networks — Project Handover Document

## 1. Executive Summary & Handover Context

This project is a full-stack, Instagram-inspired social network application built for the **DBMS DA3** academic assignment. It interfaces directly with a live **Neo4j Aura** cloud graph database instance hosting 7 distinct node labels and 12 relationship types.

This handover document records the verified system architecture, architectural decisions, completed foundational milestones, and the roadmap for upcoming development phases.

---

## 2. Completed Milestones (Verified)

### Phase 0: Workspace Audit & Graph Verification
- Inspected parent workspace and established core stack: **Express + TypeScript** (Backend) and **React + Vite + Tailwind CSS** (Frontend).
- Connected to Neo4j Aura in read-only mode to verify live schema integrity:
  - **7 Node Labels**: `User`, `Post`, `Comment`, `Group`, `Event`, `Message`, `Notification`.
  - **12 Relationship Types**: `FOLLOWS`, `CREATED`, `WROTE`, `ON_POST`, `LIKES`, `SENDS`, `RECEIVED_BY`, `RECEIVES_NOTIFICATION`, `CREATES_GROUP`, `MEMBER_OF`, `ORGANIZES`, `HOSTS`.
  - **7 Uniqueness Constraints**: Active on all entity ID properties.
  - Baseline sample records confirmed intact.

### Phase 1: Workspace Scaffolding & Configuration
- Set up root `npm` workspaces linking `backend/` and `frontend/`.
- Configured root `.gitignore` to prevent secret leakage (`.env`, `node_modules/`, `dist/`, logs).
- Initialized TypeScript (`tsconfig.json`) across backend and frontend.
- Validated full static typing (`npm run check`) and production builds (`npm run build`).

### Phase 2: Database Layer & Connection Manager
- Integrated official `neo4j-driver` (v5.28+) with connection pooling and graceful shutdown.
- Implemented Zod-based startup environment validation in `backend/src/config/env.ts`.
- Implemented `/api/health` connectivity check endpoint exposing zero stack traces or credentials.
- Created automated integration tests in `backend/tests/health.test.ts` (Vitest) verifying both 200 (connected) and 503 (disconnected) states.
- Designed concurrency-safe ID allocation mechanism using transactional `:_Counter` nodes.

---

## 3. Preserved Architectural & Security Decisions

The incoming engineering team and agent must strictly preserve the following architectural decisions:

### DECISION 1: Demo Accounts & Authentication Security
- Sample accounts `aditya_demo` (ID 101) and `srisha_demo` (ID 102) must remain intact.
- **No plaintext passwords** under any circumstances.
- **No public demo fallback passwords** or unauthenticated backdoor impersonation.
- Authentication must use `bcryptjs` password hashing (salt rounds: 10).
- An explicit administrative CLI seed script will initialize password hashes for existing demo users.

### DECISION 2: Concurrency-Safe ID Allocation Strategy
- **Integer IDs Preserved**: `User`, `Post`, `Comment`, `Group`, `Event`, `Message` use integer IDs.
- **Problem**: Naive `MATCH (n:User) RETURN max(n.userId) + 1` produces race condition collisions under concurrent writes.
- **Solution**: Dedicated `:_Counter` nodes with uniqueness constraint on `name`:
  ```cypher
  CREATE CONSTRAINT counter_name_unique IF NOT EXISTS FOR (c:_Counter) REQUIRE c.name IS UNIQUE;
  ```
- Incremented atomically via Neo4j node write locks:
  ```cypher
  MATCH (c:_Counter { name: $entityName })
  SET c.current = c.current + 1
  RETURN c.current AS nextId
  ```
- **Notification ID Convention**: Preserves string convention `notificationId: "<userId>-<seq>"` (e.g., `'101-1'`), incremented per recipient user node with write locks.

### DECISION 3: Post Imagery & Fallback Rendering
- `Post` nodes support an optional `imageUrl` property.
- Sample posts 201 and 202 remain intact without images.
- Posts lacking an `imageUrl` will render stylish typography cards in the Instagram feed rather than broken placeholders.

### DECISION 4: Session Security & Parameterized Cypher
- Server-side managed sessions using `HttpOnly`, `SameSite: 'lax'`, and `Secure` (production) cookies.
- Neo4j database credentials must **never** be exposed to the client or placed in frontend `.env` files.
- All Cypher queries must be **100% parameterized** to eliminate Cypher injection vulnerabilities.

---

## 4. Current Environment & Software Stack

| Component | Tool / Version | Verification Status |
|---|---|---|
| Node.js Runtime | `v22.21.0` | Verified |
| Package Manager | `npm 10.9.4` | Verified |
| Version Control | `git 2.53.0.windows.1` | Verified (local repository initialized) |
| Backend Runtime | Node 22 + Express 4 + TypeScript 5.7 | Verified |
| Frontend Runtime | React 18 + Vite 6 + Tailwind CSS 3.4 | Verified |
| Test Runner | Vitest 3.2.7 | Verified (2/2 tests pass) |
| Database | Neo4j Aura (Bolt `neo4j+s://`) | Verified live connectivity |

---

## 5. Next Steps for Developer

1. **Review & Approve Phase Setup Report**: Await user authorization before proceeding to feature implementation.
2. **Git First Commit & Remote Push**: After user approval, execute the initial clean commit and configure the remote repository.
3. **Phase 3: Backend API & Repositories**:
   - Implement entity repositories (`User`, `Post`, `Comment`, `Group`, `Event`, `Message`, `Notification`).
   - Implement session authentication middleware and controllers.
   - Implement rate limiting and request validation schemas.
4. **Phase 4 & 5: Frontend Instagram Experience**:
   - Build Instagram-inspired responsive layout (stories bar, post cards, interaction bar).
   - Implement typography fallback cards for text posts.
   - Connect client auth state to session endpoints.
