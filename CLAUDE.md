# Law School Command Center — Planning Doc / CLAUDE.md

Planning document for a personal law school tracking web app. Drop into a new repo as `CLAUDE.md` for Claude Code to build from. Sibling app to the dinner planner and perfume tracker; will eventually be linked from a personal hub site.

## Who this is for

Bri — law student at Brandeis School of Law (University of Louisville), Law Review Volume 65 staff editor, matriculated under the Fall-2024-and-later graduation requirements. Currently juggling: a handwritten-notes → Google Drive/NotebookLM outline workflow, Law Review deadlines (note-writing program + editing schedule), graduation credit requirements, and long-horizon milestones (MPRE, bar exam). Real data sources: several purpose-built Google Calendars, the school's graduation checklist, and Law Review's published schedules.

## The three jobs of this app

1. **Degree audit** — am I on track to graduate? Which requirement buckets are filled, which aren't, and does my planned schedule close every gap?
2. **Unified agenda** — one screen merging classes, Law Review deadlines, and assignments from her existing Google Calendars (read, not re-enter).
3. **Milestone planner** — long-horizon items (MPRE, bar exam, bar prep purchase, degree application) with automatic backdated lead-time reminders.

## Tech stack — match the dinner planner exactly

Same conventions as github.com/brieespo/dinner-planner (see its CLAUDE.md):

- Pure HTML + CSS + vanilla JS, one file (`law-school.html`), `index.html` always a copy. No frameworks, no build step.
- Supabase for auth + storage (Bri has an account).
- GitHub Pages + same Actions deploy workflow.
- CSS-variable theming, card-based UI, mobile-friendly.
- **Allowed external scripts:** Supabase client + Google Identity Services (`accounts.google.com/gsi/client`) for the Calendar integration below. Nothing else.

## Google Calendar integration (core feature, not stretch)

Bri's calendar is already the source of truth for scheduled items. The app reads it directly — client-side, no server needed:

1. One-time setup (document in README, walk Bri through it): Google Cloud Console → new project → enable Calendar API → OAuth consent screen (External, add her account as test user) → OAuth 2.0 Client ID (Web application; authorized JS origins: the GitHub Pages URL + `http://localhost` for testing).
2. In-app: Google Identity Services token client, scope `https://www.googleapis.com/auth/calendar.readonly` to start. "Connect Google Calendar" button; token held in memory, silently re-requested as needed.
3. Fetch events from her relevant calendars. Known calendar names (resolve IDs via the CalendarList endpoint at runtime rather than hardcoding): **Law School Schedule** (in-person classes), **Online Law School Classes**, **Law Review** (deadlines), **Assignments**, plus personal ones (Bri, Appointments, Bills, Sloane) that should be toggleable in settings, default off for this app.
4. Phase 2 upgrade: `calendar.events` scope so the milestone planner can *write* events/reminders (e.g., "Register for MPRE") into a calendar. Create an app-owned calendar ("Law School App") rather than writing into her curated ones.

Do not build class-schedule CRUD in the app — the calendars already do that job. The app adds the layers Google Calendar can't: requirement math, milestone backdating, and a single merged agenda.

## Data model (Supabase)

Dinner-planner pattern: one row per user in `law_school_data` with jsonb columns:

| column | contents |
|---|---|
| courses | array of course objects (taken + planned) |
| milestones | array of milestone objects |
| public_service_log | array of {date, hours, description} |
| settings | calendar toggles, target grad date, etc. |

### Course object

```js
{
  id: 1,
  name: "Evidence",
  hours: 4,
  semester: "Fall 2026",          // free-form label; sortable via a semester order list
  status: "planned",              // 'completed' | 'in_progress' | 'planned'
  grade: null,                    // optional
  buckets: ["core"],              // which requirement buckets it satisfies (see engine below)
  live_client: false, online: false, non_law: false, independent_study: false, journal_credit: false
}
```

### Requirements engine (seed data — from the official checklist)

Hardcode the requirement structure as a `REQUIREMENTS` constant; the audit screen computes fill state from the courses array:

