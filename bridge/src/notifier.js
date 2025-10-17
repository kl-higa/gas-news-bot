// notifier.js
import crypto from 'crypto';
import fetch from 'node-fetch';

const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));

const dedupeCache = new Map(); // 簡易：メモリ。Memorystore等に置き換え可
const DEDUPE_TTL_MS = 60_000;

export async function notifyError(payload) {
  if (process.env.SLACK_ALERT_ENABLED !== 'true') return;

  const webhook = process.env.SLACK_ALERT_WEBHOOK_URL;
  if (!webhook) return;

  const env = process.env.SERVICE_ENV || 'unknown';
  const fingerprint = crypto.createHash('sha256')
    .update(`${payload.error_class}|${(payload.message||'').slice(0,200)}`)
    .digest('hex');

  // デデュープ（60秒）
  const now = Date.now();
  const prev = dedupeCache.get(fingerprint);
  if (prev && (now - prev) < DEDUPE_TTL_MS) return;
  dedupeCache.set(fingerprint, now);

  // 機微情報マスク
  const scrub = (s='') => s.replace(/(xox[bap]-[A-Za-z0-9-]+)/g, '[MASKED_TOKEN]')
                           .replace(/(Bearer\s+[A-Za-z0-9\.\-_]+)/g, 'Bearer [MASKED]')
                           .replace(/(secret|token|key)=([^&\s]+)/gi, '$1=[MASKED]');

  const blocks = [
    { type: "header", text: { type: "plain_text", text: `🚨 [${env}] ${payload.title || 'Error'}` } },
    { type: "section", fields: [
      { type: "mrkdwn", text: `*error_class:*\n\`${payload.error_class}\`` },
      { type: "mrkdwn", text: `*request_id:*\n\`${payload.request_id || '-'}\`` },
      { type: "mrkdwn", text: `*post_id:*\n\`${payload.post_id || '-'}\`` },
      { type: "mrkdwn", text: `*fingerprint:*\n\`${fingerprint.slice(0,8)}\`` },
    ]},
    { type: "section", text: { type: "mrkdwn", text: `*message:*\n\`\`\`${scrub(payload.message || '')}\`\`\`` } },
    payload.hint ? { type: "context", elements: [{ type: "mrkdwn", text: `*hint:* ${payload.hint}` }]} : undefined
  ].filter(Boolean);

  // 2s→4s→8s リトライ
  let attempt = 0, delay = 2000;
  while (attempt < 3) {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
    if (res.ok) return;
    if (res.status >= 500 || res.status === 429) {
      attempt++; await sleep(delay); delay *= 2; continue;
    }
    // 4xxは即終了
    return;
  }
}
