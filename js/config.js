// =====================================================
// config.js — AAA Election System Configuration
// Replace the APPS_SCRIPT_URL with your deployed URL
// =====================================================

const CONFIG = {
  // 🔗 IMPORTANT: Replace this with your deployed Google Apps Script Web App URL
  // After deploying (see README), copy the /exec URL here
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxMirwqB12b3of3SMGuH8LuzeLagKcgi2Mpw7t3VHsR9rsm_7W4MfOzoYhSI0kz1dWn/exec",

  // Election details (also editable in index.html)
  ELECTION_TITLE: "AAA Officers Election 2025",
  ELECTION_PERIOD: "June 2–6, 2025",
  VOTING_HOURS: "8:00 AM – 5:00 PM",

  // Email domain restriction
  ALLOWED_EMAIL_DOMAIN: "@sjp2cd.edu.ph",

  // Set to true to use SAMPLE DATA (no Google Sheets needed)
  // Set to false to use real Google Sheets data
  USE_SAMPLE_DATA: false,
};
