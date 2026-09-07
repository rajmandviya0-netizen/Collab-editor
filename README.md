# Collab Editor

A real-time collaborative document editor — built as a full-stack capstone project. Multiple people can open the same document and see each other's edits live, with presence indicators showing who's currently in the document.

**Live app:** https://collab-editor-tau-ten.vercel.app
**Backend API:** https://collab-editor-production-2ddc.up.railway.app

---

## Features

- 🔐 **Authentication** — signup/login with JWT + bcrypt password hashing
- 📄 **Document CRUD** — create, rename, edit, and delete documents
- ⚡ **Real-time collaborative editing** — typing in one browser instantly syncs to every other browser viewing the same document (via Socket.io)
- 👥 **Live presence** — see avatars of everyone currently viewing a document, plus a "someone is typing…" indicator
- 🔗 **Document sharing** — the owner can share a document with another user by email, giving them full view/edit access
- 📱 **Sidebar navigation** — browse and search all your documents (owned + shared with you) from one place
- 🖊️ **Distraction-free full-screen editor** with an expandable, editable title

---

## Tech Stack

**Frontend**
- React (Vite)
- Socket.io Client

**Backend**
- Node.js + Express
- Socket.io (real-time sync + presence)
- JWT + bcrypt (authentication)

**Database**
- PostgreSQL (hosted on Neon)
- Prisma ORM

**Testing**
- Jest (11/11 tests passing — signup, login, document CRUD, auth failure cases)

**DevOps**
- Docker (backend containerized)
- GitHub Actions (CI — runs tests on every push/PR to main)
- Railway (backend + database hosting)
- Vercel (frontend hosting)

---

## Architecture

REST routes handle auth and document CRUD (create/read/update/delete). Socket.io handles everything real-time: broadcasting edits, tracking who's in a document, and typing indicators. Every keystroke is also debounce-saved to Postgres via a PUT request, so content isn't lost even if a socket connection drops.

---

## Running locally

### Prerequisites
- Node.js 18+
- A PostgreSQL database (e.g. a free Neon project)

### 1. Clone the repo

git clone https://github.com/rajmandviya0-netizen/Collab-editor.git
cd Collab-editor

### 2. Backend setup

cd server
npm install

Create a .env file in server/:

DATABASE_URL=your_postgres_connection_string
JWT_SECRET=any_random_secret_string

Apply the database schema:

npx prisma migrate dev

Start the backend:

node index.js

Backend runs on http://localhost:4000.

### 3. Frontend setup

cd ../client
npm install

Create a .env file in client/:

VITE_API_URL=http://localhost:4000

Start the frontend:

npm run dev

Frontend runs on http://localhost:5173.

---

## Running tests

cd server
npm test

---

## How document sharing works

1. Open a document you own.
2. Click Share and enter your friend's email (they need an existing account).
3. They'll now see the document in their own sidebar, and can open, edit, and collaborate on it in real time — same as the owner.

---

## Project status

Core features (auth, CRUD, real-time sync, presence, sharing) are complete and deployed. Possible next steps: rich text formatting, document version history, and per-user edit permissions (view-only vs. edit access).