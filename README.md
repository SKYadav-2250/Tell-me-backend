# YouChat — Backend

Lightweight Express + Socket.IO backend for YouChat.

## Overview

This service provides authentication, user management, and real-time messaging via WebSockets (Socket.IO).

## Prerequisites

- Node.js 14+ and npm
- MongoDB (connection string set in `.env`)

## Install

```bash
cd youchat-backend
npm install
```

## Environment

Create a `.env` file in the project root with at least:

- `PORT` (optional, default 3000)
- `MONGO_URI` (MongoDB connection string)
- `JWT_SECRET` (secret for JWT tokens)

Example `.env`:

```
PORT=3000
MONGO_URI=mongodb://localhost:27017/youchat
JWT_SECRET=your_secret_here
```

## Scripts

- `npm run dev` — start with `nodemon` (development)
- `npm start` — start with `node` (production)

## Run

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

## Project Structure

- `server.js` — application entry
- `controllers/` — request handlers
- `middleware/` — Express middleware (auth, etc.)
- `models/` — Mongoose models
- `routes/` — Express routes
- `socket/` — Socket.IO handlers and room management

## Notes

- Keep `.env` out of source control (already in `.gitignore`).
- Use strong `JWT_SECRET` in production.

## Contact

Open an issue or contact the repo owner for questions.
