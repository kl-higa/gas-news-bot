# Gas News Bot

Google Apps Script (GAS) + Cloud Run を使った自動ニュース収集・整形・投稿ボットシステム

## システム概要

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   NewsAPI   │─────▶│     GAS     │─────▶│   Sheets    │
└─────────────┘      │  (収集整形)  │      │  (ストレージ)│
                     └─────────────┘      └─────────────┘
                            │                      │
                            ▼                      ▼
                     ┌─────────────┐      ┌─────────────┐
                     │    Slack    │      │  OpenAI API │
                     │   (承認UI)   │      │   (整形)    │
                     └─────────────┘      └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │  Cloud Run  │
                     │  (署名検証)  │
                     └─────────────┘
                            │
                            ▼
                     ┌─────────────┐      ┌─────────────┐
                     │     GAS     │─────▶│ X (Twitter) │
                     │   (投稿)    │      │             │
                     └─────────────┘      └─────────────┘
                            ▲
                            │
                     ┌─────────────┐
                     │Cloud Sched. │
                     │  (9:00実行) │
                     └─────────────┘
```

## 主要機能

1. **ニュース収集**: NewsAPIから最新ニュースを取得
2. **AI整形**: OpenAI GPTでTwitter投稿文を生成
3. **Slack承認**: Block Kitでドラフトを通知し、手動承認/却下
4. **署名検証**: Cloud Runで3秒ACK + 署名検証を実現
5. **自動投稿**: 毎日9:00に承認済みドラフトを自動投稿
6. **祝日判定**: 土日祝日はスキップ

## ディレクトリ構成

```
gas-news-bot/
├── gas/                    # Google Apps Script
│   ├── appsscript.json
│   ├── src/
│   │   ├── main.js         # エントリーポイント
│   │   ├── sheets.js       # スプレッドシートI/O
│   │   ├── news.js         # ニュース収集
│   │   ├── format.js       # OpenAI整形
│   │   ├── slack.js        # Slack通知
│   │   ├── actions.js      # 承認/却下処理
│   │   ├── post_x.js       # X投稿
│   │   ├── holiday.js      # 祝日判定
│   │   └── utils.js        # ユーティリティ
│   └── README-GAS.md
│
├── bridge/                 # Cloud Run中継サーバー
│   ├── src/
│   │   └── index.ts        # 署名検証 + 中継
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── .env.sample
│   └── README-BRIDGE.md
│
├── .gitignore
└── README.md               # このファイル
```

## セットアップ

### 前提条件

- Google アカウント
- Google Cloud Platform (GCP) プロジェクト
- Slack Workspace
- NewsAPI アカウント
- OpenAI API アカウント
- X (Twitter) Developer アカウント

### 1. GASセットアップ

詳細は [`gas/README-GAS.md`](gas/README-GAS.md) を参照

1. GASプロジェクト作成
2. スプレッドシート作成（Drafts, Candidates, Logs シート）
3. Script Properties設定（APIキー等）
4. Web Appとしてデプロイ

### 2. Cloud Runセットアップ

詳細は [`bridge/README-BRIDGE.md`](bridge/README-BRIDGE.md) を参照

1. bridgeディレクトリでビルド
2. Cloud Runにデプロイ
3. 環境変数設定（SLACK_SIGNING_SECRET, GAS_WEBHOOK_URL）

### 3. Slack Appセットアップ

1. Slack APIでAppを作成
2. Interactivity & Shortcutsを有効化
3. Request URLにCloud RunのURL + `/slack/actions` を設定
4. Incoming Webhooksを有効化してWebhook URLを取得
5. Signing Secretを取得

### 4. Cloud Schedulerセットアップ

```bash
gcloud scheduler jobs create http news-bot-post \
  --schedule="0 9 * * *" \
  --uri="https://YOUR_CLOUD_RUN_URL/cron/post" \
  --http-method=POST \
  --time-zone="Asia/Tokyo" \
  --location=asia-northeast1
```

## ワークフロー

### 1. ニュース収集フロー（毎日8:00）

1. GASの `collectAndDraftNews()` が実行される（トリガー設定）
2. NewsAPIから最新ニュースを取得
3. Candidatesシートに保存
4. OpenAI APIでドラフト整形
5. Draftsシートに保存
6. Slackに通知（承認/却下ボタン付き）

### 2. 承認フロー（手動）

1. Slackで通知を受信
2. 承認ボタンをクリック
3. Cloud Runで署名検証
4. 3秒以内にACK返却
5. 非同期でGASに転送
6. GASがDraftsシートの `approved` を `true` に更新

### 3. 投稿フロー（毎日9:00）

1. Cloud Schedulerが `/cron/post` をトリガー
2. Cloud RunがGASの `scheduledPostJob()` を呼び出し
3. 祝日判定（土日祝日ならスキップ）
4. 承認済みドラフトを取得
5. X (Twitter) に投稿
6. Draftsシートの `postedAt` を更新

## E2Eテスト

### テスト1: ニュース収集

```javascript
// GASエディタで実行
manualCollectNews();
```

確認項目:
- Candidatesシートに新規ニュース追加
- Draftsシートに新規ドラフト作成
- Slackに通知到着

### テスト2: 承認→投稿

1. Slack通知の「承認」ボタンをクリック
2. Draftsシートの `approved` が `true` に変更されることを確認

```javascript
// GASエディタで実行
manualPost();
```

3. X (Twitter) に投稿されることを確認
4. Draftsシートの `postedAt` に投稿時刻が記録されることを確認

### テスト3: Cloud Scheduler

```bash
# 手動実行
gcloud scheduler jobs run news-bot-post --location=asia-northeast1

# ログ確認
gcloud run logs read --service=gas-news-bot-bridge --limit=50
```

## トラブルシューティング

### GAS実行エラー

- Logsシートを確認
- GASエディタの「実行ログ」を確認
- Script Propertiesが正しく設定されているか確認

### Slack通知が届かない

- SLACK_WEBHOOK_URLが正しいか確認
- Slack Appの権限を確認

### 署名検証失敗

- SLACK_SIGNING_SECRETが正しいか確認
- Cloud Runの環境変数を確認

### 投稿されない

- X API認証情報を確認
- Draftsシートの `approved` が `true` か確認
- 祝日判定が正しく動作しているか確認

## APIキー・認証情報の取得

### NewsAPI

1. https://newsapi.org/ でアカウント作成
2. APIキーを取得（無料プランで1日100リクエスト）

### OpenAI API

1. https://platform.openai.com/ でアカウント作成
2. APIキーを作成
3. 課金設定を行う（gpt-4o-miniで低コスト）

### X (Twitter) API

1. https://developer.twitter.com/ でDeveloper Portal登録
2. Project & Appを作成
3. Essentialプラン以上に登録（月額$100〜）
4. Bearer Tokenを取得（OAuth 2.0）

### Slack

1. https://api.slack.com/apps でAppを作成
2. Incoming Webhooksを有効化
3. Signing Secretを取得

## コスト見積もり

| サービス | 月額（目安） |
|---------|-------------|
| GAS | 無料 |
| Cloud Run | 無料枠内 |
| Cloud Scheduler | 無料枠内 |
| NewsAPI | 無料 |
| OpenAI API | $1〜5 |
| X (Twitter) API | $100〜 |
| **合計** | **$100〜** |

## ライセンス

MIT

## 作者

Your Name
