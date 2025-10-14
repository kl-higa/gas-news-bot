/**
 * main.js
 * エントリーポイントとエンドポイント定義
 */

/**
 * doPost: Cloud Run bridge経由でのリクエスト受信
 * @param {Object} e - リクエストイベント
 * @returns {ContentService.TextOutput}
 */
function doPost(e) {
  try {
    const payload = safeJsonParse(e.postData.contents);
    if (!payload) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid JSON' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Slackアクションペイロード処理
    if (payload.type === 'block_actions') {
      const result = handleSlackAction(payload);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // その他のカスタムペイロード
    if (payload.action === 'collect_news') {
      collectAndDraftNews();
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    writeLog('ERROR', 'doPost error', { error: err.toString() });
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 定期実行: ニュース収集 → ドラフト作成 → Slack通知
 */
function collectAndDraftNews() {
  writeLog('INFO', 'Starting news collection job');

  // 1. ニュース収集
  const news = fetchNewsFromAPI('technology OR AI', 5);
  if (news.length === 0) {
    writeLog('WARN', 'No news fetched');
    return;
  }

  // 2. Candidatesシートに追加
  const candidates = news.map(n => ({
    title: n.title,
    url: n.url,
    summary: n.description
  }));
  appendCandidates(candidates);

  // 3. OpenAIでドラフト整形
  const draftContent = formatDraftWithOpenAI(candidates);
  if (!draftContent) {
    writeLog('WARN', 'Draft formatting failed');
    return;
  }

  // 4. Draftsシートに追加
  const draftId = appendDraft(draftContent);

  // 5. Slackに通知
  notifyDraftToSlack(draftId, draftContent);

  writeLog('INFO', 'News collection job completed', { draftId });
}

/**
 * 定期実行: 9:00 承認済みドラフトを自動投稿
 * Cloud Schedulerから呼び出し想定
 */
function scheduledPostJob() {
  writeLog('INFO', 'Starting scheduled post job');

  // 祝日・休日チェック
  if (!isTodayWorkday()) {
    writeLog('INFO', 'Today is weekend or holiday, skipping post');
    return;
  }

  // 承認済みドラフトを投稿
  const count = postApprovedDrafts();

  if (count > 0) {
    writeLog('INFO', `Posted ${count} drafts`);
  } else {
    writeLog('INFO', 'No approved drafts to post');
  }
}

/**
 * 手動テスト用: ニュース収集
 */
function manualCollectNews() {
  collectAndDraftNews();
}

/**
 * 手動テスト用: 投稿実行
 */
function manualPost() {
  scheduledPostJob();
}
