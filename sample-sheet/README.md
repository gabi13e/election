# Google Sheets Sample

Use these CSV files to create the three required tabs for the election system.

Files:
- `Voters.csv`
- `Candidates.csv`
- `Votes.csv`

Google Sheets setup:
1. Create a new Google Sheet.
2. Rename the first tab to `Voters`, then import `sample-sheet/Voters.csv`.
3. Add a second tab named `Candidates`, then import `sample-sheet/Candidates.csv`.
4. Add a third tab named `Votes`, then import `sample-sheet/Votes.csv`.
5. Keep the tab names exactly as `Voters`, `Candidates`, and `Votes`.

Notes:
- `eligible` and `has_voted` should remain `TRUE`/`FALSE`.
- Leave `party` blank for independent candidates.
- Leave `photo_url` blank if you do not want to use candidate photos.
- The `Votes` sheet should start empty except for the header row.
