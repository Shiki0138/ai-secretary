# Google OAuth エラー解決手順

## エラー内容
```
エラー 400: invalid_request
You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy
```

## 解決手順

### 1. OAuth 2.0 クライアントID設定
https://console.cloud.google.com/apis/credentials

1. 該当のOAuth 2.0 クライアントIDをクリック
2. 以下を設定：

**承認済みの JavaScript 生成元:**
```
http://localhost:3000
```

**承認済みのリダイレクト URI:**
```
http://localhost:3000/api/google-calendar
```

⚠️ **重要**: 末尾にスラッシュを付けない、大文字小文字も完全一致

### 2. OAuth 同意画面設定
https://console.cloud.google.com/apis/credentials/consent

1. **アプリ情報**:
   - アプリ名: AI秘書システム
   - ユーザーサポートメール: greenroom51@gmail.com
   - アプリのロゴ: （オプション）

2. **アプリドメイン**: （開発中は空欄でOK）

3. **承認済みドメイン**: （開発中は不要）

4. **デベロッパーの連絡先情報**: greenroom51@gmail.com

### 3. スコープ設定
「スコープを追加または削除」から以下を追加：
- `../auth/calendar.readonly`
- `../auth/calendar.events`

### 4. テストユーザー
「ADD USERS」から追加：
- greenroom51@gmail.com

### 5. 公開ステータス
- 開発中: 「テスト」のままでOK
- 本番環境: 「本番環境に公開」

## トラブルシューティング

### よくある原因
1. ✅ リダイレクトURIの不一致（スペース、大文字小文字、末尾のスラッシュ）
2. ✅ テストユーザーに登録されていない
3. ✅ スコープが設定されていない
4. ✅ JavaScript生成元が設定されていない

### 確認コマンド
```bash
# OAuth URLの生成テスト
node test-google-oauth.js
```

### 設定後の確認
1. ブラウザのキャッシュをクリア
2. シークレットウィンドウで試す
3. 別のブラウザで試す

## 参考リンク
- [Google OAuth 2.0 ガイド](https://developers.google.com/identity/protocols/oauth2)
- [Calendar API スコープ](https://developers.google.com/calendar/api/auth)