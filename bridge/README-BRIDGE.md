# Bridge Service - Cloud Run

Slack署名検証と3秒ACK応答を実現するためのNode.js/TypeScript中継サーバーです。

## 機能

1. **Slack署名検証**: Slackからのリクエストが正当かを検証
2. **3秒ACK**: Slackの3秒タイムアウトを回避するため、即座に200 OKを返却
3. **GAS中継**: 非同期でGASにペイロードを転送
4. **Cloud Scheduler連携**: `/cron/post` エンドポイントで9:00投稿をトリガー

## セットアップ

### 1. ローカル開発

```bash
cd bridge
npm install
cp .env.sample .env
# .env を編集してAPIキーを設定
npm run dev
```

ローカルで起動後、`http://localhost:8080/health` でヘルスチェック確認

### 2. Cloud Runへデプロイ

#### ビルド & プッシュ

```bash
cd bridge
npm run build

# Dockerイメージをビルド
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/gas-news-bot-bridge

# Cloud Runにデプロイ
gcloud run deploy gas-news-bot-bridge \
  --image gcr.io/YOUR_PROJECT_ID/gas-news-bot-bridge \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars SLACK_SIGNING_SECRET=your_secret,GAS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

#### デプロイ後

Cloud RunのURLをコピー (例: `https://gas-news-bot-bridge-xxxxx-an.a.run.app`)

### 3. Slack App設定

1. [Slack API](https://api.slack.com/apps) でAppを作成
2. **Interactivity & Shortcuts** を有効化
3. **Request URL** に Cloud RunのURL + `/slack/actions` を設定
   - 例: `https://gas-news-bot-bridge-xxxxx-an.a.run.app/slack/actions`
4. **Signing Secret** をコピーして `.env` の `SLACK_SIGNING_SECRET` に設定

### 4. Cloud Scheduler設定

9:00に自動投稿するため、Cloud Schedulerジョブを作成:

```bash
gcloud scheduler jobs create http news-bot-post \
  --schedule="0 9 * * *" \
  --uri="https://gas-news-bot-bridge-xxxxx-an.a.run.app/cron/post" \
  --http-method=POST \
  --time-zone="Asia/Tokyo" \
  --location=asia-northeast1
```

## エンドポイント

### `POST /slack/actions`

Slackからのインタラクティブアクション（承認/却下ボタン）を受信

- 署名検証
- 3秒以内に200 OK返却
- 非同期でGASに転送

### `POST /cron/post`

Cloud Schedulerから毎日9:00に呼び出され、GASの `scheduledPostJob()` をトリガー

### `GET /health`

ヘルスチェックエンドポイント

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T00:00:00.000Z"
}
```

## E2Eテスト手順

### テスト1: Slack署名検証

1. Slackでドラフト通知を受信
2. 承認/却下ボタンをクリック
3. Cloud Runのログを確認:
   - 署名検証が成功していること
   - GASへの転送が成功していること

### テスト2: Cloud Scheduler

```bash
# 手動でジョブを実行
gcloud scheduler jobs run news-bot-post --location=asia-northeast1

# ログ確認
gcloud run logs read --service=gas-news-bot-bridge --limit=50
```

### テスト3: ローカルテスト

```bash
cd bridge
npm run dev

# 別ターミナルで
curl -X POST http://localhost:8080/cron/post
```

## トラブルシューティング

### 署名検証失敗

- `SLACK_SIGNING_SECRET` が正しく設定されているか確認
- Slack Appの「Signing Secret」と一致しているか確認

### GAS転送失敗

- `GAS_WEBHOOK_URL` が正しいか確認
- GASがWeb Appとしてデプロイされているか確認

### Cloud Scheduler実行されない

```bash
# ジョブのステータス確認
gcloud scheduler jobs describe news-bot-post --location=asia-northeast1

# 手動実行
gcloud scheduler jobs run news-bot-post --location=asia-northeast1
```

## 監視・ログ

Cloud Runのログは以下で確認:

```bash
gcloud run logs read --service=gas-news-bot-bridge --limit=100
```

または、Google Cloud Consoleの「Cloud Run」→「ログ」タブで確認

## コスト

- Cloud Run: 無料枠内で十分（月2百万リクエストまで無料）
- Cloud Scheduler: 1ジョブ/日なら無料枠内（月3ジョブまで無料）