- **1L required (30 hrs):** Contracts 4, Torts 4, Civ Pro 4, Lawyering Skills I 3, Con Law I 4, Property 4, Crim Law 3, Lawyering Skills II 3, Professional Identity 1. (Checklist UI: mark done as a block — presumably all completed.)
- **Core courses (≥18 hrs):** Advanced Civ Pro 3, Business Organizations 4, Commercial Law 3, Con Law II 3, Crim Pro: Constitutional Issues 3, Crim Pro: Judicial Process 3, Decedents' Estates & Trusts 3–4, Evidence 4, Family Law 3, Products Liability 3, Real Estate Transactions 3. Overflow counts toward the 90.
- **Other required:** Professional Responsibility 3 (and the MPRE itself — surfaced as a milestone, not a course); Perspective course 2–3; ULWR 1 — **CONFIRMED satisfied via Law Review membership** (seed as met).
- **Experiential (≥6 hrs, ≥2 live client):** live client 2–6 hrs (externship/clinic/"Experiential Live Client"); simulation 0–4 hrs; live client + simulation ≥ 6.
- **Other graduation requirements:** ≥90 *earned* hours; ≥30 public service hours; degree application + graduation forms; graduate info + employment surveys.
- **Limit rules (audit should warn when approached):** ≤25 combined non-Law/live-client/moot-court/independent-study/journal hrs; ≤30 transfer hrs; ≤30 online hrs; ≤4 independent study hrs; ≤1 ULWR; ≤7 journal credit hrs; moot court ≠ experiential credit.

The audit screen: a progress bar per bucket, a warnings panel for limit rules (e.g., "You're at 22/25 combined restricted hours"), and a "what's still missing if I take my currently planned schedule" projection through the target graduation date.

### Milestone object & backdating

```js
{
  id: 1,
  name: "MPRE",
  date: "2027-03-27",             // user-entered target date
  lead_tasks: [                    // auto-generated child deadlines, editable
    {label: "Register for MPRE", days_before: 60},
    {label: "Start MPRE prep (free Barbri/Themis course)", days_before: 30}
  ],
  status: "planned", notes: ""
}
```

Ship with milestone templates (dates entered/confirmed by Bri, since exact administrations change yearly — the app must not hardcode them):

- **MPRE — target: August 2027 (Bri's decision, don't suggest earlier).** Rationale: she's pursuing **Indiana** licensure, and she understands Indiana's MPRE score validity to be ~2 years. Taking it August 2027 keeps the score valid through roughly August 2029 — covering the July 2028 bar *plus* a February 2029 retake without pressure. An earlier MPRE would shrink that safety window. Lead tasks: register (~60 days out), prep (~30 days out). App note: surface "verify current Indiana MPRE score-validity rule" as a lead task too — these rules change and the exact window (e.g., measured to application vs. admission) should be confirmed on the Indiana Board of Law Examiners site when registering.
- **Bar exam — Indiana, July 2028** (assuming May 2028 graduation). Indiana runs its own exam (not UBE as of last check — verify format and dates on the Indiana BLE site during 3L). Lead tasks: bar application (~120–150 days out; Indiana character & fitness paperwork is slow and has an early-filing discount window — verify), buy bar prep course (fall 3L for discounts/payment plans), bar prep course begins (~late May 2028).
- **Degree application / graduation forms** — per checklist; school announces the deadline.
- **Public service hours** — not date-based; audit tracks 30-hour progress from the log.

### Law Review layer

Her Law Review Google Calendar already contains the Volume 65 note-writing checkpoints and staff-editor editing schedule (verified: topic selection essay Aug 10, research prospectus Sep 6, lit review/gap analysis Oct 18, analytical framework Nov 24, rough draft Jan 3, complete first draft Jan 29, final note Mar 5; plus five editing cycles with assignment → first half → second half dates). The app reads these from the calendar rather than duplicating them.

Add one thing on top: a **note-writing progress tracker** — the roadmap's monthly stages (Jul: topic exploration → Aug: scholarly conversation → Sep: prospectus → Oct: lit review → Nov: framework → Dec: exams/reflect → Jan: first draft → Feb: revise → Mar: final) rendered as a stage stepper with her current stage, the guiding question for the month ("What conversation do I want to join?"), and days until next checkpoint.

## Study schedule planner (user-requested, high priority around finals)

A fourth job for the app: turn "finals are coming" into a concrete day-by-day plan.

**Finals mode** (the headline feature):

