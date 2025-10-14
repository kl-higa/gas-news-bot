/**
 * format.js
 * OpenAI APIを使ったドラフト整形
 */

/**
 * 候補ニュースをOpenAI GPTで整形してドラフト作成
 * @param {Array} candidates - [{title, url, summary}, ...]
 * @returns {string} 整形されたドラフト本文
 */
function formatDraftWithOpenAI(candidates) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) {
    writeLog('ERROR', 'OPENAI_API_KEY not configured');
    return '';
  }

  const prompt = `以下のニュース候補から、Twitterに投稿する140文字以内の魅力的な投稿文を作成してください。
候補:
${candidates.map((c, i) => `${i+1}. ${c.title}\n   URL: ${c.url}\n   概要: ${c.summary || 'なし'}`).join('\n')}

出力形式: JSON { "content": "投稿文", "sources": ["url1", "url2"] }`;

  const payload = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'あなたはニュース投稿のエキスパートです。' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
    const json = JSON.parse(response.getContentText());

    if (json.error) {
      writeLog('ERROR', 'OpenAI API error', json.error);
      return '';
    }

    const result = JSON.parse(json.choices[0].message.content);
    writeLog('INFO', 'Draft formatted via OpenAI', { content: result.content });
    return result.content;

  } catch (e) {
    writeLog('ERROR', 'Failed to format draft', { error: e.toString() });
    return '';
  }
}

/**
 * 複数候補から最適なものを選択してドラフト化（簡易版）
 * @param {Array} candidates
 * @returns {string}
 */
function selectBestCandidate(candidates) {
  if (candidates.length === 0) return '';
  // 最新のものを優先（publishedAtでソート済み想定）
  const best = candidates[0];
  return `${best.title}\n${best.url}`;
}
