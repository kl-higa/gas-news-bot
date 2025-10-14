/**
 * utils.js
 * 汎用ユーティリティ関数
 */

/**
 * スリープ（簡易版）
 * @param {number} ms - ミリ秒
 */
function sleep(ms) {
  Utilities.sleep(ms);
}

/**
 * 現在時刻を ISO 8601 形式で取得
 * @returns {string}
 */
function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * JSON を安全にパース
 * @param {string} text
 * @returns {Object|null}
 */
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    writeLog('ERROR', 'JSON parse failed', { text });
    return null;
  }
}

/**
 * 環境変数（Script Properties）を一括取得
 * @returns {Object}
 */
function getAllProperties() {
  return PropertiesService.getScriptProperties().getProperties();
}

/**
 * URLエンコード（日本語対応）
 * @param {string} str
 * @returns {string}
 */
function urlEncode(str) {
  return encodeURIComponent(str);
}
