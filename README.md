# Collab Editor

A real-time collaborative document editor. Sign up, create documents, and edit them with someone else at the same time. Changes appear live in every open tab.

**Live demo:** https://collab-editor-tau-ten.vercel.app
**Backend API:** https://collab-editor-production-2ddc.up.railway.app

## Features

- Signup and login with JWT authentication and bcrypt password hashing
- Create, list, open, update and delete documents
- Real-time editing over Socket.io: type in one tab and it shows up in the other without a refresh
- Auto-save to the database while you type
- Protected routes: users can't read or change other users' documents
- Consistent dark theme across every page, built on shared CSS variables

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React (Vite), plain CSS with design tokens |
| Backend | Node.js, Express, Socket.io |
| Database | PostgreSQL (Neon) with Prisma ORM |
| Auth | JWT, bcrypt |
| Testing | Automated API tests (11 passing) |
| DevOps | Docker, GitHub Actions CI |
| Hosting | Vercel (frontend), Railway (backend) |

## Project structure

```
Collab-editor/
├── client/          # React app (Vite)
│   └── src/
│       ├── App.jsx      # Auth, dashboard and editor screens
│       ├── theme.css    # Shared colors, spacing and components
│       └── main.jsx
├── server/          # Express API + Socket.io
│   ├── app.js           # Express app and routes
│   ├── index.js         # HTTP server and socket handlers
│   ├── index.test.js    # API tests
│   ├── prisma/          # Database schema
│   └── Dockerfile
└── .github/workflows/ci.yml
```

## Run it locally

You need Node.js and a PostgreSQL database (a free Neon database works).

**1. Clone the repo**
```bash
git clone https://github.com/rajmandviya0-netizen/Collab-editor.git
cd Collab-editor
```

**2. Start the backend**
```bash
cd server
npm install
```
Create `server/.env`:
```
DATABASE_URL=your_postgres_connection_string
JWT_SECRET=any_long_random_string
```
Then:
```bash
npx prisma generate
node index.js
```
The API runs on http://localhost:4000.

**3. Start the frontend** (in a second terminal)
```bash
cd client
npm install
npm run dev
```
Open http://localhost:5173. To point the frontend at a different backend, set `VITE_API_URL` in `client/.env`.

## Tests

```bash
cd server
npm test
```
The tests cover signup, login (including a wrong password), document CRUD, and auth failures (no token, invalid token, and blocked cross-user access). They also run automatically on every push through GitHub Actions.

## Docker

```bash
cd server
docker build -t collab-editor-server .
docker run --env-file .env -p 4000:4000 collab-editor-server
```

## Deployment

- **Frontend:** Vercel, with the root directory set to `client` and `VITE_API_URL` pointing to the Railway backend
- **Backend:** Railway, with the root directory set to `server` and `DATABASE_URL` and `JWT_SECRET` set as service variables
- **CI:** every push to `main` installs dependencies, generates the Prisma client and runs the test suite

## What I learned

- Building a full-stack app end to end: auth, REST API, database, real-time layer and deployment
- Real-time sync with WebSockets and how it differs from normal request/response APIs
- Structuring an Express app so tests hit the real routes
- Containerizing a Node backend and setting up CI with GitHub Actions
- Debugging a Prisma client that fell out of sync with its schema

## Ideas for next

- Conflict-free merging for simultaneous edits (CRDTs, for example Yjs)
- Sharing documents with other users
- Showing who else is currently editing
