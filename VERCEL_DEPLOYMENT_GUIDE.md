# 🚀 Vercel + Upstash 完全無料デプロイガイド

## 📋 概要

この AI Secretary SaaS は以下の構成で完全無料運用が可能です：

- **フロントエンド & API**: Vercel (無料枠)
- **データベース**: Upstash Redis (無料枠)
- **AI 分析**: OpenAI GPT-4 (従量課金)
- **メッセージング**: LINE Bot API (無料)

## 🛠️ デプロイ手順（30分）

### Step 1: Upstash Redis アカウント作成 (5分)

1. https://upstash.com にアクセス
2. **Sign up with GitHub** をクリック
3. 新しいデータベース作成:
   - **Name**: `ai-secretary-redis`
   - **Type**: `Redis`
   - **Region**: `US-East-1` (最速)
4. 作成後、**Details** タブから接続情報をコピー:
   ```
   UPSTASH_REDIS_REST_URL=https://....upstash.io
   UPSTASH_REDIS_REST_TOKEN=Axxxx...
   ```

### Step 2: OpenAI API Key取得 (5分)

1. https://platform.openai.com にアクセス
2. **API Keys** → **Create new secret key**
3. キーをコピー（後で使用）:
   ```
   OPENAI_API_KEY=sk-proj-...
   ```

### Step 3: LINE Bot設定確認 (5分)

既存のLINE Botの設定情報を確認:
```
LINE_CHANNEL_ACCESS_TOKEN=（既存の値）
LINE_CHANNEL_SECRET=（既存の値）
```

### Step 4: Vercel デプロイ (10分)

1. **GitHub リポジトリ作成**:
   ```bash
   cd /Users/leadfive/Desktop/system/030_AI秘書/ai-secretary
   git init
   git add .
   git commit -m "🚀 AI Secretary Vercel Edition"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/ai-secretary.git
   git push -u origin main
   ```

2. **Vercel でプロジェクト作成**:
   - https://vercel.com にアクセス
   - **New Project** → **Import from GitHub**
   - `ai-secretary` リポジトリを選択
   - **Framework Preset**: Next.js
   - **Deploy** をクリック

3. **環境変数設定**:
   Vercel Dashboard → **Settings** → **Environment Variables** で以下を追加:
   ```
   UPSTASH_REDIS_REST_URL=https://....upstash.io
   UPSTASH_REDIS_REST_TOKEN=Axxxx...
   OPENAI_API_KEY=sk-proj-...
   LINE_CHANNEL_ACCESS_TOKEN=（既存の値）
   LINE_CHANNEL_SECRET=（既存の値）
   ```

### Step 5: LINE Webhook URL更新 (5分)

1. LINE Developers Console にアクセス
2. **Messaging API settings** → **Webhook URL**
3. URLを更新:
   ```
   https://YOUR_PROJECT_NAME.vercel.app/api/webhook
   ```
4. **Verify** をクリックして接続テスト

## ✅ 動作確認

### 1. ホームページアクセス
```
https://YOUR_PROJECT_NAME.vercel.app
```

### 2. 管理ダッシュボード
```
https://YOUR_PROJECT_NAME.vercel.app/dashboard
```

### 3. API エンドポイント
```
https://YOUR_PROJECT_NAME.vercel.app/api/webhook
https://YOUR_PROJECT_NAME.vercel.app/api/dashboard
https://YOUR_PROJECT_NAME.vercel.app/api/messages
```

### 4. LINE Bot テスト
LINE Botにメッセージを送信して、以下を確認:
- ✅ メッセージ受信の自動返信
- ✅ AI分析結果の表示
- ✅ 緊急メッセージの通知（設定時）

## 📊 無料枠の制限

### Vercel (Hobby Plan)
- **Functions**: 1,000,000実行/月 → 50社で 1日1,333メッセージまで
- **帯域**: 100GB/月 → 十分すぎる
- **Build時間**: 6,000分/月 → 1日20回デプロイ可能

### Upstash Redis (Free)
- **Commands**: 10,000コマンド/日 → 1日3,333メッセージまで
- **Storage**: 256MB → 約100万メッセージ保存可能
- **帯域**: 無制限

### OpenAI GPT-4
- **従量課金**: $0.03/1K tokens
- **目安**: 1メッセージ分析 ≈ $0.006 (¥0.9)
- **月額想定**: 1,000メッセージ = ¥900

## 🔧 ローカル開発

```bash
# 開発サーバー起動
npm run dev

# ブラウザで確認
open http://localhost:3000
```

環境変数は `.env.local` ファイルに設定:
```bash
cp .env.example .env.local
# .env.local ファイルを編集
```

## 🚀 本格運用への移行

50社を超える場合の有料プランへの移行：

### Vercel Pro ($20/月)
- Functions: 無制限
- 帯域: 1TB/月
- チーム機能

### Upstash Pro ($10/月)
- Commands: 無制限  
- Storage: 1GB
- 24時間サポート

**合計**: $30/月（¥4,500）で500社まで対応可能

## 🔒 セキュリティ

本番環境では以下を推奨:

1. **LINE Signature 検証**:
   ```typescript
   // webhook/route.ts で有効化
   const isValid = validateSignature(body, signature)
   if (!isValid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
   ```

2. **CORS制限**:
   ```typescript
   // 特定ドメインのみ許可
   allow_origins: ["https://yourdomain.com"]
   ```

3. **Rate Limiting**:
   ```typescript
   // Upstash Rate Limitingを使用
   import { Ratelimit } from "@upstash/ratelimit"
   ```

## 📞 サポート

問題が発生した場合:

1. **Vercel ログ確認**: Dashboard → Functions → View Logs
2. **Upstash ログ確認**: Dashboard → Logs
3. **LINE Webhook ログ**: LINE Developers Console → Monitoring

デプロイ完了後、完全にローカルPC不要で運用可能になります！