1. Bri enters her exam dates each semester (or picks them off the merged calendar).
2. She sets a study-start date and her available blocks (e.g., weekday evenings, weekend mornings — a simple weekly availability grid, remembered between semesters).
3. The planner generates a backward-planned schedule from each exam: study sessions distributed across courses, **weighted by credit hours and a per-course "confidence" slider** (shaky course = more blocks), with heavier weighting toward each course as its exam approaches (spaced early, focused late).
4. It avoids known conflicts: class times and Law Review deadlines from the calendars. Pass/fail courses (Professional Identity-style, KIP) get minimal or no blocks by default.
5. Output: a week-grid of labeled study blocks ("Evidence — outline review", "Crim Pro CI — practice questions") that can be checked off; skipped blocks roll forward and the plan rebalances.
6. Session types per course, simple and configurable: outline building → outline review → practice questions/essays. Early blocks default to outlining, late blocks to practice.

**Semester mode** (lighter, always on): recurring weekly study/reading blocks per course in the availability grid, plus an **outline tracker** — per-course status (not started / in progress / exam-ready) with a link field to her Google Drive/NotebookLM outline. The outline tracker feeds finals mode: courses without an exam-ready outline get outline-building blocks first.

Phase 3 upgrade: write study blocks to the app-owned Google Calendar alongside milestone reminders.

## Screens

