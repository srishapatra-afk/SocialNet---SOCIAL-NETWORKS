# DBMS Social Networks — DA3

A full-stack, graph-powered social network application developed for the **DBMS DA3** academic curriculum. The platform connects a modern, responsive React + Vite + TypeScript frontend (Instagram-inspired design system) to an Express + TypeScript backend, backed by a live **Neo4j Aura** cloud property graph database.

---

## 1. Project Overview & Features

The application leverages the power of graph databases to model complex social network relationships natively, including follower graphs, author attribution, engagement (likes, comments), notifications, and content discovery.

### Key Implemented Features
- **Social Graph Engine**: Native Neo4j property graph modeling users, posts, comments, notifications, and social connections.
- **Instagram-Inspired UI**: Responsive single-page application featuring stories bars, feed cards, typography fallback rendering, like/comment drawers, and user profiles.
- **Session Authentication & Security**: Server-side session management with `HttpOnly` and `SameSite` cookies, bcrypt password hashing (cost factor 10), and strict role authorization.
- **Feed & Post Publishing**: Reverse-chronological post streaming with concurrency-safe sequence allocation (`:_Counter` nodes) and support for image media and typography text cards.
- **Engagement & Reactions**: Atomic post likes and unlikes with optimistic UI state transitions, deduplicated counts, and follow/like notifications.
- **Comment Threads**: Nested comment threads per post with author attribution and deletion authorization.
- **Follow & Unfollow System**: Asymmetric social graph edges (`(follower:User)-[:FOLLOWS]->(followed:User)`) with dynamic follower/following counts.
- **Notifications Pipeline**: In-app notifications for likes, comments, and follows with real-time unread badges and atomic sequence generation.
- **Search & Discovery**: Substring and keyword search across users and post captions with sensitive attribute filtering.

---

## 2. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite 6, TypeScript 5.7, Tailwind CSS 3.4, Lucide React, Axios, React Router 7 |
| **Backend** | Node.js 22, Express 4, TypeScript 5.7, Zod, Helmet, CORS, Cookie-Parser, Express-Session, Bcryptjs |
| **Database** | Neo4j Aura Cloud (Graph Database, Cypher Query Language, Bolt Protocol `neo4j+s://`) |
| **Testing & Quality** | Vitest 3.0, Supertest 7.0, TypeScript compiler (`tsc --noEmit`), Concurrently |

---

## 3. Project Directory Structure

```
DA3_Social_Networks/
├── .gitignore                   # Excludes node_modules, build outputs, and .env files
├── package.json                 # Monorepo root workspace configuration
├── package-lock.json            # Exact dependency tree lockfile
├── README.md                    # Root project manual and technical reference
├── PROJECT_PROGRESS.md          # Comprehensive milestone audit and changelog
├── HANDOVER.md                  # System architecture and handover log
├── docs/
│   ├── NEO4J_DATA_MODEL.md      # Authoritative Neo4j property graph schema & queries
│   └── DEMO_GUIDE.md            # 5-10 minute live walkthrough & troubleshooting script
├── backend/
│   ├── package.json             # Backend dependencies and scripts
│   ├── tsconfig.json            # Backend TypeScript configuration
│   ├── .env.example             # Template for backend environment variables
│   ├── src/
│   │   ├── config/              # Neo4j driver singleton, Zod env validation
│   │   ├── controllers/         # Auth, Post, Comment, User, Notification, Search
│   │   ├── middleware/          # Session authentication & rate limiting
│   │   ├── routes/              # Express API route declarations
│   │   ├── scripts/             # Administrative scripts (schema inspection, counter init)
│   │   ├── services/            # Counter allocation and notification pipelines
│   │   └── server.ts            # Application entry point & centralized error handlers
│   └── tests/                   # Automated Vitest integration & security suites (153 tests)
└── frontend/
    ├── package.json             # Frontend dependencies and scripts
    ├── tsconfig.json            # Frontend TypeScript configuration
    ├── vite.config.ts           # Vite configuration
    ├── tailwind.config.js       # Tailwind CSS design system tokens
    ├── .env.example             # Template for frontend environment variables
    └── src/
        ├── components/          # Navigation, PostCard, CommentDrawer, Modals
        ├── context/             # Authentication & session React context
        ├── pages/               # HomePage, ProfilePage, SearchPage, LoginPage, RegisterPage
        ├── services/            # Axios API client & endpoints
        ├── types/               # Shared TypeScript domain interfaces
        └── main.tsx             # React DOM root entry point
```

---

## 4. Prerequisites & Installation

### Software Prerequisites
- **Node.js**: `v20.0.0` or higher (Tested on `v22.21.0`)
- **npm**: `v10.0.0` or higher (Tested on `10.9.4`)
- **Neo4j Aura Cloud Instance**: An active Neo4j Aura database instance (Free or Professional tier).

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd DA3_Social_Networks
   ```

2. **Install all workspace dependencies:**
   ```bash
   npm install
   ```
   This automatically installs and links dependencies across root, `backend`, and `frontend` workspaces.

---

## 5. Environment Configuration

> [!CAUTION]
> **Security Notice:**
> Each developer must configure their own local, untracked `.env` files. Never commit `.env` files or credentials to Git. Root `.gitignore` is pre-configured to exclude all `.env` files.

### 5.1 Backend Environment Setup

Create `backend/.env` from the provided example:
```bash
cp backend/.env.example backend/.env
```

Configure the following variable **NAMES** in `backend/.env` (substitute your real values):
- `PORT`: Port for the Express server (default: `5000`).
- `NODE_ENV`: Application environment (`development`, `production`, or `test`).
- `CLIENT_ORIGIN`: Allowed CORS origin of the frontend (default: `http://localhost:5173`).
- `SESSION_SECRET`: Cryptographically random string (at least 32 characters) for cookie signing.
- `NEO4J_URI`: Connection URI for your Neo4j Aura database (e.g., `neo4j+s://<instance-id>.databases.neo4j.io`).
- `NEO4J_USERNAME`: Database username (default: `neo4j`).
- `NEO4J_PASSWORD`: Database password generated during Aura instance creation.
- `NEO4J_DATABASE`: Active database name (default: `neo4j`).

