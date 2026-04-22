# Google Sheets Sample

Use these CSV files to build a workbook that matches the current app:

- `Registered Voters.csv`
- `Voters.csv`
- `Candidates.csv`
- `Votes.csv`
- `Settings.csv`

Google Sheets setup:
1. Create a new Google Sheet.
2. Add a tab named `Registered Voters`, then import `sample-sheet/Registered Voters.csv`.
3. Add a tab named `Voters`, then import `sample-sheet/Voters.csv`.
4. Add a tab named `Candidates`, then import `sample-sheet/Candidates.csv`.
5. Add a tab named `Votes`, then import `sample-sheet/Votes.csv`.
6. Add a tab named `Settings`, then import `sample-sheet/Settings.csv`.

Notes:
- Keep the tab names exactly the same.
- `Voters` is the sheet used for voter verification.
- `Registered Voters` is the registration log used by the public form when present.
- Successful registrations are also mirrored into `Voters`.
- `Settings` is optional. If present, it is used for values like `election_active`.
- Admin credentials are no longer stored in the sheet. Configure them in Apps Script Script Properties.
- `eligible` and `has_voted` should remain `TRUE` or `FALSE`.
- Leave `party` blank for independent candidates.
- Leave `photo_url` blank if you do not want candidate photos.
- The `Votes` tab should start empty except for the header row.
