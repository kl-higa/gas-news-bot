/**
 * post_x.js
 * X (Twitter) への投稿処理
 */

/**
 * X API v2 でツイートを投稿
 * @param {string} content - 投稿内容
 * @returns {Object} { success: boolean, tweetId: string }
 */
function postToX(content) {
  const bearerToken = PropertiesService.getScriptProperties().getProperty('X_BEARER_TOKEN');
  if (!bearerToken) {
    writeLog('ERROR', 'X_BEARER_TOKEN not configured');
    return { success: false, tweetId: null };
  }

  const url = 'https://api.twitter.com/2/tweets';
  const payload = {
    text: content
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${bearerToken}`
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());

    if (json.data && json.data.id) {
      writeLog('INFO', 'Posted to X successfully', { tweetId: json.data.id });
      return { success: true, tweetId: json.data.id };
    } else {
      writeLog('ERROR', 'X API error', json);
      return { success: false, tweetId: null };
    }

  } catch (e) {
    writeLog('ERROR', 'Failed to post to X', { error: e.toString() });
    notifyErrorToSlack('X投稿に失敗しました', { error: e.toString() });
    return { success: false, tweetId: null };
  }
}

/**
 * 承認済みドラフトを全てXに投稿
 * @returns {number} 投稿件数
 */
function postApprovedDrafts() {
  const drafts = getApprovedDrafts();
  let count = 0;

  for (const draft of drafts) {
    const result = postToX(draft.content);
    if (result.success) {
      markAsPosted(draft.rowIndex, new Date());
      count++;
    }
  }

  writeLog('INFO', 'Batch post completed', { count });
  return count;
}
