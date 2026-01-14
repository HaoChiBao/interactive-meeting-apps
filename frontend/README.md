# Interview Royale

A frontend-only "Battle Royale" style mock interview app.

## Features
- **Lobby & Avatars**: Join via room code, see your head on a stick figure body.
- **Recording**: Record video answers to behavioural questions.
- **Fake AI Grading**: Simulated grading logic with randomized scores and feedback.
- **Leaderboards**: Compete against bots for the top spot.

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Zustand (State Management)
- shadcn/ui primitives (Radix UI, cva)

## Setup
1. `npm install`
2. `npm run dev`
3. Open http://localhost:3000

## How it Works
- Everything is simulated client-side (`src/lib/fakeServer.ts`).
- Bots join automatically when you create a room.
- Grading is random but consistent for the session.
- Video is processed locally in the browser (Canvas for avatar, MediaRecorder for recording).

## Known Limitations
- No backend (refreshing wipes state).
- Bots are dumb (random timers).
- Video isn't actually sent anywhere.
