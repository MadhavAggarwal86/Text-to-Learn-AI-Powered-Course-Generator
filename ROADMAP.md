# Text-to-Learn — Build Roadmap

An AI course generator: the user types a topic, the app generates a course (3–6 modules × 3–5 lessons), renders rich lessons (text, code, YouTube video, MCQs), and supports Hinglish audio, PDF export, Auth0 login and saved courses.

**Deliverables (from the brief):** live public URL · GitHub repo with real commit history + clear README · 5-minute demo video (prompt → generation → code architecture).

**Judged on:** functionality · code quality · UI/UX · creativity.

## Status

All 13 phases are built. Each was developed on its own branch and merged into `main`.

| Phase                                       | Status | Notes                                                                  |
| ------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| 0 · Scaffold                                | ✅     | Local API port is 5050 (macOS AirPlay uses 5000)                       |
| 1 · Data models                             | ✅     |                                                                        |
| 2 · AI generation                           | ✅     | Gemini 3.5 Flash-Lite with 3.1 fallback; links checked                 |
| 3 · Course and lesson API                   | ✅     |                                                                        |
| 4 · Layout, routing, pages                  | ✅     | TanStack Query for data                                                |
| 5 · Lesson rendering                        | ✅     |                                                                        |
| 6 · Auth0                                   | ✅     | Local dev mode without Auth0                                           |
| 7 · YouTube videos                          | ✅     | 30-day cache (quota is ~100 searches a day)                            |
| 8 · PDF export                              | ✅     | html2canvas-pro (Tailwind v4 `oklch()` colours)                        |
| 9 · Hinglish audio                          | ✅     | Stored in GridFS                                                       |
| 10 · CI/CD and hardening                    | ✅     | GitHub Actions, Dependabot, Render blueprint                           |
| 11 · Extras                                 | ✅     | Progress tracking and sharing; whole-course PDF left as future work    |
| 12 · README and demo                        | ✅     | Screenshots and diagrams in README; [demo script](docs/DEMO_SCRIPT.md) |
| Deploy (push, Render, Vercel), record video | ⏳     | Steps in the README; record using the demo script                      |

The plan below is the original one, kept for reference; the README describes what was built.

---

## 1. Key decisions (and why)

