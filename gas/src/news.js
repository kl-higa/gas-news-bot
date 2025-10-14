/**
 * news.js
 * 外部ニュースAPIからの情報収集
 */

/**
 * NewsAPIから最新ニュースを取得
 * @param {string} query - 検索クエリ
 * @param {number} maxResults - 最大取得件数
 * @returns {Array} [{title, url, description, publishedAt}, ...]
 */
function fetchNewsFromAPI(query = 'technology', maxResults = 10) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('NEWS_API_KEY');
  if (!apiKey) {
    writeLog('ERROR', 'NEWS_API_KEY not configured');
    return [];
  }

  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=ja&sortBy=publishedAt&pageSize=${maxResults}&apiKey=${apiKey}`;

  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const json = JSON.parse(response.getContentText());

    if (json.status !== 'ok') {
      writeLog('ERROR', 'NewsAPI error', { status: json.status, message: json.message });
      return [];
    }

    return json.articles.map(article => ({
      title: article.title,
      url: article.url,
      description: article.description,
      publishedAt: article.publishedAt
    }));

  } catch (e) {
    writeLog('ERROR', 'Failed to fetch news', { error: e.toString() });
    return [];
  }
}

/**
 * RSS/Atomフィードからニュースを取得（簡易実装）
 * @param {string} feedUrl - フィードURL
 * @returns {Array} [{title, url, summary}, ...]
 */
function fetchNewsFromRSS(feedUrl) {
  try {
    const xml = UrlFetchApp.fetch(feedUrl).getContentText();
    // 簡易的なXMLパース（実運用ではXmlServiceを使用推奨）
    const items = [];
    // 省略: 実際にはXmlService.parse()でパースして抽出
    writeLog('INFO', 'RSS fetch attempted', { feedUrl });
    return items;
  } catch (e) {
    writeLog('ERROR', 'Failed to fetch RSS', { feedUrl, error: e.toString() });
    return [];
  }
}
