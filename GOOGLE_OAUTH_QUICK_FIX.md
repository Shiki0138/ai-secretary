# Google OAuth エラー解決（最終版）

## エラー内容
```
エラー 400: invalid_request
リクエストの詳細: redirect_uri=undefined/api/google-calendar/callback
```

## 解決手順

### 1. Google Cloud Console で設定
https://console.cloud.google.com/apis/credentials

OAuth 2.0 クライアントIDの設定を開き、以下を追加：

#### 承認済みの JavaScript 生成元:
```
http://localhost:3000
```

#### 承認済みのリダイレクト URI（両方追加）:
```
http://localhost:3000/api/google-calendar
http://localhost:3000/api/google-calendar/callback
```

### 2. 設定を保存

「保存」ボタンをクリック

### 3. ブラウザのキャッシュをクリア

- Chrome: Cmd+Shift+Delete → キャッシュされた画像とファイル
- またはシークレットウィンドウで試す

### 4. 再度連携を試す

http://localhost:3000/executive にアクセスし、「Googleカレンダーと連携」をクリック

## 注意点

- 末尾のスラッシュに注意（付けない）
- 大文字小文字を完全一致
- httpとhttpsを間違えない（localhostはhttp）