| Area                | Choice                                                                                                                                     | Reason                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo layout         | One monorepo: `client/` + `server/`                                                                                                        | Matches the brief's final structure; one README, one commit history, simpler CI.                                                                                                                                            |
| Frontend            | React + Vite + React Router v6 + Tailwind CSS                                                                                              | Fast dev loop; Tailwind makes the dark/light theme and PDF-specific styles easy. (Chakra UI also fine — pick one, don't mix.)                                                                                               |
| State               | React Context for auth/theme + a small `useApi` hook                                                                                       | Zustand only if state gets messy; it probably won't.                                                                                                                                                                        |
| Backend             | Node 20 + Express + Mongoose (MongoDB Atlas free tier)                                                                                     | Recommended MERN stack.                                                                                                                                                                                                     |
| AI text             | Google Gemini via `@google/genai`, JSON mode with a response schema                                                                        | One API key covers both text generation and TTS (Milestone 10). Model name kept in `GEMINI_MODEL` env var so it can be swapped.                                                                                             |
| AI output safety    | Validate every AI response with **Zod**; retry once on invalid JSON                                                                        | The brief calls out "robust parsing and validation" — this is where most bugs will come from.                                                                                                                               |
| Generation strategy | **Two-stage + lazy**: generate the outline immediately; generate each lesson's full content the first time it's opened (`isEnriched` flag) | A full course is ~20 lessons. Generating all of them up front takes minutes and burns quota. Outline returns in a few seconds; lessons fill in on demand. This is exactly what the `isEnriched` field in the schema is for. |
| Auth                | Auth0 (`@auth0/auth0-react` + `express-oauth2-jwt-bearer`)                                                                                 | Required by the brief.                                                                                                                                                                                                      |
| Video               | YouTube Data API v3, **called only from the backend**, results cached in Mongo                                                             | Keeps the API key secret and saves quota. Note: the brief lists `VITE_YOUTUBE_API_KEY` on the frontend — skip that, any `VITE_` var is public in the browser bundle.                                                        |
| PDF                 | `html2canvas` + `jsPDF` on a hidden, print-styled copy of the lesson                                                                       | As specified. Must slice the canvas into A4 pages so long lessons don't get cut off.                                                                                                                                        |
| Hosting             | Vercel (client) + Render (server) + GitHub Actions CI                                                                                      | As specified.                                                                                                                                                                                                               |
| Tests               | Vitest (client + server), Supertest, `mongodb-memory-server`; AI calls mocked                                                              | Gives CI something real to run and shows code quality.                                                                                                                                                                      |

### Gaps in the brief I'll fix

1. **Resources/readings are missing from the Milestone 8 lesson prompt**, but the core challenge requires "objectives, key topics, and suggested readings or external links" per lesson. The lesson JSON will include `objectives`, `keyTopics` and `resources: [{title, url}]`.
2. **Routes are inconsistent** (`/course/:id` vs `/courses/:courseId/module/:moduleIndex/lesson/:lessonIndex`). I'll use the nested form everywhere.
3. **Schema is missing a few fields**: lesson `objectives`, `keyTopics`, `resources`, `order`; course `prompt`/`difficulty`; and an index on `creator`.
4. **Render's free tier sleeps** after ~15 min idle (≈30–50 s cold start). Warm it up before recording the demo, and show a friendly "waking the server…" loader.

---

## 2. Accounts & keys to set up first (Day 0, ~1 hour)

- [ ] GitHub repo `text-to-learn` (public)
- [ ] MongoDB Atlas free cluster → `MONGO_URI` (allow `0.0.0.0/0` for Render)
- [ ] Google AI Studio → `GEMINI_API_KEY`
- [ ] Google Cloud project → enable **YouTube Data API v3** → `YOUTUBE_API_KEY`
- [ ] Auth0 tenant → create a **Single Page Application** (Client ID, Domain) and an **API** (Identifier = `AUTH0_AUDIENCE`)
- [ ] Vercel and Render accounts linked to GitHub
- [ ] Local: Node 20+, npm, Git

All secrets go in `server/.env` and `client/.env` (git-ignored), with committed `.env.example` files listing the variable names.

---

## 3. Architecture

```
Browser (React/Vite on Vercel)
  │  Auth0 login (redirect) → access token (JWT)
  │  axios → Authorization: Bearer <token>
  ▼
Express API (Render)
  ├─ middlewares: checkJwt · attachUser · validate(zod) · rateLimit · errorHandler
  ├─ routes → controllers → services
  │     services/ai.service.js        → Gemini (outline + lesson JSON)
  │     services/youtube.service.js   → YouTube search + cache
  │     services/tts.service.js       → Gemini translate + TTS → WAV
  └─ models: User · Course · Module · Lesson · VideoCache
  ▼
MongoDB Atlas
```

### Folder structure

```
text-to-learn/
├── .github/workflows/ci.yml
├── README.md
├── server/
│   ├── server.js
│   ├── src/
│   │   ├── app.js                # express app (exported for tests)
│   │   ├── config/               # db.js, env.js (validates env with zod)
│   │   ├── routes/               # course.routes.js, lesson.routes.js, media.routes.js
│   │   ├── controllers/
│   │   ├── middlewares/          # auth.js, validate.js, errorHandler.js, rateLimit.js
│   │   ├── models/               # User, Course, Module, Lesson, VideoCache
│   │   ├── services/             # ai.service.js, youtube.service.js, tts.service.js
│   │   ├── prompts/              # coursePrompt.js, lessonPrompt.js, schemas.js (zod)
│   │   └── utils/                # asyncHandler, ApiError, wav.js
│   └── tests/
└── client/
    └── src/
        ├── components/
        │   ├── layout/           # AppLayout, Sidebar, Topbar
        │   ├── PromptForm.jsx
        │   ├── LessonRenderer.jsx
        │   ├── blocks/           # HeadingBlock, ParagraphBlock, CodeBlock, VideoBlock, MCQBlock, ResourcesBlock
        │   ├── LessonPDFExporter.jsx
        │   ├── AudioExplainButton.jsx
        │   └── common/           # LoadingSpinner, ErrorMessage, Skeleton, ProtectedRoute
        ├── pages/                # Home, Course, Lesson, NotFound
        ├── hooks/                # useApi, useCourse, useLesson
        ├── context/              # ThemeContext
        ├── utils/                # api.js (axios instance + token interceptor)
        ├── App.jsx
        └── main.jsx
```

### REST API

| Method | Path                          | Auth | Purpose                                                                                          |
| ------ | ----------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| GET    | `/api/health`                 | –    | Health check (also used to wake Render)                                                          |
| POST   | `/api/courses/generate`       | ✔    | `{ topic, difficulty? }` → generate outline, save Course + Modules + Lesson stubs, return course |
| GET    | `/api/courses`                | ✔    | Current user's courses                                                                           |
| GET    | `/api/courses/:id`            | ✔    | Course with modules and lesson titles populated                                                  |
| DELETE | `/api/courses/:id`            | ✔    | Delete course (cascade modules/lessons)                                                          |
| GET    | `/api/lessons/:id`            | ✔    | Return lesson; if `!isEnriched`, generate content first, save, then return                       |
| POST   | `/api/lessons/:id/regenerate` | ✔    | Optional: regenerate a lesson                                                                    |
| GET    | `/api/youtube?query=`         | ✔    | Top 1–3 embeddable videos (cached)                                                               |
| POST   | `/api/lessons/:id/audio`      | ✔    | `{ lang: "hinglish" }` → `audio/wav`                                                             |

Ownership check on every course/lesson route: `course.creator === req.auth.payload.sub`, otherwise 404.

### Data model (adjusted from the brief)

```js
Course  { title, description, prompt, difficulty, tags[], creator /*auth0 sub, indexed*/, modules[ref Module], timestamps }
Module  { title, order, course(ref), lessons[ref Lesson], timestamps }
Lesson  { title, order, module(ref), objectives[], keyTopics[], content[Mixed], resources[{title,url}], isEnriched:false, timestamps }
User    { sub (unique), email, name, timestamps }          // upserted on first authenticated request
VideoCache { query (unique), results[], createdAt (TTL 7 days) }
```

### Lesson content block format

```json
{ "type": "heading",   "text": "..." }
{ "type": "paragraph", "text": "..." }              // supports **bold** and newlines
{ "type": "code",      "language": "python", "text": "..." }
{ "type": "video",     "query": "supervised learning explained" }
{ "type": "mcq",       "question": "...", "options": ["..."], "answer": 1, "explanation": "..." }
```

---

## 4. Phased build plan

Each phase = one feature branch → PR → merge into `main`. Small, descriptive commits inside each (the brief grades commit history). The order differs slightly from the PDF: I build the **core prompt → course → lesson loop first**, then layer auth and extras, and **deploy early** so deployment surprises don't land on the last day.

Timeline assumes ~2 weeks part-time; compress proportionally for a shorter hackathon (Phases 0–5 + 9 are the must-haves).

### Phase 0 — Scaffold & deploy a "hello world" (Day 1) · Milestones 1–3, 12

- `git init`, monorepo, `.gitignore`, `.env.example`s, README skeleton, MIT license.
- `server/`: Express app, `/api/health`, CORS (allow-list the Vercel URL + localhost), Helmet, Morgan, central error handler, Mongo connection, env validation.
- `client/`: Vite + React + Tailwind + React Router; placeholder Home page calling `/api/health`.
- ESLint + Prettier on both sides.
- Deploy both immediately (Render root dir `server`, Vercel root dir `client`) and confirm the frontend can reach the backend.
- **Done when:** the live Vercel URL shows "API: ok" from the live Render backend.

### Phase 1 — Data models (Day 2) · Milestone 5

- Mongoose models above, with `order` fields and indexes.
- Cascade delete helper (course → modules → lessons).
- Model tests against `mongodb-memory-server`.
- **Done when:** tests create a full course tree and delete it cleanly.

### Phase 2 — AI generation service (Days 2–4) · Milestone 8 ⭐ core

- `prompts/coursePrompt.js`: topic (+ difficulty) → `{ title, description, tags, modules: [{ title, lessons: [title] }] }`, foundational → advanced, 3–6 modules × 3–5 lessons.
- `prompts/lessonPrompt.js`: course/module/lesson titles → `{ title, objectives, keyTopics, content[], resources[] }`; rules: video _query_ not link, code only when relevant, 4–5 MCQs with explanations at the end, raw JSON only.
- `prompts/schemas.js`: Zod schemas for both outputs (enforce module/lesson counts, MCQ `answer` within `options` range, valid URLs).
- `ai.service.js`: call Gemini with JSON response mode → strip stray ``` fences defensively → `JSON.parse` → Zod validate → on failure retry once with the validation error appended → else throw a clean `ApiError(502)`.
- Token/latency savings: lesson prompt sends only titles (not the whole course), low temperature for structure, timeout on each call.
- Unit tests with mocked Gemini responses (valid, fenced, malformed, wrong counts).
- **Done when:** a script turns 5 varied topics ("React Hooks", "Copyright Law basics", "Photosynthesis"…) into valid outlines and lessons.

### Phase 3 — Course & lesson API (Days 4–5) · Milestone 2

- Controllers/routes from the API table (temporarily using a fixed dev user id until Phase 6).
- `POST /generate`: validate input (3–200 chars), call outline service, write Course/Modules/Lesson stubs in one go, return populated course.
- `GET /lessons/:id`: lazy enrichment; guard against double-generation if two requests arrive at once (atomic `findOneAndUpdate` on a `generating` flag, or just accept the rare duplicate).
- `express-rate-limit` on generation routes (e.g. 10 courses/hour/user) to protect the API quota.
- Supertest integration tests with the AI service mocked.
- **Done when:** Postman/curl can generate a course and open any lesson.

### Phase 4 — Layout, routing & pages (Days 5–6) · Milestones 1, 7

- Routes: `/` (home: PromptForm + "My courses" grid), `/courses/:courseId`, `/courses/:courseId/module/:moduleIndex/lesson/:lessonIndex`, `*` NotFound.
- `AppLayout` with `<Outlet/>`, collapsible `Sidebar` (on lesson pages it shows the course's modules/lessons tree with the current lesson highlighted), `Topbar` (logo, theme toggle, user menu).
- `PromptForm` with example-topic chips and a difficulty selector.
- Generation UX: multi-step loading state ("Designing curriculum…", "Creating modules…"), skeletons, `ErrorMessage` with retry; prev/next lesson buttons.
- Responsive: sidebar becomes a drawer on mobile.
- **Done when:** the full flow works end-to-end in the browser without auth.

### Phase 5 — Lesson rendering (Days 6–7) · Milestone 6

- `LessonRenderer` maps `block.type` → component; unknown types render nothing (and log a warning) instead of crashing.
- `HeadingBlock`, `ParagraphBlock` (safe bold/newline rendering — no `dangerouslySetInnerHTML` on AI text), `CodeBlock` (syntax highlighting via `react-syntax-highlighter` or Prism, copy button), `MCQBlock` (select → check → correct/incorrect + explanation, running score), `ResourcesBlock`, objectives/key-topics header card.
- `VideoBlock` stub for now (shows the query).
- Component tests with Vitest + Testing Library.
- **Done when:** every block type renders well in light and dark mode on mobile and desktop.

### Phase 6 — Authentication (Days 7–8) · Milestone 4

- Auth0 dashboard: callback/logout/web-origin URLs for localhost **and** the Vercel domain; API with audience; enable refresh-token rotation.
- Client: `Auth0Provider` (with `audience`, `cacheLocation="localstorage"`, `useRefreshTokens`), Login/Logout buttons, `ProtectedRoute`, axios interceptor that adds `getAccessTokenSilently()` token.
- Server: `express-oauth2-jwt-bearer` `auth({ audience, issuerBaseURL })` on all `/api` routes except health; `attachUser` middleware upserts the `User` (name/email from token claims, or `/userinfo` on first sight) and sets `req.user`.
- Replace the dev user id with `req.auth.payload.sub`; add ownership checks.
- **Done when:** two different accounts see only their own courses, and calls without a token get 401.

### Phase 7 — YouTube videos (Day 9) · Milestone 9

- `youtube.service.js`: `search.list` with `q`, `type=video`, `videoEmbeddable=true`, `maxResults=3`, `safeSearch=strict`, `relevanceLanguage=en`; return `{ videoId, title, channel }`.
- Mongo `VideoCache` with a 7-day TTL index so repeated queries cost zero quota (each search costs 100 units of the 10,000/day quota).
- `VideoBlock`: fetch `/api/youtube?query=` → responsive `youtube-nocookie.com` iframe; let the user switch between the top 3 results; fallback link to a YouTube search if the API fails or quota runs out.
- **Done when:** lessons show relevant embedded videos, and a reload hits the cache (verify in logs).

### Phase 8 — PDF export (Day 10) · Milestone 11

- `LessonPDFExporter`: renders a hidden, fixed-width (≈794 px = A4), always-light, print-styled copy of the lesson via a ref.
- PDF version shows MCQs with the answer key at the end and videos as links (iframes can't be captured by html2canvas).
- `html2canvas(node, { scale: 2, useCORS: true })` → slice the tall canvas into A4-height pages → `jsPDF.addImage` per page → `save("<lesson-title>.pdf")`.
- Spinner on the button while exporting; lazy-load (`import()`) both libraries so they don't bloat the main bundle.
- Stretch: "Download whole module/course".
- **Done when:** a long lesson with code exports to a clean multi-page PDF with no cut lines mid-text (add page-break padding between blocks if needed).

### Phase 9 — Hinglish audio explanation (Days 11–12) · Milestone 10

- `tts.service.js`:
  1. Build a narration script from the lesson's headings/paragraphs (skip code and MCQs), capped in length.
  2. Gemini text call: "rewrite as a friendly Hinglish explanation (Hindi in Roman script mixed with English technical terms)".
  3. Gemini TTS model (name in `GEMINI_TTS_MODEL` env) with a chosen `voiceName`.
  4. Gemini returns raw PCM (24 kHz, 16-bit, mono) → `utils/wav.js` prepends a 44-byte WAV header → send as `audio/wav`.
- Cache the result (GridFS or a `Buffer` field on the lesson, keyed by language) so each lesson is generated once.
- `AudioExplainButton`: "🎧 Explain in Hinglish" → loading → `<audio controls>` + download link. Language dropdown designed to accept Hindi/Tamil later.
- **Done when:** a lesson plays a natural Hinglish explanation, and the second play is instant.

### Phase 10 — CI/CD & production hardening (Day 12) · Milestone 12

- `.github/workflows/ci.yml`: on every PR and push to `main` → install, lint, test, build, for `client` and `server` (matrix or two jobs, npm cache).
- Branch protection on `main`: CI must pass before merge.
- Vercel: auto-deploys `main` + preview deploys per PR; `vercel.json` SPA rewrite so deep links like `/courses/…/lesson/2` don't 404.
- Render: auto-deploy on `main`; health check path `/api/health`.
- Production checks: CORS allow-list, Helmet, request body size limit, no stack traces in prod errors, all secrets only in dashboards.
- **Done when:** merging a PR deploys both apps automatically and the live site passes a full manual run-through.

### Phase 11 — Creativity extras (Day 13, pick what time allows)

Ranked by impact per hour:

1. **Progress tracking** — mark lessons complete, progress bar per course, quiz scores saved (the resume bullets mention progress tracking).
2. **Dark mode** (cheap if Tailwind is set up for it from day 1).
3. **Difficulty / audience selector** (beginner / intermediate / advanced) fed into the prompts.
4. **Shareable public course link** (read-only, `isPublic` flag).
5. **Regenerate lesson** button.
6. **Export full course as PDF**.

### Phase 12 — Documentation & demo (Day 14) · Milestone 13

- README: one-line pitch, live links, screenshots/GIF, feature list, architecture diagram, tech stack, API table, data model, local setup (`.env.example`), deploy steps, design decisions (lazy generation, Zod validation, caching), known limitations, future work.
- Demo video (5 min):
  - 0:00–0:30 problem and pitch
  - 0:30–2:30 live flow: login → prompt → outline → open lesson (video, code, quiz) → Hinglish audio → PDF download
  - 2:30–4:30 code walkthrough: folder structure, prompt + Zod pipeline, lazy enrichment, auth middleware, LessonRenderer, CI
  - 4:30–5:00 what I'd add next
- Warm up the Render server before recording; pre-generate one showcase course as a fallback in case the AI is slow on camera.

---

## 5. Risks & mitigations

| Risk                                                                                         | Mitigation                                                                                                            |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| AI returns invalid/partial JSON                                                              | JSON response mode + Zod validation + one retry with the error message + clean 502 to UI with "Try again"             |
| Generation is slow                                                                           | Two-stage lazy generation; progress messages; server-side timeouts                                                    |
| API quotas (Gemini, YouTube)                                                                 | Rate limits per user, Mongo caching of videos and audio, lessons generated only when opened                           |
| Render cold starts                                                                           | Health ping on app load, "waking server" message, warm-up before demo                                                 |
| Auth0 misconfiguration (most common: wrong audience → opaque token, or missing callback URL) | Set `audience` on the frontend provider; list every URL (localhost + Vercel) in Auth0 settings; test early in Phase 6 |
| Secrets leaking                                                                              | `.env` git-ignored from commit #1; no keys in `VITE_` vars except Auth0 domain/client ID (which are public by design) |
| html2canvas can't capture iframes / cross-origin images                                      | Dedicated print layout that replaces videos with links                                                                |

---

## 6. Definition of done (submission checklist)

- [ ] Topic → course with 3–6 modules × 3–5 lessons, each lesson has objectives, key topics, content, video, MCQs, resources
- [ ] Courses persist per user and can be reopened/deleted
- [ ] Auth0 login/logout; protected API
- [ ] YouTube videos embedded
- [ ] Lesson PDF download
- [ ] Hinglish audio explanation
- [ ] Responsive, with loading and error states everywhere
- [ ] Live frontend + backend URLs work from a fresh browser
- [ ] CI green; history shows feature branches + PRs
- [ ] README complete; 5-minute video recorded
