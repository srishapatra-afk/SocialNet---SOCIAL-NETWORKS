# DBMS Social Networks — Live Demonstration & Verification Guide

This guide provides a comprehensive 5–10 minute demonstration walkthrough for the **DBMS Social Networks (DA3)** project. It details each user interaction, the expected frontend and backend behaviors, and the corresponding read-only Cypher queries to verify persistence in **Neo4j Aura**.

> [!WARNING]
> **Live Database Precaution:**
> All actions executed against the live application will persist records to your connected Neo4j Aura cloud database. When performing live demo interactions:
> 1. Use clearly identifiable demo content (e.g., prefix captions or comments with `DEMO_`).
> 2. Do not attempt manual deletion of nodes or relationships unless authorized, to preserve graph integrity and sequential ID continuity.

---

## 1. Prerequisites & Service Initialization

### Step 1.1: Verify Environment Files
Ensure your local `backend/.env` is configured with valid Neo4j Aura connection parameters:
- `PORT=5000`
- `CLIENT_ORIGIN=http://localhost:5173`
- `NEO4J_URI=neo4j+s://<instance-id>.databases.neo4j.io`
- `NEO4J_USERNAME=neo4j`
- `NEO4J_PASSWORD=<your-password>`
- `SESSION_SECRET=<random-32-char-secret>`

### Step 1.2: Start Application Services
From the workspace root directory:

```bash
# Launch both backend (:5000) and frontend (:5173) concurrently
npm run dev
```

Alternatively, run each service in separate terminals:
- **Terminal 1 (Backend):** `npm run dev --workspace=backend`
- **Terminal 2 (Frontend):** `npm run dev --workspace=frontend`

### Step 1.3: Verify System Health
Open your browser or run:
```bash
curl http://localhost:5000/api/health
```
**Expected Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-10-25T..."
}
```

---

## 2. Walkthrough Script (5–10 Minutes)

### Step 1: Open the Application & Explore Guest Feed
1. Open your browser and navigate to `http://localhost:5173/`.
2. **Expected UI Behavior:**
   - The Instagram-style layout renders with a left navigation sidebar, center feed stream, and right sidebar widgets.
   - Posts appear in reverse chronological order.
   - Text-only posts render elegant typography gradient cards.
   - In guest mode, interactive buttons (Like, Comment, Follow) gracefully prompt for authentication when clicked or display guest indicators.
3. **Corresponding Read-Only Cypher Query:**
   ```cypher
   MATCH (author:User)-[:CREATED]->(p:Post)
   OPTIONAL MATCH (liker:User)-[:LIKES]->(p)
   OPTIONAL MATCH (commenter:User)-[:WROTE]->(c:Comment)-[:ON_POST]->(p)
   RETURN p.postId AS postId,
          p.caption AS caption,
          author.username AS author,
          count(DISTINCT liker) AS likeCount,
          count(DISTINCT c) AS commentCount
   ORDER BY p.createdAt DESC;
   ```

---

### Step 2: Authenticate via Session Login
1. Click **"Log In"** in the sidebar or navigation to open `/login`.
2. Enter the demo credentials:
   - **Username:** `aditya_demo`
   - **Password:** `Aditya@VIT2026!`
3. Click **"Log In"**.
4. **Expected UI Behavior:**
   - HTTP 200 response received from `POST /api/auth/login`.
   - Browser sets an `HttpOnly`, `SameSite: 'lax'` session cookie (`connect.sid`).
   - The UI redirects to `/`, updating the sidebar with the active profile badge (`@aditya_demo`), unread notification bell, and full interactive capabilities.

---

### Step 3: Create a New Post
1. Click the **"New Post"** button in the left sidebar or the top post creation card.
2. Enter a caption:
   `DEMO_POST: Exploring graph databases with Neo4j Aura and React!`
3. Optionally provide an image URL (or leave blank to test the typography card rendering).
4. Click **"Post"**.
5. **Expected UI Behavior:**
   - HTTP 201 response received from `POST /api/posts`.
   - The new post appears instantly at the top of the feed stream with a unique `postId` allocated via the `:_Counter` node.
   - Like count displays `0` and comment count displays `0`.
6. **Corresponding Read-Only Cypher Query:**
   ```cypher
   MATCH (u:User { username: 'aditya_demo' })-[:CREATED]->(p:Post)
   RETURN p.postId AS postId, p.caption AS caption, toString(p.createdAt) AS createdAt
   ORDER BY p.createdAt DESC
   LIMIT 1;
   ```

---

### Step 4: Like and Unlike a Post
1. Locate post `202` (or your newly created post) in the feed.
2. Click the **Heart (Like)** button.
3. **Expected UI Behavior:**
   - The heart icon turns vibrant red with an active micro-animation.
   - The like count increments by 1 immediately (optimistic UI update confirmed by HTTP 200 from `PUT /api/posts/:postId/like`).
   - If liking another user's post, a notification is atomically dispatched to the post author.
4. Click the **Heart (Like)** button again.
5. **Expected UI Behavior:**
   - The heart returns to outline state.
   - The like count decrements by 1 (confirmed by HTTP 200 from `DELETE /api/posts/:postId/like`).
6. **Corresponding Read-Only Cypher Query:**
   ```cypher
   MATCH (u:User { username: 'aditya_demo' })-[r:LIKES]->(p:Post)
   RETURN u.username AS liker, p.postId AS postId, toString(r.createdAt) AS likedAt;
   ```

