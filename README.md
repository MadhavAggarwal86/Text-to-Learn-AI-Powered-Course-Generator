# Text-to-Learn: AI-Powered Course Generator

Type any topic ("Intro to React Hooks", "Basics of Copyright Law") and Text-to-Learn generates a
structured course: 3–6 modules of 3–5 lessons, each with objectives, rich content, code, a YouTube
video, a quiz and further reading. Lessons can be downloaded as PDF and explained aloud in Hinglish.

> 🚧 Work in progress. See [ROADMAP.md](ROADMAP.md) for the build plan and current phase.

**Live demo:** _coming soon_ · **API:** _coming soon_

## Tech stack

| Layer    | Tech                                                   |
| -------- | ------------------------------------------------------ |
| Frontend | React 19, Vite, Tailwind CSS v4, React Router, Axios   |
| Backend  | Node.js, Express 5, Mongoose (MongoDB Atlas), Zod      |
| AI       | Google Gemini (course/lesson generation, Hinglish TTS) |
| Other    | Auth0, YouTube Data API v3, jsPDF + html2canvas        |
| Hosting  | Vercel (client), Render (server), GitHub Actions (CI)  |

## Project structure

```
.
├── client/            # React + Vite frontend (deployed to Vercel)
│   └── src/
│       ├── components/  # layout/, common/ and (later) lesson blocks
│       ├── pages/       # route-level views
│       ├── hooks/       # custom React hooks
│       ├── context/     # global providers
│       └── utils/       # API client and helpers
└── server/            # Express API (deployed to Render)
    ├── server.js        # entry point: connects DB, starts HTTP server
    ├── src/
    │   ├── app.js         # Express app (exported for tests)
    │   ├── config/        # env validation, DB connection
    │   ├── routes/ → controllers/ → services/
    │   ├── middlewares/   # error handling (auth/validation later)
    │   ├── models/        # Mongoose schemas
    │   ├── prompts/       # AI prompt builders and output schemas
    │   └── utils/
    └── tests/
```

## Running locally

Requirements: Node.js 20+ and npm.

```bash
npm run install:all
```

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

```bash
npm run dev
```

- Client: http://localhost:5173 (Vite proxies `/api` to the server)
- API: http://localhost:5050/api/health

`MONGO_URI` is optional until the course API lands; without it the API runs and reports
`database: not configured`. `GEMINI_API_KEY` comes from
[Google AI Studio](https://aistudio.google.com/apikey).

## Scripts (from the repo root)

| Command                          | What it does                                         |
| -------------------------------- | ---------------------------------------------------- |
| `npm run dev`                    | Run server and client together                       |
| `npm run lint`                   | ESLint on server and client                          |
| `npm test`                       | Server tests (Vitest + Supertest, AI calls mocked)   |
| `npm run build`                  | Production build of the client                       |
| `npm run format`                 | Format everything with Prettier                      |
| `npm run ai:try --prefix server` | Generate real outlines and lessons for sample topics |

## How course generation works

1. **Outline:** the topic goes to Gemini with a JSON Schema built from the
   [Zod schemas](server/src/prompts/schemas.js); the reply is validated (3–6 modules × 3–5 lessons).
2. **Lessons:** each lesson's content (objectives, key topics, text, code, a video search query,
   3–5 MCQs, resources) is generated the first time it is opened, then validated the same way.
3. **Reliability:** invalid output is retried once with the validation errors attached; if the main
   model times out or is overloaded, a fallback model is used. AI-suggested links are checked and
   dead ones dropped.
4. **Videos:** the lesson's AI-written search query goes to the YouTube Data API on the server
   (the key never reaches the browser), filtered to embeddable, safe-search videos. Results are
   cached in MongoDB per query for 30 days, since the free quota allows only ~100 searches a day.
   The lesson shows the top 3 as a thumbnail that loads the privacy-enhanced
   `youtube-nocookie.com` player on click, with a YouTube search link as the fallback.
5. **Hinglish audio:** on request, Gemini rewrites the lesson as a ~200-word spoken explanation in
   Hinglish (Roman script, English technical terms), validated like the other AI output, and a
   Gemini text-to-speech model reads it (WAV, ~1.5 minutes, ~20-30 s to make). The WAV is stored
   in MongoDB GridFS with its transcript, served instantly afterwards, and deleted when the lesson
   is regenerated or its course deleted.

## Frontend

| Route                                    | Page                                                 |
| ---------------------------------------- | ---------------------------------------------------- |
| `/`                                      | Topic form (level, example topics) and your courses  |
| `/courses/:courseId`                     | Course overview: modules, lessons, continue, delete  |
| `/courses/:courseId/module/:m/lesson/:l` | Lesson (1-based positions), with previous/next links |

- **Data:** TanStack Query caches courses and lessons; a lesson's content is generated by the
  server the first time it is opened, and the sidebar marks it as opened right away.
- **Layout:** sidebar with the course outline (a drawer on mobile), light/dark theme saved per
  browser, and a banner when the server is waking up (Render free tier).
