# ASK_2026_sports

体育祭用掲示板プロジェクト

## 構成
- `server/` - Node.js + Express サーバー（画像保存、PostgreSQL連携、WebSocket）
- `client/` - React (Vite) フロントエンド
- `docker-compose.yml` - PostgreSQL コンテナ

## 必要環境
- Docker / Docker Compose
- Node.js (推奨 18+)

## 起動手順
1. DockerでPostgresを起動:

```bash
docker compose up -d
```

2. サーバーを起動:

```bash
cd server
cp .env.example .env
# .env を必要に応じて編集（ADMIN_PASSWORDなど）
npm install
npm start
```

3. クライアントを起動（別ターミナル）:

```bash
cd client
npm install
npm run dev
```

クライアントは `http://localhost:5173` (Viteデフォルト) で起動します。サーバーは `http://localhost:4000` を想定しています。

## 管理者操作
- 管理ページはクライアントの `Admin` ページ（Nav -> Admin）からアクセスできます。
- 管理パスワードは `server/.env` の `ADMIN_PASSWORD` に設定し、管理ページで入力して認証します。

## 注意点
- 画像のNSFW判定は現時点では未実装（テキストのみ `bad-words` で簡易チェック）。画像判定を導入する場合は外部APIまたはモデルを追加します。

---
作業を進めた箇所のファイル一覧はコミット履歴を参照してください。
