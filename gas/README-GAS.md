# GAS News Bot - Google Apps Script

このディレクトリには、ニュース収集・整形・投稿を行うGoogle Apps Script (GAS) コードが含まれています。

## ファイル構成

```
gas/
├── appsscript.json          # GASプロジェクト設定
├── src/
│   ├── main.js              # エントリーポイント (doPost, 定期実行)
│   ├── sheets.js            # スプレッドシート I/O
│   ├── news.js              # ニュースAPI取得
│   ├── format.js            # OpenAI整形
│   ├── slack.js             # Slack通知
│   ├── actions.js           # Slack承認/却下アクション
│   ├── post_x.js            # X (Twitter) 投稿
│   ├── holiday.js           # 祝日判定
│   └── utils.js             # ユーティリティ
└── README-GAS.md            # このファイル
```

## セットアップ

### 1. Google Apps Script プロジェクト作成

1. [Google Apps Script](https://script.google.com/) にアクセス
2. 新しいプロジェクトを作成
3. `clasp` を使用してデプロイ（推奨）

```bash
npm install -g @google/clasp
clasp login
cd gas
clasp create --type standalone --title "News Bot"
clasp push
```

### 2. スプレッドシート作成

新しいGoogleスプレッドシートを作成し、以下のシートを追加:

- **Drafts**: `A: id, B: content, C: approved, D: postedAt`
- **Candidates**: `A: title, B: url, C: summary`
- **Logs**: `A: timestamp, B: level, C: message, D: metadata`

スプレッドシートIDをコピー（URLの `/d/{SHEET_ID}/edit` 部分）

### 3. Script Properties 設定

GASエディタで「プロジェクトの設定」→「スクリプト プロパティ」に以下を追加:

| Key | Value (Example) |
|-----|-----------------|
| `SHEET_ID` | `1abc...xyz` |
| `NEWS_API_KEY` | `your_newsapi_key` |
| `OPENAI_API_KEY` | `sk-...` |
| `SLACK_WEBHOOK_URL` | `https://hooks.slack.com/services/...` |
| `X_BEARER_TOKEN` | `AAAAAAAAAAAAAAAAAAAAAMLh...` |

### 4. Web Appとしてデプロイ

1. GASエディタで「デプロイ」→「新しいデプロイ」
2. 種類: **ウェブアプリ**
3. 実行ユーザー: **自分**
4. アクセスできるユーザー: **全員**
5. デプロイ後、URLをコピー (`https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`)

このURLを `bridge/.env` の `GAS_WEBHOOK_URL` に設定します。

### 5. トリガー設定 (オプション)

手動でトリガーを設定する場合:

- **collectAndDraftNews**: 毎日8:00実行（時間ベース）
- **scheduledPostJob**: Cloud Schedulerから呼び出すため不要

## 主要関数

### エントリーポイント

- `doPost(e)`: Cloud Run bridgeからのWebhook受信
- `collectAndDraftNews()`: ニュース収集→ドラフト作成→Slack通知
- `scheduledPostJob()`: 9:00投稿実行（祝日判定付き）

### 手動テスト用

- `manualCollectNews()`: 手動でニュース収集テスト
- `manualPost()`: 手動で投稿テスト

## E2Eテスト手順

### テスト1: ニュース収集→ドラフト作成

1. GASエディタで `manualCollectNews()` を実行
2. Candidatesシートに新規ニュースが追加されることを確認
3. Draftsシートに新規ドラフトが作成されることを確認
4. Slackに通知が届くことを確認

### テスト2: Slack承認→投稿

1. Slack通知の「承認」ボタンをクリック
2. Bridge経由でGASの `approveDraft()` が呼ばれ、Draftsシートの `approved` が `true` になることを確認
3. GASエディタで `manualPost()` を実行
4. X (Twitter) に投稿されることを確認
5. Draftsシートの `postedAt` に投稿時刻が記録されることを確認

### テスト3: 祝日判定

1. GASエディタで以下を実行:
```javascript
function testHoliday() {
  Logger.log(isTodayWorkday()); // 平日ならtrue、土日祝日ならfalse
}
```

### テスト4: Slack却下

1. Slack通知の「却下」ボタンをクリック
2. Draftsシートから該当ドラフトが削除されることを確認

## トラブルシューティング

### エラーログの確認

Logsシートを確認するか、GASエディタの「実行ログ」を確認

### よくあるエラー

- **`SHEET_ID not configured`**: Script Propertiesに `SHEET_ID` が設定されていません
- **`NEWS_API_KEY not configured`**: NewsAPIのAPIキーが未設定です
- **`Holiday calendar not found`**: 日本の祝日カレンダーへのアクセス権限を確認してください

## 備考

- OpenAI APIの料金に注意してください
- NewsAPIは無料プランで1日100リクエストまで
- X (Twitter) APIはEssentialプラン以上が必要（月額$100）
