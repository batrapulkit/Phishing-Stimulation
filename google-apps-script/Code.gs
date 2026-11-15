/**
 * Spot the Phish – Google Sheet receiver
 *
 * Setup:
 * 1. Create a new Google Sheet. Extensions > Apps Script.
 * 2. Replace everything in Code.gs with this file.
 * 3. Change SECRET below to a random string (use the same value as SHEET_SECRET on Vercel).
 * 4. Deploy > New deployment > type "Web app"
 *      Execute as: Me
 *      Who has access: Anyone
 *    Authorize when asked, then copy the Web app URL (ends in /exec).
 * 5. Put that URL in Vercel as SHEET_WEBHOOK_URL.
 *
 * Two tabs are created automatically: "players" (sign-ups) and "results" (finished games).
 */

const SECRET = 'CHANGE-ME-to-a-long-random-string';

const HEADERS = {
  players: ['timestamp', 'name', 'email', 'phone', 'consent', 'user_agent'],
  results: ['timestamp', 'name', 'email', 'phone', 'score', 'phishing_missed', 'legit_reported', 'answers', 'user_agent'],
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.secret !== SECRET) return json({ ok: false, error: 'unauthorized' });

    const headers = HEADERS[data.type];
    if (!headers) return json({ ok: false, error: 'unknown type' });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000); // many webinar attendees submit at the same time
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName(data.type);
      if (!sheet) {
        sheet = ss.insertSheet(data.type);
        sheet.appendRow(headers);
        sheet.setFrozenRows(1);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      }
      const row = headers.map(h => (h === 'timestamp' ? new Date() : (data[h] || '')));
      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json({ ok: true, message: 'Spot the Phish sheet receiver is running.' });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
