# デプロイ構成（本番想定 / テストVPS）

`sports.stemask.com`（Cloudflare 配下）で稼働する構成のインフラ定義です。
SSH でサーバーに直接加えた設定をリポジトリで管理できるよう、ここに集約しています。

## 構成図

```
ブラウザ ──HTTPS(CF正規証明書)──> Cloudflare ──HTTPS(自己署名/Full)──> Caddy(80/443) ──> Node app(localhost:5000)
                                                                                          ├─ PostgreSQL 18
                                                                                          └─ Redis 8 (任意)
```

| レイヤ | 内容 |
|---|---|
| OS | Ubuntu 26.04 LTS / x86_64 / 3 vCPU / 3.9GB RAM |
| ランタイム | Node.js 22 (NodeSource LTS) |
| DB | PostgreSQL 18（DB `ask_2026_sports`、ユーザ `postgres`） |
| キャッシュ | Redis 8（未起動でもアプリはインメモリにフォールバック） |
| アプリ常駐 | systemd `ask-sports.service`（このディレクトリの定義） |
| リバースプロキシ | Caddy v2（このディレクトリの `Caddyfile`、`tls internal`） |
| 配置先 | `/root/ASK_2026_sports` |

## ファイル

- `ask-sports.service` … `/etc/systemd/system/ask-sports.service` に配置する systemd ユニット
- `Caddyfile` … `/etc/caddy/Caddyfile` に配置する Caddy 設定
- `../server/.env.example` … サーバー環境変数のテンプレート（実体 `server/.env` は gitignore 対象）

## セットアップ手順（要約）

```bash
# 1) ランタイム/DB/キャッシュ
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
apt-get install -y postgresql postgresql-contrib redis-server
systemctl enable --now postgresql redis-server

# 2) DB 初期化（schema は初回起動時にアプリが適用）
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'CHANGE_ME';"
sudo -u postgres createdb ask_2026_sports

# 3) アプリ配置・依存・ビルド
#   /root/ASK_2026_sports に展開後:
cd /root/ASK_2026_sports/server && npm install
cd /root/ASK_2026_sports/client && npm install && npm run build
cp server/.env.example server/.env   # 値を環境に合わせて編集

# 4) systemd 常駐
cp deploy/ask-sports.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now ask-sports

# 5) Caddy(HTTPS リバースプロキシ)
apt-get install -y caddy   # 公式リポジトリ追加後
cp deploy/Caddyfile /etc/caddy/Caddyfile
systemctl restart caddy
```

## Cloudflare 設定の注意

- DNS は `sports.stemask.com` → Cloudflare（プロキシ ON / オレンジ雲）。
- オリジン証明書は Caddy の `tls internal`（自己署名）なので、Cloudflare の
  **SSL/TLS モードは「Full」**（Full strict ではない）にすること。
- より厳格にするなら Cloudflare Origin Certificate を発行して Caddy に設定し、
  「Full (strict)」へ切り替える。

## 運用コマンド

```bash
journalctl -u ask-sports -f      # アプリログ
journalctl -u caddy -f           # プロキシログ
systemctl restart ask-sports     # アプリ再起動
# 再デプロイ: ソース更新 → (client) npm run build → systemctl restart ask-sports
```

## 既知の調整ポイント（テスト→本番）

- `server/.env`: `NODE_ENV=development` のまま。本番化時は `production` を検討。
- `ADMIN_PASSWORD` / `DB_PASSWORD` がテスト用簡易値。本番では強固な値へ。
- アプリの `:5000` が外部公開されている。Caddy 経由のみにするならファイアウォールで `5000` を塞ぐ。
