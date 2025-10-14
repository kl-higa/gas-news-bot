/**
 * actions.js
 * Slackアクション（承認/却下）の処理
 */

/**
 * ドラフトを承認
 * @param {string} draftId
 * @returns {boolean}
 */
function approveDraft(draftId) {
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  const sheet = ss.getSheetByName('Drafts');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === draftId) {
      sheet.getRange(i + 1, 3).setValue(true); // C列: approved
      writeLog('INFO', 'Draft approved', { draftId });
      return true;
    }
  }

  writeLog('ERROR', 'Draft not found for approval', { draftId });
  return false;
}

/**
 * ドラフトを却下（削除またはフラグ設定）
 * @param {string} draftId
 * @returns {boolean}
 */
function rejectDraft(draftId) {
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  const sheet = ss.getSheetByName('Drafts');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === draftId) {
      sheet.deleteRow(i + 1);
      writeLog('INFO', 'Draft rejected and deleted', { draftId });
      return true;
    }
  }

  writeLog('ERROR', 'Draft not found for rejection', { draftId });
  return false;
}

/**
 * Slackペイロードから action_id と value を抽出して処理
 * @param {Object} payload - Slackペイロード
 * @returns {Object} { success: boolean, message: string }
 */
function handleSlackAction(payload) {
  const actionId = payload.actions[0].action_id;
  const draftId = payload.actions[0].value;

  if (actionId === 'approve_draft') {
    const success = approveDraft(draftId);
    return { success, message: success ? '承認しました' : '承認に失敗しました' };
  } else if (actionId === 'reject_draft') {
    const success = rejectDraft(draftId);
    return { success, message: success ? '却下しました' : '却下に失敗しました' };
  }

  return { success: false, message: '不明なアクション' };
}
