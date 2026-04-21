# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AAA Election System** — A static web app for the Association Of All Achievers student organization at St. John Paul II College of Davao City. Voters verify identity via Student ID + school email, then cast one vote per position. The backend is a Google Apps Script Web App connected to a Google Sheet.

## Development

No build system or package manager. Open `index.html` directly in a browser — no server required.

**To test locally (no Google Sheets needed):** Set `USE_SAMPLE_DATA: true` in `js/config.js`. Test credentials are in `README.md` and `js/data.js`.

**To connect real data:** Set `USE_SAMPLE_DATA: false` and update `APPS_SCRIPT_URL` in `js/config.js` with the deployed Apps Script URL. After any changes to `Code.gs`, redeploy via Google Apps Script (Deploy → Manage deployments → new version).

## Architecture

The app is a single `index.html` with six `<section>` "steps" (only one visible at a time via `.active` CSS class). Navigation is driven by `goToStep(stepId)` in `js/app.js`.

**Flow:** Landing → Voter Verification → Candidates Preview → Ballot → Review → Success

### Key files

| File | Role |
|------|------|
| `js/config.js` | `CONFIG` object: Apps Script URL, email domain, `USE_SAMPLE_DATA` flag |
| `js/data.js` | `SAMPLE_DATA` — hardcoded voters and candidates for local testing |
| `js/app.js` | All UI logic and `STATE` object |
| `Code.gs` | Google Apps Script backend — runs `doGet` (verify, getCandidates) and `doPost` (submitVote) |
| `css/style.css` | All styles; CSS variables in `:root` control the color theme |

### State management (`js/app.js`)

`STATE` is a module-level object holding:
- `currentVoter` — voter record after verification
- `candidates` / `positions` — loaded once on DOMContentLoaded, cached
- `votes` — `{ position: candidate_id }` map built as voter clicks ballot options
- `isVerified` — gates access to the ballot step

### Google Sheets schema

**Voters sheet** columns: `student_id, full_name, school_email, course, year_level, eligible, has_voted, voted_at`

**Candidates sheet** columns: `candidate_id, full_name, position, course, year_level, party, platform, photo_url`

**Votes sheet** columns: `vote_id, student_id, position, candidate_id, timestamp, reference_number` (auto-populated)

### Backend (Code.gs) notes

- `LockService` is used in `submitVote` to prevent concurrent double-votes
- Voter eligibility and `has_voted` are checked server-side even though the client also checks — the server is authoritative
- `SPREADSHEET_ID` must be replaced before deployment; `SHEETS` constants must match sheet tab names exactly

## Configuration

All runtime configuration lives in `js/config.js` (`CONFIG` object). Do not hardcode the Apps Script URL or email domain elsewhere — read from `CONFIG`.

Candidate photos can be Google Drive direct links or Imgur URLs; `photo_url` can be empty (initials placeholder renders automatically).
