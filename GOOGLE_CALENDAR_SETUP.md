# Googleカレンダー連携セットアップガイド

## 1. Google Cloud Consoleでプロジェクト作成

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成または既存プロジェクトを選択
3. プロジェクト名: `ai-secretary-calendar`（任意）

## 2. Google Calendar APIの有効化

1. 左メニュー > 「APIとサービス」 > 「ライブラリ」
2. 「Google Calendar API」を検索
3. 「有効にする」をクリック

## 3. OAuth 2.0認証情報の作成

### 3.1 OAuth同意画面の設定

1. 左メニュー > 「APIとサービス」 > 「OAuth同意画面」
2. ユーザータイプ: **外部** を選択
3. アプリ情報:
   - アプリ名: `AI秘書システム`
   - ユーザーサポートメール: 自分のメールアドレス
   - デベロッパーの連絡先情報: 自分のメールアドレス
4. 「保存して次へ」

### 3.2 スコープの設定

1. 「スコープを追加または削除」をクリック
2. 以下のスコープを追加:
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/calendar.events`
3. 「更新」をクリック
4. 「保存して次へ」

### 3.3 テストユーザーの追加（開発時）

1. 「テストユーザー」タブ
2. 「ユーザーを追加」で自分のGmailアドレスを追加
3. 「保存して次へ」

## 4. OAuth 2.0クライアントIDの作成

1. 左メニュー > 「APIとサービス」 > 「認証情報」
2. 「認証情報を作成」 > 「OAuth 2.0クライアントID」
3. アプリケーションの種類: **ウェブアプリケーション**
4. 名前: `AI秘書カレンダー連携`
5. 承認済みのリダイレクトURI:
   - 開発環境: `http://localhost:3000/api/google-calendar`
   - 本番環境: `https://your-domain.com/api/google-calendar`
6. 「作成」をクリック

## 5. 環境変数の設定

`.env.local`ファイルに以下を追加:

```bash
# Google Calendar API
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

## 6. 本番環境での追加設定

### 6.1 ドメイン認証

1. OAuth同意画面 > アプリドメイン
2. 承認済みドメインに本番ドメインを追加

### 6.2 アプリの公開

1. OAuth同意画面 > 公開ステータス
2. 「アプリを公開」をクリック（一般ユーザーが利用する場合）

## 7. トラブルシューティング

### よくあるエラー

1. **redirect_uri_mismatch**
   - リダイレクトURIが正確に設定されているか確認
   - HTTPSが必要な場合があります

2. **invalid_client**
   - クライアントIDとシークレットが正しく設定されているか確認

3. **access_denied**
   - テストユーザーに追加されているか確認
   - アプリが公開されているか確認

### デバッグ方法

1. ブラウザの開発者ツールでネットワークタブを確認
2. エラーメッセージの詳細を確認
3. Google Cloud Consoleの監査ログを確認

## 8. セキュリティ注意事項

- クライアントシークレットは絶対に公開しない
- 本番環境では適切なドメイン制限を設定
- 定期的なアクセストークンの更新を実装
- ユーザーの同意なしにデータにアクセスしない

## 9. 重要：マルチユーザー対応について

### ✅ 正しい理解
- **開発者が一度設定** → 全ユーザーが利用可能
- **各ユーザーは個別認証** → 自分のGoogleアカウントと連携
- **個別データ管理** → 他のユーザーのデータは見えない

### 🔄 実際のユーザーフロー
1. 経営者A：「Googleカレンダー連携」→ 自分のGoogleアカウントで認証
2. 経営者B：「Googleカレンダー連携」→ 自分のGoogleアカウントで認証
3. 各ユーザーは自分のカレンダーのみアクセス可能

### 📝 開発時の簡易設定
1. Google Cloud Consoleでプロジェクト作成
2. Calendar APIの有効化  
3. OAuth 2.0クライアントID作成（ウェブアプリケーション）
4. リダイレクトURIに `http://localhost:3000/api/google-calendar` を追加
5. 環境変数設定

**この設定により、全てのユーザーがGoogleカレンダー連携を利用できるようになります。**