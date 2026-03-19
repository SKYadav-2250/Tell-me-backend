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
CLIENT_URL=https://tellme-frontend.vercel.app
CORS_ORIGINS=https://tellme-frontend.vercel.app,http://localhost:5173
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
- `CLIENT_URL` and `CORS_ORIGINS` control which frontend origins can call the API and open Socket.IO connections.

## Deploy notes

- When deploying on Render, set the following environment variables in the service settings:
	- `MONGO_URI`, `JWT_SECRET`, `PORT` (if needed), `CLIENT_URL=https://tellme-frontend.vercel.app`
	- `CORS_ORIGINS=https://tellme-frontend.vercel.app,http://localhost:5173`
- On Vercel (frontend), set `VITE_API_URL=https://tell-me-backend.onrender.com` in Project → Settings → Environment Variables so the frontend builds with the correct API base URL.

## REST API

### `POST /api/auth/signup`

Create a new user account.

Request body:

```json
{
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "password": "secret123",
  "about": "Hey there! I'm using TellMe."
}
```

Success response:

```json
{
  "message": "Account created successfully",
  "token": "<jwt>",
  "user": {
    "id": "<mongodb-user-id>",
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "about": "Hey there! I'm using TellMe."
  }
}
```

### `POST /api/auth/login`

Log in an existing user.

Request body:

```json
{
  "email": "alice@example.com",
  "password": "secret123"
}
```

Success response:

```json
{
  "message": "Logged in successfully",
  "token": "<jwt>",
  "user": {
    "id": "<mongodb-user-id>",
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "about": "Hey there! I'm using TellMe."
  }
}
```

### `GET /api/health`

Simple backend health check.

Success response:

```json
{
  "status": "OK",
  "message": "TellMe server is running"
}
```

## Socket.IO Events

### Client to server

- `join-room`
  - Payload: `{ roomId, token }`
- `send-message`
  - Payload for text: `{ roomId, encryptedText, type: "text", token, timestamp }`
  - Payload for image: `{ roomId, imageData, type: "image", token, timestamp }`

### Server to client

- `message-history`
  - Payload: `Message[]`
- `receive-message`
  - Payload: `{ id, senderId, senderName, encryptedText, imageData, type, timestamp }`
- `user-joined`
  - Payload: `{ user, roomUsers, message, timestamp }`
- `user-left`
  - Payload: `{ user, roomUsers, message, timestamp }`
- `error`
  - Payload: `{ message }`

## Contact

Open an issue or contact the repo owner for questions.
