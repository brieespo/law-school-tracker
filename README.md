# Law School Command Center

Personal law school tracking app for Bri — degree audit, semester planning, and (coming) a merged
Google Calendar agenda, study planner, and milestone tracker. Sibling app to the
[dinner planner](https://github.com/brieespo/dinner-planner): pure HTML + CSS + vanilla JS, one file,
no build step.

**Live app:** https://brieespo.github.io/law-school-tracker/

## What works today

- **Agenda** — merged view of the next 14 days across your Google Calendars (read-only,
  client-side OAuth), color-coded by calendar, with per-calendar toggles. The note-writing
  stage banner sits on top. First use walks through the one-time Google Cloud setup in-app.
- **Note Tracker** — the Volume 65 note-writing roadmap as a stage stepper: current month
  highlighted, guiding question, and a countdown to the next checkpoint.
- **Supabase sync** — sign in with the same account as the dinner planner; guest mode keeps
  data in the browser.

- **Degree Audit** — progress meters for every requirement bucket (1L, core 18, PR, perspective,
  experiential/live-client, 90 total hours), limit-rule warnings (25 restricted / 30 online /
  4 independent study / 7 journal caps), and a "gaps in the current plan" panel with the
  May 2028 verdict and required per-semester pace.
- **Semester Planner** — semesters as columns (completed ones locked at left), a course catalog
  seeded with the full core-course menu, drag-and-drop (or tap-to-assign on mobile), live hour
  totals and audit recalculation, saved scenarios with side-by-side compare.
- **Courses** — the full transcript + plan, with one-tap status changes (the pending Fall 2026
  drop is a "Drop" button on the course card in the planner, or a status change here).
- Seeded from the course list embedded in the app (names, hours, semesters — no grades; those
  live only in each user's private account row).

Data is stored in the browser (`localStorage`) behind a small adapter — Supabase auth + sync
replaces the adapter next, then the Google Calendar integration (see `CLAUDE.md` for the full plan
and build phases).

## Files

| file | purpose |
|---|---|
| `law-school.html` | the entire app |
| `index.html` | always an exact copy of `law-school.html` (GitHub Pages entry point) |
| `CLAUDE.md` | full planning doc / requirements |

## Google Calendar setup (one-time)

The Agenda tab walks through this in-app. In short:

1. [Google Cloud Console](https://console.cloud.google.com) → new project → enable **Google Calendar API**
   (APIs & Services → Library).
2. **Google Auth Platform** → Get started: app name + support email → Audience: **External** →
   contact email → Create.
3. Google Auth Platform → Audience → Test users → add `brieespo@gmail.com`.
4. Google Auth Platform → Clients → Create client → **Web application**; authorized JavaScript
   origins: `https://brieespo.github.io` (plus `http://localhost:8742` if testing locally — the
   port matters).
5. Paste the client ID into the Agenda tab and click Connect. The token is held in memory
   only (never stored); the client ID is saved in settings and syncs with your account.
