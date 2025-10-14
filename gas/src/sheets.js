/**
 * sheets.js
 * スプレッドシートへのI/O操作を担当
 */

const SHEET_ID = PropertiesService.getScriptProperties().getProperty('SHEET_ID');

/**
 * Draftsシートから未投稿の承認済みドラフトを取得
 * @returns {Array} [{id, content, approved, postedAt, rowIndex}, ...]
 */
function getApprovedDrafts() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Drafts');
  const data = sheet.getDataRange().getValues();

  const drafts = [];
  for (let i = 1; i < data.length; i++) { // ヘッダー行スキップ
    const [id, content, approved, postedAt] = data[i];
    if (approved === true && !postedAt) {
      drafts.push({
        id: id,
        content: content,
        approved: approved,
        postedAt: postedAt,
        rowIndex: i + 1
      });
    }
  }
  return drafts;
}

/**
 * 投稿完了時刻をDraftsシートに記録
 * @param {number} rowIndex - 行番号(1-indexed)
 * @param {Date} timestamp - 投稿時刻
 */
function markAsPosted(rowIndex, timestamp) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Drafts');
  sheet.getRange(rowIndex, 4).setValue(timestamp); // D列: postedAt
}

/**
 * Candidatesシートから候補ニュースを取得
 * @returns {Array} [{title, url, summary}, ...]
 */
function getCandidates() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Candidates');
  const data = sheet.getDataRange().getValues();

  const candidates = [];
  for (let i = 1; i < data.length; i++) {
    const [title, url, summary] = data[i];
    if (title) {
      candidates.push({ title, url, summary });
    }
  }
  return candidates;
}

/**
 * Candidatesシートに新規候補を追加
 * @param {Array} candidates - [{title, url, summary}, ...]
 */
function appendCandidates(candidates) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Candidates');

  candidates.forEach(c => {
    sheet.appendRow([c.title, c.url, c.summary || '']);
  });
}

/**
 * Draftsシートに新規ドラフトを追加
 * @param {string} content - ドラフト本文
 * @returns {string} 生成されたID
 */
function appendDraft(content) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Drafts');
  const id = Utilities.getUuid();
  sheet.appendRow([id, content, false, '']); // approved=false, postedAt=empty
  return id;
}

/**
 * Logsシートにログを記録
 * @param {string} level - ログレベル (INFO, ERROR, etc.)
 * @param {string} message - ログメッセージ
 * @param {Object} metadata - 追加情報
 */
function writeLog(level, message, metadata = {}) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Logs');
  const timestamp = new Date();
  sheet.appendRow([timestamp, level, message, JSON.stringify(metadata)]);
}
