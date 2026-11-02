-- ============================================================
-- データを空にする（お試し用データを最初の状態に戻す前に使う）
-- このあとに 02_insert_categories.sql と 03_insert_sample_records.sql を実行する
-- 手順は docs/手順書/データベースの手順書.md を参照
-- ※ テーブルの形はそのまま残し、中のデータだけを消す
-- ============================================================

SET NAMES utf8mb4;

-- 記録を先に消す（カテゴリを先に消すと、外部キーの決まりで止められるため）
DELETE FROM records;
DELETE FROM categories;

-- 自動で付く番号を 1 から付け直す
ALTER TABLE records    AUTO_INCREMENT = 1;
ALTER TABLE categories AUTO_INCREMENT = 1;
