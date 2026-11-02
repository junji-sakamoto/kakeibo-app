# 課題の条件と使う技術

## 課題の条件（スクールの指示）

1. フロントエンド・バックエンド・データベースを、それぞれ作る
2. React・Java・PostgreSQL などは使わず、代わりのものを使う
3. TypeScript は使ってもよい
4. 本番環境（デプロイ先）は AWS の EC2 と RDS の構成にする
5. 提出は GitHub の URL。main ブランチではなく、作業用ブランチ（develop）で作業する

> 途中で新しい条件に気づいたら、ここに追記する。

## 使う技術

| 部品 | 役割 | 使うもの | 置き換えた元 | フォルダ |
|---|---|---|---|---|
| フロントエンド | 画面・見た目 | Vue.js（JavaScript） | React | `frontend/` |
| バックエンド | データの受け付け・保存・集計 | Node.js + Express（JavaScript） | Java | `backend/` |
| データベース | データの保存 | MySQL | PostgreSQL | `database/` |

- 言語は JavaScript に統一する（TypeScript は使ってよいが、分かりやすさを優先して使わない）
- Tailwind CSS は使わない（以前の指示にあったため、念のため）

## 本番環境の構成

```
[ブラウザ] → [EC2：フロントエンド + バックエンド] → [RDS：MySQL]
```

## 条件を満たしているかの確認

| 条件 | どう満たすか |
|---|---|
| 3つの部品を作る | `frontend/`・`backend/`・`database/` にフォルダを分けて作る |
| React・Java・PostgreSQL を使わない | Vue.js・Node.js・MySQL に置き換える |
| EC2 + RDS | EC2 でフロントとバックを動かし、RDS の MySQL につなぐ |
| 作業用ブランチで作業 | `develop` ブランチで作業する |
