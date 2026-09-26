# ハナハナカウンター

ハナハナシリーズ用の小役カウンター＆設定推測ツール。単一HTMLで動き、Googleスプレッドシートに実戦データを蓄積できる。

対応機種: ハナハナホウオウ～天翔～ / キングハナハナ / ドラゴンハナハナ～閃光～ / スターハナハナ / ニューキングハナハナⅤ

## 使い方
`index.html` を GitHub Pages 等で配信し、iPhone Safari で開く。操作は [docs/SPEC.md](docs/SPEC.md)。

## スプレッドシート連携
1. スプレッドシート → 拡張機能 → Apps Script に `gas/Code.gs` を貼って保存
2. `TOKEN` を任意の文字列に変更
3. デプロイ → 新しいデプロイ → ウェブアプリ（実行: 自分 / アクセス: 全員）
4. 発行された URL とトークンをアプリの ⚙️設定 に入力

コードを変えたら「デプロイを管理 → ✏️ → 新バージョン」で再デプロイ（URL は変わらない）。

## 開発
```bash
npm install
npm test
```
Claude Code で作業する場合は [CLAUDE.md](CLAUDE.md) が自動で読み込まれる。

## Claude Code への移行手順

### A. 既存の GitHub Pages リポジトリに入れる場合
1. このフォルダの中身を、`index.html` を配信しているリポジトリにコピー（`index.html` は上書き。現在の本番と同じ内容）
2. `gas/Code.gs` は Apps Script と同じ内容なので置くだけでよい
3. リポジトリで `npm install && npm test` → 43件通ることを確認
4. `claude` を起動

### B. 新しいリポジトリとして始める場合
1. このフォルダを GitHub に push（`git init` 済み・初回コミット済み）
2. GitHub Pages を有効化するか、本番リポジトリへ `index.html` をコピーしてデプロイ

### 最初に Claude Code へ伝えると良いこと
```
CLAUDE.md と docs/ を読んで、プロジェクトの現状を把握してください。
そのあと npm test を実行して全件通るか確認してください。
```

スラッシュコマンド:
- `/verify` — テスト実行と失敗原因の調査
- `/update-params <機種> <内容>` — 機種スペックを計算用・表示用ペアで安全に更新
- `/calibrate <機種> <データ>` — 実機差枚から係数を逆算