1. **Today / Agenda** — merged view of the next 7–14 days across selected calendars, color-coded by source; note-writing stage banner at top; today's study blocks inline once the study planner exists.
2. **Degree Audit** — bucket progress bars, limit-rule warnings.
3. **Semester Planner** — the what-if sandbox; Bri's most-wanted feature. Design requirements:
   - Semesters as columns (Spring 2027 → Spring 2028, plus optional summer columns), completed/in-progress semesters shown locked at left for context.
   - A **course catalog panel**: seeded with the full core-course menu from the requirements engine, plus slots for Perspective/simulation/elective courses; Bri can add any course with name + hours + bucket tags. Catalog courses are **dragged in and out of semester columns** freely (tap-to-assign on mobile).
   - **Live recalculation on every change**: each column shows its hour total (warn under 12 or over the school's max), and the audit sidebar re-renders — bucket progress, limit-rule warnings, and the headline "on pace to graduate May 2028: yes/no, N hrs short."
   - **Saved scenarios**: save a full plan under a name ("Drop PR version", "Summer class version"), reload or duplicate any of them, and a compare view showing two scenarios' audit outcomes side by side. Reuse the dinner planner's Saved Menus pattern — same interaction, same storage approach (a `_savedPlans` key in settings).
   - Moving a course into a semester never touches the transcript-derived data; completed courses are immutable facts, planned courses are freely tradeable.

   This answers "how do I plan the next 2 years to hit everything."
4. **Study Planner** — availability grid, finals-mode generator, outline tracker (above).
5. **Milestones** — timeline view from today through bar exam, with lead tasks and (Phase 2) push-to-Google-Calendar.
6. **Note Tracker** — the stage stepper above.

## Seed data: transcript

Course history from her unofficial transcript (printed 2026-07-09) is embedded as the `SEED` constant in `law-school.html`. **Privacy rule: grades and GPA never go in this repo** — they live only in Bri's private Supabase row (or can be re-entered/imported in-app). The seed carries course names, hours, semesters, and statuses only. Summary:

- **1L complete:** all 30 required 1L hours earned (Fall 2025 + Spring 2026).
- **Fall 2026 enrolled (15 hrs):** Evidence 4 (core, M/W 10:20 rm 175), Crim Pro: Constitutional Issues 3 (core, online Tue/Thu 8:30), Crim Pro: Judicial Process 3 (core — on transcript but NOT on her calendars; likely async — flag for her to confirm/add), Professional Responsibility 3 (online Tue/Thu 10:20), KY Innocence Project Clinic I 2 (Experiential Live Client, pass/fail, Tue 12:15).
- **Public Service Requirement: already COMPLETED** (non-course milestone on transcript). The audit shows it as done; the public service log feature is unnecessary for her but harmless to keep for the data model.

### Audit state the app should reproduce (as of Fall 2026 enrollment, assuming passes)

- Earned hours: 45 of 90 → **45 remaining across exactly 3 semesters (Spring 27, Fall 27, Spring 28) = 15 hrs/semester with zero slack.** The semester planner should make this "required pace" number prominent; a light semester anywhere must be offset elsewhere or by summer courses.
- Core: 10 of 18 → 8 hrs remaining.
- Professional Responsibility: done after Fall 2026 → MPRE unblocked for March 2027.
- Live client: 2 of 2 → satisfied. **KIP confirmed** (per the school's pre-approved live client course list): Criminal Justice Externship, designated Experiential **Live Client** (matches transcript attribute), **full-year course** — LAW 900 fall + LAW 901 spring, 2 cr hrs each, pass/fail, 30 fieldwork hrs required, Tuesday 12:15–2:15 classroom component. Completing the full year = 4 experiential/live-client hrs, leaving **2 experiential hrs** to schedule (simulation, or more live client up to the 6-hr live-client max). KIP hours also count toward the ≤25 combined restricted-hours cap — audit should include them there.
- ULWR: **satisfied via Law Review membership** — seed as complete.
- Still unscheduled: Perspective course (2–3), 2 experiential hrs, ~34 hrs of electives/overflow.

### Pending schedule change (important for seeding)

Bri plans to **drop one Fall 2026 class** — either Crim Pro: Judicial Process or Professional Responsibility (decision pending; seed both as enrolled, make status changes one-tap). Either drop has the same hours math: fall becomes 12 hrs → 42 earned after fall → **48 hrs over 3 remaining semesters = 16/semester average** (or a summer course to relieve it). The difference between the options:

- **Drop Crim Pro JP:** core becomes 7 of 18 (11 remaining — fine, core is a menu with many options). JP can be retaken any semester; it's not individually required.
- **Drop PR:** core stays 10 of 18. PR is individually required and gates the MPRE — but since Bri has locked the MPRE target to **August 2027** (see Milestones), retaking PR in Spring 2027 costs nothing: it still completes well before the August 2027 MPRE. Her MPRE timing decision removes the main argument for keeping PR this fall.

Net: with an August 2027 MPRE, the two drops are close to equivalent requirements-wise; the decision can rest on workload, professors, and which course she'd rather take later.

The app's semester planner should model both scenarios; the audit updates whichever she drops.
- Online hours so far: ~6 of 30 cap.

## Build phases

1. **Phase 1:** auth, course list + requirements engine + degree audit screen, semester planner. (Works before any calendar connection.)
2. **Phase 2:** Google Calendar read integration + merged agenda; note-writing stage tracker; **study planner** (availability grid + finals-mode generator + outline tracker) — built after calendar read so it can avoid class/deadline conflicts. Fall 2026 finals are the first real test; have it usable by mid-November 2026.
3. **Phase 3:** milestones with backdated lead tasks; calendar write-back to an app-owned calendar (milestone reminders + study blocks).
4. **Phase 4:** polish — exportable audit summary (for registrar meetings), hub-site theming.

## Open items (need from Bri before/while building)

1. ~~How many journal credit *hours* (if any) does Law Review add to her transcript?~~ **ANSWERED (2026-07-09): 2 credit hours per semester — fall is 2 graded credits, spring is 1 graded + 1 pass/fail. Vol 65 year = 4 hrs total (Fall 2026 + Spring 2027), seeded as journal_credit courses; counts toward the 90, the ≤7 journal cap (4/7), and the ≤25 combined cap.**
2. **Which Fall 2026 class gets dropped** — Crim Pro: Judicial Process or Professional Responsibility (see Pending schedule change above).
3. Target: graduating May 2028? (Assumed throughout; the required-pace math depends on it.)
4. Exact MPRE/bar dates when registration opens — app treats all such dates as user-entered.

## Design language (suite-wide rules)

- **No emoji in UI chrome.** Buttons, menus, headers, tab labels use inline SVG line icons (Lucide/Feather style, open-licensed, pasted as inline <svg> with stroke="currentColor" so they tint via CSS variables). No icon library or CDN.
- **Status markers are CSS dots/chips** in the theme palette, never colored emoji.
- **One identity mark**: a single logo glyph in the header is the only decorative one on screen.
- Emoji is allowed in user-defined content (tags, notes) — data, not chrome.
- Warmth via accent colors, rounded cards, micro-copy voice — not decoration.

## Model escalation

If a task appears to exceed your ability — a fix has failed twice, architectural uncertainty, or a risky data-model change — say so explicitly and recommend rerunning on a more capable model (/model fable) instead of continuing to attempt it.
