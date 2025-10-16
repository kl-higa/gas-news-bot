/**
 * bridge/src/index.ts
 * Slack署名検証 + 3秒ACK + GAS中継 + /env 可視化 (Cloud Run)
 */
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 8080;

// ====== 環境変数 ======
const GAS_WEBAPP_URL = process.env.GAS_WEBAPP_URL || '';            // 例) https://script.google.com/macros/s/.../exec
const INTERNAL_BRIDGE_SECRET = process.env.INTERNAL_BRIDGE_SECRET || '';
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';

// ====== 起動時ログ（機密を直接出さない） ======
const mask = (v?: string | null) =>
  v ? v.replace(/https:\/\/script\.google\.com\/.*/, 'https://.../exec') : v ?? null;

console.log('ENV CHECK', {
  GAS_WEBAPP_URL: mask(GAS_WEBAPP_URL),
  INTERNAL_BRIDGE_SECRET_SET: !!INTERNAL_BRIDGE_SECRET
});

// ====== /env 可視化 ======
app.get('/env', (_req: Request, res: Response) => {
  res.json({
    GAS_WEBAPP_URL: GAS_WEBAPP_URL || null,
    INTERNAL_BRIDGE_SECRET_SET: !!INTERNAL_BRIDGE_SECRET
  });
});

// ====== Slack 署名検証 ======
function verifySlackSignature(
  signingSecret: string,
  requestSignature: string,
  requestTimestamp: string,
  rawBody: string
): boolean {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  const ts = parseInt(requestTimestamp, 10);
  if (!ts || ts < fiveMinutesAgo) {
    console.error('Request timestamp is too old or invalid');
    return false;
  }
  const base = `v0:${requestTimestamp}:${rawBody}`;
  const mySig = 'v0=' + crypto.createHmac('sha256', signingSecret).update(base, 'utf8').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(mySig, 'utf8'), Buffer.from(requestSignature, 'utf8'));
  } catch {
    return false;
  }
}

// Slack は署名検証のため raw ボディが必要（他ルートには影響させない）
const slackRaw = express.raw({ type: '*/*' });

/**
 * Slack Interactivity エンドポイント
 * 3秒以内に ACK、非同期で GAS へ中継（リダイレクト対応・429/5xxリトライ・デュープ防止）
 */
app.post(['/slack/actions', '/slack/interactivity'], slackRaw, async (req: Request, res: Response) => {
  const signature = req.headers['x-slack-signature'] as string;
  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const rawBody = (req.body as Buffer).toString('utf8');

  if (!verifySlackSignature(SLACK_SIGNING_SECRET, signature, timestamp, rawBody)) {
    console.error('Invalid Slack signature');
    return res.status(401).send('Unauthorized');
  }

  // 3秒 ACK（以降は非同期）
  res.status(200).send('');

  // payload（ログ用に一部だけパース）
  let payload: any;
  if (rawBody.startsWith('payload=')) {
    try { payload = JSON.parse(decodeURIComponent(rawBody.substring(8))); }
    catch { payload = { raw: true }; }
  } else {
    try { payload = JSON.parse(rawBody); }
    catch { payload = { raw: true }; }
  }

  // ====== 転送先と共通ヘッダ ======
  const url = `${GAS_WEBAPP_URL}?type=slackAction&internal=${encodeURIComponent(INTERNAL_BRIDGE_SECRET)}`;
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  const body = rawBody; // payload=... 形式のまま

  // ====== 簡易デュープ防止（直近60秒は同一イベントを弾く） ======
  const evtKey =
    (payload?.payload_id) ||
    [
      `ts:${payload?.container?.message_ts || payload?.message?.ts || 'none'}`,
      `act:${payload?.actions?.[0]?.action_id || 'none'}`,
      `usr:${payload?.user?.id || 'none'}`
    ].join('|');

  (global as any).__dedupe ||= new Map<string, number>();
  const now = Date.now();
  const last = (global as any).__dedupe.get(evtKey);
  if (last && now - last < 90_000) {
    console.log('Deduped slackAction', evtKey);
    return;
  }
  (global as any).__dedupe.set(evtKey, now);

  // ====== 302をPOST維持で追随・429/5xxは指数バックオフで最大3回再試行 ======
  const postOnce = async (u: string) =>
    axios.post(u, body, {
      headers,
      timeout: 25000,
      maxRedirects: 0,               // 自動追随せず自分で処理
      validateStatus: () => true     // ステータスで throw しない
    });

  try {
    let resp = await postOnce(url);

    // 302系は Location へ POST で追随
    if ((resp.status === 301 || resp.status === 302 || resp.status === 303) && resp.headers?.location) {
      resp = await postOnce(resp.headers.location);
    }

    let attempt = 1;
    while ((resp.status === 429 || resp.status >= 500) && attempt <= 3) {
      const wait = Math.min(3000 * attempt, 9000); // 2s→4s→6s
      console.warn(`GAS resp ${resp.status}; retry in ${wait}ms (attempt ${attempt})`);
      await new Promise(r => setTimeout(r, wait));
      // 直前のレスポンスに最終URLがあればそれを使う
      const nextUrl = (resp.request as any)?.res?.responseUrl || url;
      resp = await postOnce(nextUrl);
      if ((resp.status === 301 || resp.status === 302 || resp.status === 303) && resp.headers?.location) {
        resp = await postOnce(resp.headers.location);
      }
      attempt++;
    }

    if (resp.status >= 400) {
      const sample = typeof resp.data === 'string' ? resp.data.slice(0, 200) : JSON.stringify(resp.data || {});
      console.error('GAS final error', resp.status, sample);
    } else {
      const sample = typeof resp.data === 'string' ? resp.data.slice(0, 80) : 'json';
      console.log('GAS final ok', resp.status, sample);
    }
  } catch (e: any) {
    console.error('Failed to forward to GAS (slackAction):', e?.message || e);
  }
});


/**
 * Cloud Scheduler 用: 定期投稿トリガ
 * Run → GAS (type=cronPost, 空ボディ)
 */
app.post('/cron/post', async (_req: Request, res: Response) => {
  try {
    if (!GAS_WEBAPP_URL) {
      console.error('Cron job failed: Invalid URL (GAS_WEBAPP_URL undefined)');
      return res.status(500).json({ success: false, error: 'Invalid URL' });
    }
    const url =
      `${GAS_WEBAPP_URL}?type=cronPost&internal=${encodeURIComponent(INTERNAL_BRIDGE_SECRET)}`;
    console.log('Cron job triggered ->', mask(url));

    // 空ボディでPOST（GAS doPostで e.parameter を見る想定）
    const r = await axios.post(url, '', { headers: { 'Content-Type': 'text/plain' }, timeout: 30000 });
    const text = (typeof r.data === 'string') ? r.data : JSON.stringify(r.data);
    console.log('GAS cronPost resp', r.status, text);
    return res.json({ success: true, status: r.status });
  } catch (e: any) {
    console.error('Cron job failed:', e?.message || e);
    return res.status(500).json({ success: false, error: String(e) });
  }
});

// ヘルスチェック
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 起動
app.listen(PORT, () => {
  console.log(`Bridge server running on port ${PORT}`);
});
