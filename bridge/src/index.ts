/**
 * bridge/src/index.ts
 * Slack署名検証 + 3秒ACK + GAS中継サーバー (Cloud Run)
 */

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 8080;

// Slack署名検証用のシークレット
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
const GAS_WEBHOOK_URL = process.env.GAS_WEBHOOK_URL || '';

/**
 * Slack署名検証
 * @param signingSecret - Slackのsigning secret
 * @param requestSignature - リクエストヘッダーの X-Slack-Signature
 * @param requestTimestamp - リクエストヘッダーの X-Slack-Request-Timestamp
 * @param body - リクエストボディ（rawテキスト）
 * @returns 検証結果
 */
function verifySlackSignature(
  signingSecret: string,
  requestSignature: string,
  requestTimestamp: string,
  body: string
): boolean {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  const timestamp = parseInt(requestTimestamp, 10);

  if (timestamp < fiveMinutesAgo) {
    console.error('Request timestamp is too old');
    return false;
  }

  const sigBasestring = `v0:${requestTimestamp}:${body}`;
  const mySignature =
    'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring, 'utf8').digest('hex');

  return crypto.timingSafeEqual(Buffer.from(mySignature, 'utf8'), Buffer.from(requestSignature, 'utf8'));
}

/**
 * Slackペイロードを非同期でGASに転送
 * @param payload - Slackペイロード
 */
async function forwardToGAS(payload: any): Promise<void> {
  try {
    const response = await axios.post(GAS_WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 25000 // 25秒タイムアウト
    });
    console.log('Forwarded to GAS:', response.data);
  } catch (error: any) {
    console.error('Failed to forward to GAS:', error.message);
  }
}

// Rawボディを取得するミドルウェア
app.use('/slack/actions', express.raw({ type: 'application/json' }));
app.use('/slack/actions', express.urlencoded({ extended: true }));

/**
 * Slackアクションエンドポイント
 */
app.post('/slack/actions', async (req: Request, res: Response) => {
  const signature = req.headers['x-slack-signature'] as string;
  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const rawBody = req.body.toString('utf8');

  // 署名検証
  if (!verifySlackSignature(SLACK_SIGNING_SECRET, signature, timestamp, rawBody)) {
    console.error('Invalid Slack signature');
    return res.status(401).send('Unauthorized');
  }

  // 3秒以内にACK返却
  res.status(200).send('');

  // ペイロードをパース（application/x-www-form-urlencodedの場合）
  let payload: any;
  if (rawBody.startsWith('payload=')) {
    const payloadStr = decodeURIComponent(rawBody.substring(8));
    payload = JSON.parse(payloadStr);
  } else {
    payload = JSON.parse(rawBody);
  }

  // 非同期でGASに転送
  await forwardToGAS(payload);
});

/**
 * Cloud Scheduler用: 定期投稿トリガー
 */
app.post('/cron/post', async (req: Request, res: Response) => {
  console.log('Cron job triggered: scheduled post');

  try {
    const response = await axios.post(GAS_WEBHOOK_URL, {
      action: 'scheduled_post'
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    console.log('Cron job completed:', response.data);
    res.status(200).json({ success: true, data: response.data });

  } catch (error: any) {
    console.error('Cron job failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ヘルスチェック
 */
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Bridge server running on port ${PORT}`);
});
