# AAA Election System Setup Guide

## Project Structure
```text
aaa-election/
|-- index.html
|-- register.html
|-- css/
|   `-- style.css
|-- js/
|   |-- config.js
|   |-- data.js
|   |-- app.js
|   `-- admin.js
|-- Code.gs
`-- sample-sheet/
```

## Phase 1: Test Locally

1. Open `index.html` in a browser.
2. In `js/config.js`, set `USE_SAMPLE_DATA: true`.
3. Use the sample voters in `js/data.js` to verify the flow.

## Phase 2: Connect Google Sheets

### Step 1: Create the workbook

Create these tabs in Google Sheets:

**Sheet 1: `Registered Voters`**

| student_id | full_name | school_email | course | year_level |
|---|---|---|---|---|
| 2021-00101 | Maria Santos | m.santos@sjp2cd.edu.ph | BSIT | 4th Year |
| 2022-00202 | Juan dela Cruz | j.delacruz@sjp2cd.edu.ph | BSCS | 3rd Year |

Use this tab for registration submissions. Successful registrations are also mirrored into the `Voters` tab so the registrant can verify and vote.

**Sheet 2: `Voters`**

| student_id | full_name | school_email | course | year_level | scholarship_type | eligible | has_voted | voted_at |
|---|---|---|---|---|---|---|---|---|
| 2021-00101 | Maria Santos | m.santos@sjp2cd.edu.ph | BSIT | 4th Year | ACADEMIC SCHOLAR | TRUE | FALSE | |
| 2022-00202 | Juan dela Cruz | j.delacruz@sjp2cd.edu.ph | BSCS | 3rd Year | | TRUE | FALSE | |

This is the authoritative voter masterlist used for verification and vote locking.

**Sheet 3: `Candidates`**

| candidate_id | full_name | position | course | year_level | platform | photo_url | party |
|---|---|---|---|---|---|---|---|
| C001 | Ramon Aquino | President | BSIT | 4th Year | Platform text here | https://... | Lakbay Party List |

The column order above matches the current spreadsheet format. The backend reads candidates by header name, so extra columns are safe as long as the required headers stay the same.

**Sheet 4: `Votes`**

| vote_id | student_id | position | candidate_id | timestamp | reference_number |
|---|---|---|---|---|---|

Leave this tab empty except for the header row. The system appends one row per selected position.

**Sheet 5: `Settings`**

| key | value |
|---|---|
| election_active | TRUE |

This tab is optional. If present, it stores election settings such as `election_active`.

### Step 2: Set up Apps Script

1. Open the Google Sheet.
2. Go to `Extensions -> Apps Script`.
3. Replace the default script with the contents of `Code.gs`.
4. Replace `YOUR_SPREADSHEET_ID_HERE` in `Code.gs` with your spreadsheet ID.
5. In `Project Settings -> Script properties`, add:
   - `ADMIN_USERNAME`
   - `AUTH_SECRET`
   - either `ADMIN_PASSWORD_HASH` or `ADMIN_PASSWORD`
6. Save the project.

### Step 3: Deploy as a web app

1. Click `Deploy -> New deployment`.
2. Choose `Web app`.
3. Set `Execute as` to your account.
4. Set access to `Anyone`.
5. Deploy and copy the `/exec` URL.

### Step 4: Update `js/config.js`

```js
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec",
  USE_SAMPLE_DATA: false,
};
```

## Notes

- `eligible` must be `TRUE` in the `Voters` tab before a user can vote.
- `has_voted` and `voted_at` are updated automatically after a successful submission.
- `submitVote` uses `POST`; redeploy Apps Script after updating `Code.gs`.
- Admin login uses `POST` and signed expiring tokens.
- Do not store admin credentials in the spreadsheet.
- Candidate `photo_url` can be blank. The UI will render initials automatically.
- The frontend restricts emails to `@sjp2cd.edu.ph`.

## Troubleshooting

**No matching record found**

Check the `Voters` tab and confirm:
- `student_id` matches exactly
- `school_email` matches exactly
- `eligible` is `TRUE`
- `has_voted` is still `FALSE`

**Registration works but the voter still cannot log in**

Check that the registration row was added to `Voters` as well as `Registered Voters`, and confirm `eligible` is `TRUE`.

**Votes are not saving**

Redeploy the Apps Script web app after changing `Code.gs`, and confirm `js/config.js` points to the current deployment URL.

**Admin login says security is not configured**

Add these Apps Script Script Properties:
- `ADMIN_USERNAME`
- `AUTH_SECRET`
- `ADMIN_PASSWORD_HASH` or `ADMIN_PASSWORD`

If you want to store a hash instead of a plain password:
1. Set `AUTH_SECRET` first in Script Properties.
2. In Apps Script, edit `logAdminPasswordHashForSetup()` in `Code.gs` and replace the placeholder password.
3. Run `logAdminPasswordHashForSetup()`.
4. Copy the logged value into Script Properties as `ADMIN_PASSWORD_HASH`.
5. Remove any `ADMIN_PASSWORD` property if you created one earlier.
