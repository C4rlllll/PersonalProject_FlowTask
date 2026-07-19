# FlowTask — Personal Productivity Dashboard

A personal, distraction-light productivity dashboard with tasks, agenda,
a focus timer, and multi-phase goal tracking. Built as a private daily-use
tool — no login, no backend, no database.

---

## Features

- **Dashboard** — today's progress rings (tasks/habits/productivity),
  today's tasks (capped at 5), today's agenda, habit tracker, goals
  summary, and a rotating motivational quote.
- **Task Planner** (`task.html`) — schedule tasks for any day, set
  priority and status, view them grouped by week. Only tasks due today
  show up on the Dashboard.
- **Agenda Planner** (`agenda.html`) — schedule events for today or any
  day ahead, with optional descriptions and a done checkbox. Only
  today's items show on the Dashboard.
- **Focus** (`focus.html`) — a Pomodoro-style timer with two presets:
  - **Classic** — 25 min focus / 5 min break
  - **Exam Mode** — 25 min review / 5 min break / 15 min self-test / 15 min break
  Can be linked to a task from today's list — completing enough work
  sessions automatically marks that task as in-progress, then done.
- **Goals** (`goals.html`) — break a big goal into ordered phases
  (e.g. "Prep for Java: Fundamentals → OOP → Collections → Practice").
  Phases unlock one at a time — no skipping ahead.
- **Themes** — dark theme by default, plus two pink theme variants:
  - `style-pink.css` — dark, rose/berry palette
  - `style-lightpink.css` — light, pastel, Hello-Kitty-inspired palette

---

## Tech Stack

- Plain HTML, CSS, and vanilla JavaScript — no frameworks, no build step.
- Data is stored in the browser's `localStorage` via a single data-access
  layer (`common.js`), so the storage backend can later be swapped for a
  real API (e.g. MySQL + ASP.NET Core) without touching the UI code.

---

## File Structure

```
index.html       Dashboard
task.html        Task Planner
agenda.html      Agenda Planner
focus.html       Focus / Pomodoro timer
goals.html       Goals (multi-phase tracker)

common.js        Shared data layer (localStorage) + helper functions
script.js        Dashboard-only logic
task.js          Task Planner logic
agenda.js        Agenda Planner logic
focus.js         Focus page logic
goals.js         Goals page logic

style.css            Dark theme (default)
```

All HTML files load `common.js` first, then their own page-specific
script. Any of the three CSS files can be swapped in by changing the
`<link>` tag in each HTML file's `<head>`.

---

## How to Run

No installation or server required — just open `index.html` directly
in a browser.

---

## Data Storage

All data (tasks, agenda, habits, goals, stats) is saved in the
browser's `localStorage` under keys prefixed `flow.*`. This means:

- Data is local to the browser and device you're using — it won't
  sync across devices or browsers.
- Clearing site data / browser storage will reset the app back to its
  seed data.
- To fully reset the app during development, open DevTools → Console
  and run `localStorage.clear()`, then refresh.

---

## Known Limitations

- The Focus timer's live countdown state (current phase, seconds left,
  pause state) lives only in memory — refreshing the page mid-session
  resets it.
- No multi-device sync (by design, for now — see Future Ideas).

---

## Future Ideas

- Swap `localStorage` for a real backend (MySQL + ASP.NET Core) using
  the existing `DataStore` abstraction in `common.js`.
- Persist active Focus sessions across reloads.
- Notes and calendar view.
- User authentication, if this ever needs to support more than one person.
