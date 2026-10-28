# Demo video script (5 minutes)

The brief asks for a 5-minute video showing **the prompt input, the course generation flow and
an overview of the code architecture**. This script fits that into 5:00 with a little slack.
Speaking lines are suggestions; say them in your own words.

## Before recording (10 minutes)

- [ ] **Wake the server:** open the deployed site 2–3 minutes before (Render's free tier sleeps
      after 15 minutes idle).
- [ ] **Have a backup course ready:** keep one generated course, with a few lessons already opened,
      in case the AI is slow while recording. Delete half-finished test courses.
- [ ] **Pre-make one audio explanation** on the lesson you will show, so it plays instantly
      (creating one takes ~20 s; mention that it was made earlier).
- [ ] **Pick the demo topic** and type it once beforehand to check it generates well, e.g.
      "Basics of Copyright Law" or "Intro to SQL Joins".
- [ ] **Browser:** a clean window at 1280–1440 px wide, zoom 110–125%, bookmarks bar hidden, no
      other tabs. Log in before recording.
- [ ] **Editor:** open the files listed in part 4 in tabs, font size 16+.
- [ ] **Recorder:** QuickTime (File → New Screen Recording) or OBS at 1080p; test the microphone;
      silence notifications (Do Not Disturb).

## Timeline

### 0:00–0:25 · The problem and the idea

**Show:** the home page.

> "Learning a new topic usually means searching through many articles and videos.
> Text-to-Learn turns any topic into a structured course in seconds: modules, lessons, code,
> videos, quizzes, and even a Hinglish audio explanation. It's a MERN app with React, Express,
> MongoDB and Google Gemini."

### 0:25–1:20 · Prompt → course

**Do:** type the topic, choose a level, click **Generate course**. Point at the progress steps,
then the course page that opens.

> "I type a topic and pick a level. The server asks Gemini for an outline with a strict JSON
> Schema, validates the reply with Zod, and saves the course, modules and lessons to MongoDB.
> Lessons are written lazily, only when opened, so the outline is ready in a few seconds instead
> of minutes."

**Show:** modules and lessons, the progress bar, the sidebar outline.

### 1:20–2:30 · A lesson

**Do:** click **Start learning**. While it writes ("about 10 seconds"), explain:

> "Opening a lesson for the first time generates it: objectives, explanation, code, a video
> search query, a quiz and reading links. Invalid AI output is retried with the exact errors,
> and dead links are dropped."

Then scroll through:

- formatted text and **syntax-highlighted code** (click **Copy**),
- the **YouTube video** (click play for 2 seconds, then pause: "found on the server, cached for
  30 days because the free quota is small"),
- the **quiz**: answer two questions, one right and one wrong, to show the feedback. Finish it and
  point at "Score saved · lesson marked as complete" and the green tick in the sidebar.

### 2:30–3:10 · Hinglish audio, PDF and sharing

**Do (on the lesson made earlier):**

- **Explain in Hinglish**: play ~5 seconds, then open **Show transcript**.
  > "Gemini rewrites the lesson in Hinglish for students more comfortable in Hindi, and a
  > text-to-speech model reads it. The audio is stored, so it plays instantly next time."
- **Download PDF**: open the file and scroll through it quickly ("paginated A4, answer key at the
  end, links stay clickable").
- On the course page, click **Share**, then open the link in a private window: "read-only, no
  account needed".

### 3:10–4:35 · Code architecture

**Show:** the README architecture diagram, then the editor.

1. **Structure (15 s):** `client/` (React on Vercel) and `server/` (Express on Render);
   `routes → controllers → services` on the server.
2. **AI pipeline (30 s):** `server/src/prompts/schemas.js` (one Zod schema becomes Gemini's JSON
   Schema _and_ validates the reply), then `generateValidated` in
   `server/src/services/ai.service.js` (corrective retry, fallback model, clear error codes).
3. **Lazy generation (15 s):** `getOrGenerateLesson` in `server/src/services/lesson.service.js`:
   generated once, concurrent requests share one AI call.
4. **Rendering (15 s):** `client/src/components/LessonRenderer.jsx` maps each JSON block type to a
   component (`blocks/`).
5. **Security and quality (15 s):** `server/src/middlewares/auth.js` (Auth0 JWT verification),
   rate limits, then the CI workflow `.github/workflows/ci.yml` and the test counts (176 server +
   84 client tests).

### 4:35–5:00 · Wrap-up

> "So: topic to structured course, rich lessons with video and quizzes, Hinglish audio, PDF
> export, progress tracking and sharing, built with React, Express, MongoDB and Gemini, with
> tests and CI/CD. Next I'd add more languages and smaller audio files. Thanks for watching."

**Show:** the home page with your courses and the live URL.

## If something goes wrong while recording

| Problem                         | What to do                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------- |
| Generation is slow or fails     | Say "the AI is busy, here's one I generated earlier" and open the backup course. |
| "Waking up the server" banner   | Keep talking about the idea; it clears within a minute.                          |
| Video doesn't load              | Point at the "Watch on YouTube" fallback; that's the designed behaviour.         |
| Audio takes long the first time | Use the lesson whose audio you made beforehand.                                  |

## After recording

- [ ] Keep it under 5:00. Trim pauses; speed up waiting parts to 2× if needed.
- [ ] Upload (YouTube unlisted or Google Drive with link access) and add the link to the README.
- [ ] Add the live site and API URLs to the top of the README.
