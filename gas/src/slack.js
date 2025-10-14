/**
 * slack.js
 * Slack通知とBlock Kitメッセージ送信
 */

/**
 * ドラフトをSlackに通知（承認ボタン付き）
 * @param {string} draftId - ドラフトID
 * @param {string} content - ドラフト本文
 * @returns {boolean} 成功/失敗
 */
function notifyDraftToSlack(draftId, content) {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL');
  if (!webhookUrl) {
    writeLog('ERROR', 'SLACK_WEBHOOK_URL not configured');
    return false;
  }

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*新しいドラフトが作成されました*\n\`\`\`${content}\`\`\``
      }
    },
    {
      type: 'actions',
      block_id: `draft_${draftId}`,
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '承認' },
          style: 'primary',
          value: draftId,
          action_id: 'approve_draft'
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '却下' },
          style: 'danger',
          value: draftId,
          action_id: 'reject_draft'
        }
      ]
    }
  ];

  const payload = {
    text: '新しいドラフト通知',
    blocks: blocks
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(webhookUrl, options);
    writeLog('INFO', 'Draft notified to Slack', { draftId, statusCode: response.getResponseCode() });
    return response.getResponseCode() === 200;
  } catch (e) {
    writeLog('ERROR', 'Failed to notify Slack', { error: e.toString() });
    return false;
  }
}

/**
 * エラーをSlackに通知
 * @param {string} message - エラーメッセージ
 * @param {Object} metadata - 追加情報
 */
function notifyErrorToSlack(message, metadata = {}) {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL');
  if (!webhookUrl) return;

  const payload = {
    text: `:x: エラー発生: ${message}`,
    attachments: [{
      color: 'danger',
      text: JSON.stringify(metadata, null, 2)
    }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    UrlFetchApp.fetch(webhookUrl, options);
  } catch (e) {
    // 無視（ログ記録済み想定）
  }
}
