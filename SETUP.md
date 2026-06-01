# ASK_2026_sports - 統合セットアップガイド

## 概要
Client（React + Vite）と Server（Node.js + Express）が統合されました。
単一のポート（5000）でアプリケーション全体を配信できます。

## インストール（初回のみ）

```bash
# Client 依存関係インストール
cd client
npm install
cd ..

# Server 依存関係インストール
cd server
npm install
cd ..
```

## 開発環境での実行

**ターミナル 1 - Server（watch mode）:**
```bash
cd server
npm run dev
# ポート 5000 で起動、src の変更を監視
```

**ターミナル 2 - Client（開発サーバー）:**
```bash
cd client
npm run dev
# ポート 5173 で起動、ホットリロード有効
# API リクエストは自動的に Server にプロキシされます
```

ブラウザで `http://localhost:5173` にアクセス。

## 本番環境での実行

単一のターミナルで実行：

```bash
# Client をビルドしてから Server を起動
cd client
npm run build
cd ../server
npm start
```

または PowerShell スクリプトを使用：

```powershell
.\setup.ps1
```

ブラウザで `http://localhost:5000` にアクセス（またはサーバーが起動しているホスト）。

## 外部アクセス

本番環境では、サーバーのホストに合わせて自動的にアクセス可能：

```
http://example.com:5000
https://example.com:5000
```

- 画像は `/images` パスで配信
- API は `/api/*` パスで配信
- WebSocket は同じホスト・ポートで接続

## 構成

```
├── client/              # React アプリケーション
│   ├── dist/           # ビルド出力（Server が配信）
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── ...
│   └── vite.config.js  # API プロキシ設定
│
├── server/             # Node.js + Express サーバー
│   ├── src/
│   │   ├── routes/
│   │   ├── db/
│   │   └── index.js    # Server メイン（dist 配信）
│   └── data/images/    # 画像ストレージ
│
└── setup.ps1           # 本番ビルド＆起動スクリプト
```

## 環境変数

### Client (.env)
```
VITE_API_BASE_URL=/api
```

- 開発環境: `/api` は Vite proxy で localhost:5000 にプロキシ
- 本番環境: `/api` は同じホスト・ポートの Server API

### Server (.env)
```
PORT=5000
DATABASE_URL=postgresql://...
CORS_ORIGIN=*
```

## トラブルシューティング

### 画像が表示されない
- 本番環境では Server が起動していることを確認
- `/images` エンドポイントが アクセス可能か確認

### WebSocket 接続できない
- ポート 5000 が開いていることを確認
- 本番環境では `ws://` または `wss://` プロトコルが通っていることを確認

### API リクエストが 404
- 開発環境では Vite dev server が起動していることを確認
- 本番環境では Server が `/api/*` ルートを処理していることを確認