### 5.2 Frontend Environment Setup

Create `frontend/.env` from the provided example:
```bash
cp frontend/.env.example frontend/.env
```

Configure:
- `VITE_API_BASE_URL`: Base URL pointing to the Express backend (default: `http://localhost:5000/api`).

---

## 6. Running the Application

### Development Mode (Concurrent)
To launch both the backend and frontend dev servers with a single command:
```bash
npm run dev
```
- **Backend API**: Running at `http://localhost:5000`
- **Frontend App**: Accessible at `http://localhost:5173`

### Individual Workspace Execution
- **Run Backend Only**: `npm run dev --workspace=backend`
- **Run Frontend Only**: `npm run dev --workspace=frontend`

---

## 7. API Reference & HTTP Endpoints

All API endpoints are prefixed with `/api`. Requests that modify data require an active authenticated session.

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user account (bcrypt hashed) | No |
| `POST` | `/api/auth/login` | Log in and establish `HttpOnly` session cookie | No |
| `POST` | `/api/auth/logout` | Invalidate active session and clear cookie | Yes |
| `GET` | `/api/auth/me` | Fetch active authenticated user profile | Yes |

### Posts (`/api/posts`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/posts` | Fetch paginated social feed (guest allowed) | No |
| `POST` | `/api/posts` | Create new post (atomic `:_Counter` allocation) | Yes |
| `PUT` | `/api/posts/:postId/like` | Like post and notify author (idempotent `MERGE`) | Yes |
| `DELETE` | `/api/posts/:postId/like` | Unlike post (atomic relationship deletion) | Yes |
| `GET` | `/api/posts/:postId/comments` | Fetch comments for a specific post | No |
| `POST` | `/api/posts/:postId/comments` | Add comment to post and notify post author | Yes |

### Comments (`/api/comments`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `DELETE` | `/api/comments/:commentId` | Delete comment (author or post author only) | Yes |

### Users & Profiles (`/api/users`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users/:userId/profile` | Fetch user profile and social counts | No |
| `GET` | `/api/users/:userId/posts` | Fetch published posts by specific user | No |
| `PUT` | `/api/users/:userId/follow` | Follow user and generate follow notification | Yes |
| `DELETE` | `/api/users/:userId/follow` | Unfollow user | Yes |

### Notifications (`/api/notifications`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications` | List notifications for authenticated user | Yes |
| `GET` | `/api/notifications/unread-count`| Get integer count of unread notifications | Yes |
| `PATCH` | `/api/notifications/:notificationId/read` | Mark single notification as read | Yes |
| `PATCH` | `/api/notifications/read-all` | Mark all notifications as read | Yes |

### Search & Discovery (`/api/search`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/search?q=:query&type=:type` | Search users and posts (all, users, posts) | No |

### System Health (`/api/health`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Check backend & Neo4j connectivity status | No |

---

## 8. Verification, Testing & Build Commands

### Run Full Test Suite
The backend contains 11 comprehensive Vitest test suites covering authentication, feed, posts, comments, likes, user profiles, notifications, search, security audits, and follow/unfollow regressions:
```bash
npm run test --workspace=backend
```
*(All 153 tests pass with mocked Neo4j transactions and isolated database simulations).*

### Static TypeScript Type-Checking
Validate zero TypeScript errors across both workspaces:
```bash
npm run check
```
*(Executes `tsc --noEmit` on both `backend` and `frontend`).*

### Production Bundle Compilation
Validate clean production builds:
```bash
npm run build
```
*(Compiles backend to `backend/dist/server.js` and frontend to `frontend/dist/` via Vite).*

---

## 9. Troubleshooting Guide

| Issue | Potential Cause | Solution |
| :--- | :--- | :--- |
| **`503 Service Unavailable` on `/api/health`** | Neo4j Aura instance is paused, or connection credentials in `backend/.env` are incorrect. | Log into the [Neo4j Aura Console](https://console.neo4j.io/), resume the instance if paused, and verify `NEO4J_URI` and `NEO4J_PASSWORD`. |
| **`401 Unauthorized` on actions** | Session cookie is missing or rejected by browser. | Ensure your browser allows cookies on `localhost`. Ensure `CLIENT_ORIGIN` in `backend/.env` matches `http://localhost:5173`. |
| **`403 Forbidden` on comment deletion** | Current logged-in user is neither the comment author nor the post owner. | This is intended authorization enforcement. Only authors or post owners can delete comments. |
| **`500 Internal Server Error`** | Transient database lock or uninitialized counter. | Check backend terminal logs for sanitized error context. Drivers automatically retry transient write deadlocks. |
| **Vite port collision** | Port 5173 is already in use by another process. | Vite will automatically suggest an alternate port (e.g., 5174). Update `CLIENT_ORIGIN` in `backend/.env` accordingly. |

---

## 10. Security & Deployment Limitations

- **Session Store**: Currently uses Express memory session store in development. For high-scale production clustering, replace with a persistent distributed store (e.g., Redis or Neo4j-backed session store).
- **Aura Free Tier Limits**: Neo4j Aura Free tier limits concurrent connection pools and auto-pauses inactive instances. Keep queries parameterized and run test suites with `--fileParallelism=false`.
- **Secret Hygiene**: Credentials, session secrets, and password hashes are never returned in API payloads or rendered in the frontend. All password storage uses bcrypt with 10 salt rounds.
