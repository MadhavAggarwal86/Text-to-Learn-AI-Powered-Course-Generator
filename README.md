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

`MONGO_URI` is optional until the data models land; without it the API runs and reports
`database: not configured`.

## Scripts (from the repo root)

| Command          | What it does                      |
| ---------------- | --------------------------------- |
| `npm run dev`    | Run server and client together    |
| `npm run lint`   | ESLint on server and client       |
| `npm test`       | Server tests (Vitest + Supertest) |
| `npm run build`  | Production build of the client    |
| `npm run format` | Format everything with Prettier   |

## Deployment

- **Backend → Render:** New Web Service, root directory `server`, build `npm install`,
  start `npm start`, health check path `/api/health`. Environment: `NODE_ENV=production`,
  `CLIENT_ORIGINS=<your Vercel URL>`, `MONGO_URI`.
- **Frontend → Vercel:** import the repo, root directory `client` (Vite preset). Environment:
  `VITE_API_URL=<your Render URL>`. `client/vercel.json` rewrites all paths to `index.html` so
  deep links work.

## License

[MIT](LICENSE)