- **Hinglish audio:** "Explain in Hinglish" fetches the audio with the user's token (an `<audio
src>` can't send one) and plays it from memory, with a progress counter while it is created,
  a download link and an optional transcript.
- **PDF download:** each lesson has a "Download PDF" button. A light, A4-width copy of the lesson
  is rendered off-screen and captured with html2canvas-pro (which understands Tailwind v4's
  `oklch()` colours), then cut into A4 pages by jsPDF. Page breaks only fall between blocks, and
  never right after a heading, so text and questions are not split. Quizzes print without answers
  plus an answer key, the video becomes a link, links stay clickable, and every page has a footer
  with page numbers. The PDF libraries (~600 kB) load only on first use.

## REST API

All responses are JSON; errors look like `{ "error": { "message", "details"? } }`.

| Method | Path                                | Purpose                                                            |
| ------ | ----------------------------------- | ------------------------------------------------------------------ |
| GET    | `/api/health`                       | API and database status (public)                                   |
| GET    | `/api/users/me`                     | The signed-in user's profile                                       |
| POST   | `/api/courses/generate`             | `{ topic, difficulty? }` → generate and save a course (201)        |
| GET    | `/api/courses`                      | Your courses, newest first, with lesson and generated counts       |
| GET    | `/api/courses/:id`                  | Course with ordered modules and lesson titles                      |
| DELETE | `/api/courses/:id`                  | Delete a course with its modules and lessons (204)                 |
| GET    | `/api/lessons/:id`                  | Lesson content; generated and saved the first time it is opened    |
| POST   | `/api/lessons/:id/regenerate`       | Replace a lesson's content with a new version                      |
| GET    | `/api/youtube?query=`               | Up to 3 embeddable YouTube videos for a query (cached 30 days)     |
| GET    | `/api/lessons/:id/audio`            | Hinglish audio explanation (`audio/wav`), created on first request |
| GET    | `/api/lessons/:id/audio/transcript` | The spoken Hinglish script of that audio                           |

- **Ownership:** other users' courses and lessons answer 404.
- **Rate limits (per user):** 300 requests / 15 min overall, 10 course generations / hour,
  20 lesson regenerations / hour, 60 video searches / hour, 30 audio requests / hour (429 when
  exceeded).
- **Authentication:** every route except `/api/health` needs `Authorization: Bearer <Auth0
access token>` (401 otherwise). The token's signature, issuer, audience and expiry are
  verified; the user is saved with their Auth0 profile on first sign-in.
- **Local dev without Auth0:** if `AUTH0_ISSUER`/`AUTH0_AUDIENCE` are empty, every request acts
  as one local user and the `x-dev-user` header switches users for testing. The server refuses
  to start like this in production.

## Auth0 setup

1. **Applications → Create Application → Single Page Application.** In its settings, add
   `http://localhost:5173` (and later your Vercel URL) to **Allowed Callback URLs**,
   **Allowed Logout URLs** and **Allowed Web Origins**. Under **Refresh Token Rotation**, enable
   rotation. Copy the **Domain** and **Client ID**.
2. **Applications → APIs → Create API**, e.g. name "Text-to-Learn API", identifier
   `https://text-to-learn-api` (any URL-like string; it is not called). In its settings, enable
   **Allow Offline Access** (needed for refresh tokens). Then, on the SPA's **API Access** tab
   (or the API's **Application Access** tab), authorize the SPA for **User-delegated Access** to
   this API; otherwise login fails with "Client … is not authorized to access resource server".
3. Set the values:
   - `server/.env`: `AUTH0_ISSUER=https://<Domain>/`, `AUTH0_AUDIENCE=<API identifier>`
   - `client/.env`: `VITE_AUTH0_DOMAIN=<Domain>`, `VITE_AUTH0_CLIENT_ID=<Client ID>`,
     `VITE_AUTH0_AUDIENCE=<API identifier>`

## CI/CD

- **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs on every pull request and
  every push to `main`: formatting; server lint, tests and `npm audit`; client lint, tests,
  production build and `npm audit`. It needs no secrets (AI, YouTube and Auth0 are mocked).
- **CD:** Render deploys the API from `main` once CI has passed
  ([render.yaml](render.yaml), `autoDeployTrigger: checksPass`); Vercel deploys the client from
  `main` and builds a preview for every pull request.
- **Workflow:** one feature branch per change, merged into `main` through a pull request. In
  GitHub → Settings → Branches, protect `main` and require the three CI jobs to pass.
- **Dependabot** opens weekly dependency-update pull requests, which go through the same CI.

## Deployment

Do these in order (each step needs a URL from the previous one):

1. **MongoDB Atlas:** Network Access → allow `0.0.0.0/0` (Render has no fixed IP address).
2. **Render (API):** New → Blueprint → this repository. It reads [render.yaml](render.yaml)
   (Node 22, `server/`, `npm ci --omit=dev`, health check `/api/health`) and asks for the
   secrets: `MONGO_URI`, `GEMINI_API_KEY`, `AUTH0_ISSUER`, `AUTH0_AUDIENCE`, `YOUTUBE_API_KEY`,
   and `CLIENT_ORIGINS` (put a placeholder for now). Note the service URL, e.g.
   `https://text-to-learn-api.onrender.com`.
3. **Vercel (client):** Add New Project → this repository, root directory `client` (Vite
   preset). Environment variables: `VITE_API_URL=<Render URL>`, `VITE_AUTH0_DOMAIN`,
   `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`. The build stops with a clear error if any is
   missing. [client/vercel.json](client/vercel.json) adds SPA routing, security headers and
   long-term caching for hashed assets.
4. **Connect them:** set `CLIENT_ORIGINS=<Vercel URL>` on Render (comma-separate several, e.g.
   a custom domain), and add the Vercel URL to the Auth0 application's Allowed Callback URLs,
   Allowed Logout URLs and Allowed Web Origins.
5. **Check:** open the Vercel URL, log in, generate a course, open a lesson (video, quiz),
   download the PDF and play the Hinglish audio.

Render's free tier sleeps after ~15 minutes without traffic; the first request then takes up to
a minute, and the app shows a "waking up the server" banner meanwhile. Open the site a minute
before a demo.

## License

[MIT](LICENSE)
