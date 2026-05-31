# 体育祭掲示板アプリケーション

STEM研究部体育祭専用のリアルタイム掲示板アプリケーションです。観戦者がリアルタイムで応援メッセージを投稿・表示できます。

## 🎯 主な機能

- **リアルタイム投稿表示** - WebSocket使用で即座に新規投稿が反映
- **投稿機能** - テキスト＆画像投稿（最大200文字、20MB以下）
- **リアクション機能** - 👍❤️🔥😲 4種類のリアクション
- **管理者機能** - 不適切な投稿の削除
- **NSFW検出** - テキスト＆画像のフィルタリング
- **デバイス識別** - LocalStorageで投稿者を判別

## 💻 技術スタック

### バックエンド
- **Node.js + Express.js**
- **PostgreSQL**
- **WebSocket (ws)**
- **Multer** - 画像アップロード
- **NSFWJS** - NSFW検出

### フロントエンド
- **React 18**
- **Vite**
- **WebSocket クライアント**

## 🚀 クイックスタート

### 前提条件

- **Node.js** v16以上
- **PostgreSQL** 12以上
- **npm** または **yarn**

### セットアップ手順

#### 1. PostgreSQL データベース初期化

```bash
# PostgreSQL が起動していることを確認
# Windows の場合、PostgreSQL サービスが実行中か確認

# psql に接続（デフォルト: user=postgres）
psql -U postgres

# データベース作成
CREATE DATABASE ask_2026_sports;

# スキーマ適用
\q  # psql を終了
psql -U postgres -d ask_2026_sports -f schema.sql
```

#### 2. バックエンド環境変数設定

```bash
cd server

# .env ファイルの DB 接続情報を確認・編集
```

#### 3. 依存パッケージのインストール

```bash
# バックエンド
cd server
npm install

# フロントエンド（新しいターミナルで）
cd client
npm install
```

#### 4. アプリケーション起動

**ターミナル 1: バックエンド起動**
```bash
cd server
npm start
# または開発モード（ホットリロード）
npm run dev
```

出力例：
```
🚀 Server running on http://localhost:5000
📡 WebSocket server running on ws://localhost:5000
```

**ターミナル 2: フロントエンド起動**
```bash
cd client
npm run dev
```

出力例：
```
VITE v4.4.0 ready in 123 ms
Local:    http://localhost:5173/
```

## 🌐 アクセス

- **フロントエンド**: [http://localhost:5173](http://localhost:5173)
- **バックエンド API**: [http://localhost:5000](http://localhost:5000)
- **管理ページ**: [http://localhost:5173/admin](http://localhost:5173) → 「管理」タブ

### 管理者認証

**デフォルトパスワード**: `1234`

> ⚠️ **本番環境では必ず変更してください**（`.env` ファイルの `ADMIN_PASSWORD`）

## 📁 プロジェクト構成

```
ASK_2026_sports/
├── server/                    # バックエンド
│   ├── src/
│   │   ├── index.js          # メインアプリケーション
│   │   ├── db/               # データベース接続
│   │   ├── routes/           # API ルート
│   │   ├── middleware/       # ミドルウェア
│   │   ├── utils/            # ユーティリティ
│   │   └── websocket/        # WebSocket ハンドラー
│   ├── data/
│   │   └── images/           # アップロード画像
│   ├── schema.sql            # DB スキーマ
│   ├── .env                  # 環境変数
│   └── package.json
├── client/                    # フロントエンド
│   ├── src/
│   │   ├── main.jsx          # エントリーポイント
│   │   ├── App.jsx           # メインコンポーネント
│   │   ├── pages/            # ページコンポーネント
│   │   ├── components/       # 再利用可能コンポーネント
│   │   ├── hooks/            # React カスタムフック
│   │   └── utils/            # ユーティリティ
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docs/                      # 仕様書
├── schema.sql                 # DB スキーマ（ルート）
├── README.md                  # このファイル
└── .gitignore
```

## 📱 ページ説明

### メインページ (/)
- すべての投稿を新しい順に表示
- ページネーション機能
- リアクション追加可能
- リアルタイム更新

### 投稿ページ (/post)
- ニックネーム入力
- テキスト投稿（最大200文字）
- 画像アップロード（オプション）
- 投稿後は自動的にメインページへ移動

### 管理ページ (/admin)
- パスワード認証
- すべての投稿を表示（削除済みも含む）
- 投稿削除機能
- 統計情報表示

## 🔌 API エンドポイント

### 投稿 API

```
GET  /api/posts              # 投稿一覧取得（ページネーション対応）
POST /api/posts              # 新規投稿（フォームデータ）
POST /api/posts/:postId/reactions  # リアクション追加
```

### 管理者 API

```
POST /api/admin/posts           # 全投稿取得（認証必須）
POST /api/admin/posts/:postId/delete  # 投稿削除（認証必須）
POST /api/admin/statistics      # 統計情報取得（認証必須）
```

## 🔄 WebSocket イベント

```
connected      # 接続成功
new_post       # 新規投稿受信
post_deleted   # 投稿削除
reaction_update # リアクション更新
```

## ⚙️ 環境変数 (.env)

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ask_2026_sports
DB_USER=postgres
DB_PASSWORD=your_password_here

# Admin Configuration
ADMIN_PASSWORD=1234

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# Image Upload
MAX_FILE_SIZE=20971520  # 20MB
UPLOAD_DIR=./data/images
```

## 🐛 トラブルシューティング

### `Connection refused` エラー
- PostgreSQL が起動しているか確認
- `.env` の DB 接続情報を確認

### ポート既に使用中
```bash
# Windows で 5000 ポートを使用中のプロセスを確認
netstat -ano | findstr :5000

# 5173 ポートを使用中のプロセスを確認
netstat -ano | findstr :5173
```

### 画像アップロード失敗
- `server/data/images/` ディレクトリが存在するか確認
- ファイルサイズが 20MB 以下か確認

### WebSocket 接続失敗
- ファイアウォール設定を確認
- バックエンドが起動しているか確認

## 📊 データベーススキーマ

### posts テーブル
```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  device_id VARCHAR(255),
  nickname VARCHAR(255),
  content TEXT (max 200 chars),
  image_url VARCHAR(255),
  timestamp TIMESTAMP,
  deleted BOOLEAN,
  created_at TIMESTAMP
);
```

### reactions テーブル
```sql
CREATE TABLE reactions (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES posts(id),
  device_id VARCHAR(255),
  reaction_type VARCHAR(50),
  created_at TIMESTAMP,
  UNIQUE(post_id, device_id, reaction_type)
);
```

## 🔒 セキュリティ機能

- **NSFW検出** - テキストおよび画像のフィルタリング
- **パスワード認証** - 管理者機能へのアクセス制限
- **CORS** - クロスオリジンリクエスト制御
- **ファイルバリデーション** - アップロードファイルの検証

## 📋 仕様書

詳細な仕様は `docs/` ディレクトリを参照：
- `docs/project.md` - プロジェクト概要
- `docs/pages.md` - ページ仕様
- `docs/data.md` - データ構造
- `docs/post.md` - 投稿処理

## 📝 ライセンス

ISC

## 👨‍💻 開発者

YGMS-yukkuri

---

**最終更新**: 2026年5月31日
