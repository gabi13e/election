# AAA Election System — Setup Guide

## Project Structure
```
aaa-election/
├── index.html          # Main HTML file (all pages)
├── css/
│   └── style.css       # All styles
├── js/
│   ├── config.js       # 🔧 Configuration (edit this!)
│   ├── data.js         # Sample data for testing
│   └── app.js          # Main application logic
├── Code.gs             # Google Apps Script backend
└── README.md           # This file
```

---

## PHASE 1 — Testing Locally (No Google Sheets)

1. Open `index.html` in any browser.
2. In `js/config.js`, make sure `USE_SAMPLE_DATA: true` (it already is).
3. Use these test credentials to verify:

| Student ID   | School Email                     | Status        |
|-------------|----------------------------------|---------------|
| 2021-00101  | m.santos@sjp2cd.edu.ph           | ✅ Can vote   |
| 2022-00202  | j.delacruz@sjp2cd.edu.ph         | ✅ Can vote   |
| 2023-00303  | a.reyes@sjp2cd.edu.ph            | ✅ Can vote   |
| 2020-00404  | c.mendoza@sjp2cd.edu.ph          | ❌ Already voted |

---

## PHASE 2 — Connect Google Sheets

### Step 1: Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet.
2. Rename it: **AAA Election 2025**
3. Create 3 sheets (tabs) with these exact names:

**Sheet 1: `Voters`**
| student_id | full_name | school_email | course | year_level | eligible | has_voted | voted_at |
|---|---|---|---|---|---|---|---|
| 2021-00101 | Maria Santos | m.santos@sjp2cd.edu.ph | BSIT | 4th Year | TRUE | FALSE | |
| 2022-00202 | Juan dela Cruz | j.delacruz@sjp2cd.edu.ph | BSCS | 3rd Year | TRUE | FALSE | |
*(add all your voters here)*

**Sheet 2: `Candidates`**
| candidate_id | full_name | position | course | year_level | platform | photo_url |
|---|---|---|---|---|---|---|
| C001 | Ramon Aquino | President | BSIT | 4th Year | Platform text here | https://... or leave blank |
*(add all your candidates here)*

**Sheet 3: `Votes`**
| vote_id | student_id | position | candidate_id | timestamp | reference_number |
|---|---|---|---|---|---|
*(leave empty — the system fills this)*

### Step 2: Set Up Google Apps Script

1. In your Google Sheet, click **Extensions → Apps Script**
2. Delete all default code in `Code.gs`
3. Paste the entire contents of `Code.gs` from this project
4. Replace `YOUR_SPREADSHEET_ID_HERE` with your Sheet's ID
   - Your Sheet URL: `https://docs.google.com/spreadsheets/d/`**`THIS_IS_YOUR_ID`**`/edit`
5. Click **Save** (💾)

### Step 3: Deploy as Web App

1. Click **Deploy → New deployment**
2. Click the gear icon next to "Select type" → choose **Web app**
3. Set:
   - **Description**: AAA Election API
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone *(important — allows the website to connect)*
4. Click **Deploy**
5. Click **Authorize access** and grant permissions
6. Copy the **Web app URL** (ends in `/exec`)

### Step 4: Update config.js

Open `js/config.js` and update:
```javascript
APPS_SCRIPT_URL: "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec",
USE_SAMPLE_DATA: false,  // ← Change this to false
```

---

## PHASE 3 — Deploy the Website

### Option A: GitHub Pages (Free, Recommended)
1. Create a new GitHub repository (public)
2. Upload all files in `aaa-election/` to the repo
3. Go to **Settings → Pages → Branch: main → Save**
4. Your site will be live at: `https://yourusername.github.io/aaa-election`

### Option B: Netlify (Free, Drag & Drop)
1. Go to [netlify.com](https://netlify.com) and sign up
2. Drag your `aaa-election/` folder to the dashboard
3. Done — you'll get a live URL instantly

### Option C: Any web host
Just upload all files in `aaa-election/` to your hosting provider's public folder (e.g., `public_html`).

---

## Adding Candidate Photos

In the `Candidates` sheet, add image URLs in the `photo_url` column.
Options:
- **Google Drive**: Upload image → right-click → Get link → change `...sharing` to `...uc?export=view&id=FILE_ID`
- **Imgur**: Upload image → copy direct link (ends in `.jpg` or `.png`)
- Leave blank for auto-generated initials placeholder

---

## Security Notes

- The system validates Student ID + email match from the masterlist
- `eligible = TRUE` must be set per voter (prevents ineligible access)
- `has_voted` is checked both client-side and server-side
- `LockService` prevents double-vote race conditions on the server
- Email domain is restricted to `@sjp2cd.edu.ph` (both client and server validate)

---

## Customization

| What to change | Where |
|---|---|
| Election title, dates | `index.html` (hero section) + `js/config.js` |
| Email domain | `js/config.js` → `ALLOWED_EMAIL_DOMAIN` |
| Colors | `css/style.css` → `:root` CSS variables |
| Organization name | `index.html` header + footer |

---

## Troubleshooting

**"No matching record found"**: Check that the voter row has `eligible = TRUE` and the student_id/email match exactly (no extra spaces).

**CORS error when connecting to Apps Script**: Make sure the deployment is set to "Anyone can access" (not "Anyone with Google account").

**Votes not saving**: Re-deploy the Apps Script after any code changes (Deploy → Manage deployments → Edit → Deploy new version).