---

### Step 5: Add a Comment
1. Expand the comment drawer or comment section on post `201`.
2. Type a comment:
   `DEMO_COMMENT: Verified Neo4j atomic transaction!`
3. Click **"Post"** or press Enter.
4. **Expected UI Behavior:**
   - HTTP 201 response received from `POST /api/posts/201/comments`.
   - The comment appears immediately in the comment list with author `@aditya_demo` and timestamp `"Just now"`.
   - The post card's comment count badge increments by 1.
5. **Corresponding Read-Only Cypher Query:**
   ```cypher
   MATCH (u:User)-[:WROTE]->(c:Comment)-[:ON_POST]->(p:Post { postId: 201 })
   RETURN c.commentId AS commentId,
          c.text AS comment,
          u.username AS author,
          toString(c.createdAt) AS createdAt
   ORDER BY c.createdAt DESC
   LIMIT 3;
   ```

---

### Step 6: View User Profile & Follow / Unfollow
1. In the sidebar or search bar, open `@srisha_demo`'s profile (`/profile/102`).
2. **Expected UI Behavior:**
   - Profile header displays avatar, name, handle (`@srisha_demo`), post count, follower count, and following count.
   - Below the header, a tabbed grid displays `@srisha_demo`'s published posts.
3. Click the **"Follow"** button.
4. **Expected UI Behavior:**
   - The button state transitions to **"Following"** with updated styles.
   - `@srisha_demo`'s displayed follower count increments by 1.
   - HTTP 200 returned from `PUT /api/users/102/follow`.
   - A follow notification is generated for `@srisha_demo`.
5. Click **"Following"** to Unfollow.
6. **Expected UI Behavior:**
   - The button reverts to **"Follow"**.
   - Follower count decrements by 1.
   - HTTP 200 returned from `DELETE /api/users/102/follow`.
7. **Corresponding Read-Only Cypher Query:**
   ```cypher
   MATCH (follower:User { username: 'aditya_demo' })-[r:FOLLOWS]->(followed:User { username: 'srisha_demo' })
   RETURN follower.username AS follower,
          followed.username AS followed,
          toString(r.createdAt) AS followedAt;
   ```

---

### Step 7: View Notifications
1. Log in as `@srisha_demo` (or inspect notifications while logged in).
2. Click the **"Notifications"** item in the navigation sidebar (`/notifications`).
3. **Expected UI Behavior:**
   - A list of social event notifications is displayed (e.g., `"@aditya_demo liked your post"`, `"@aditya_demo followed you"`).
   - Unread notifications highlight with an active unread indicator.
   - Clicking a notification or clicking **"Mark all as read"** sends `PATCH /api/notifications/read-all` or `PATCH /api/notifications/:id/read`, updating the badge count in real time.
4. **Corresponding Read-Only Cypher Query:**
   ```cypher
   MATCH (u:User { username: 'srisha_demo' })-[:RECEIVES_NOTIFICATION]->(n:Notification)
   RETURN n.notificationId AS id,
          n.message AS message,
          n.isRead AS isRead,
          toString(n.createdAt) AS createdAt
   ORDER BY n.createdAt DESC;
   ```

---

### Step 8: Search and Discovery
1. Click **"Search"** in the navigation bar (`/search`).
2. Type `aditya` or `beautiful` in the search bar.
3. Select filter tabs: **"All"**, **"Users"**, or **"Posts"**.
4. **Expected UI Behavior:**
   - Real-time debounced query to `GET /api/search?q=...`.
   - Matching user profiles and posts are returned with highlighted matches.
   - Sensitive user properties (email, password hash) are strictly omitted.
5. **Corresponding Read-Only Cypher Query:**
   ```cypher
   MATCH (u:User)
   WHERE toLower(u.username) CONTAINS toLower('aditya')
      OR toLower(u.firstName) CONTAINS toLower('aditya')
   RETURN u.userId AS userId, u.username AS username, u.firstName + ' ' + u.lastName AS name;
   ```

---

## 3. Troubleshooting & Error Resolution

| Symptom / Error | Root Cause | Resolution |
| :--- | :--- | :--- |
| **Backend unavailable / `ECONNREFUSED :5000`** | Express backend server is not running. | Run `npm run dev --workspace=backend`. Check for port collisions on 5000. |
| **Neo4j connection failure / 503 degraded** | Neo4j Aura instance paused or invalid credentials. | Check `backend/.env`. Verify `NEO4J_URI`, `NEO4J_PASSWORD`, and resume instance in Aura console if paused. |
| **HTTP 401 Unauthorized** | Session cookie missing, expired, or rejected. | Re-authenticate via `/login`. Ensure `CLIENT_ORIGIN` matches frontend URL (e.g., `http://localhost:5173`). |
| **HTTP 403 Forbidden** | Attempting to delete a comment or resource owned by another user. | Normal authorization behavior. Only resource authors or admins can delete content. |
| **HTTP 404 Not Found** | Requesting non-existent user profile, post, or comment ID. | Verify ID exists in Neo4j using the read-only queries in Section 2. |
| **HTTP 500: Comment counter initialization error** | `:_Counter` node for Comment is missing in a fresh Aura database. | The application automatically reconciles missing counters. Alternatively, run `npm run init:comment-counter --workspace=backend`. |
| **Like / Follow transaction error** | Network timeout or temporary database deadlock. | The driver automatically retries transient write transactions. Ensure network connection to Aura is stable. |
