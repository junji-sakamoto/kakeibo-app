-- ============================================================
-- データベースが決まり（テーブル定義書）どおりに動くかを確かめる
-- 実行のしかたは docs/03_手順書/01_データベースの手順書.md を参照
--
-- ・「エラーになるはず」の確認では、ERROR が出れば合格
-- ・最後に ROLLBACK（取り消し）するので、データベースは元の状態に戻る
-- ============================================================

SET NAMES utf8mb4;

-- 確認で使うカテゴリ（支出用の「食費」）の番号を調べておく
SET @food_id = (SELECT id FROM categories WHERE type = 'expense' AND name = '食費');

START TRANSACTION;

-- ------------------------------------------------------------
SELECT '確認1：月ごとの合計（収入・支出・差額）が計算できる' AS 確認;
-- ------------------------------------------------------------
SELECT
  DATE_FORMAT(r.recorded_on, '%Y-%m')                              AS 月,
  SUM(CASE WHEN c.type = 'income'  THEN r.amount ELSE 0 END)       AS 収入,
  SUM(CASE WHEN c.type = 'expense' THEN r.amount ELSE 0 END)       AS 支出,
  SUM(CASE WHEN c.type = 'income'  THEN r.amount ELSE -r.amount END) AS 差額
FROM records AS r
JOIN categories AS c ON c.id = r.category_id
GROUP BY 月
ORDER BY 月;

-- ------------------------------------------------------------
SELECT '確認2：今月の記録を、日付の新しい順（同じ日は後から登録した順）に並べられる' AS 確認;
-- ------------------------------------------------------------
SELECT r.id AS 番号, r.recorded_on AS 日付,
       CASE c.type WHEN 'income' THEN '収入' ELSE '支出' END AS 種類,
       c.name AS カテゴリ, r.amount AS 金額, r.memo AS メモ
FROM records AS r
JOIN categories AS c ON c.id = r.category_id
WHERE r.recorded_on >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
  AND r.recorded_on <  DATE_FORMAT(CURDATE(), '%Y-%m-01') + INTERVAL 1 MONTH
ORDER BY r.recorded_on DESC, r.id DESC;

-- ------------------------------------------------------------
SELECT '確認3：同じ種類に同じ名前のカテゴリは登録できない（ERROR 1062 が出れば合格）' AS 確認;
-- ------------------------------------------------------------
INSERT INTO categories (type, name) VALUES ('expense', '食費');

-- ------------------------------------------------------------
SELECT '確認4：種類が違えば、同じ名前のカテゴリを登録できる（エラーが出なければ合格）' AS 確認;
-- ------------------------------------------------------------
INSERT INTO categories (type, name) VALUES ('income', '食費');

-- ------------------------------------------------------------
SELECT '確認5：「カフェ」「かふぇ」「ｶﾌｪ」「ハス」「バス」「Food」「food」は別の名前として登録できる（7件登録されれば合格）' AS 確認;
-- ------------------------------------------------------------
INSERT INTO categories (type, name) VALUES
  ('expense', 'カフェ'), ('expense', 'かふぇ'), ('expense', 'ｶﾌｪ'),
  ('expense', 'ハス'),   ('expense', 'バス'),
  ('expense', 'Food'),   ('expense', 'food');
SELECT ROW_COUNT() AS 登録した件数;

-- ------------------------------------------------------------
SELECT '確認6：記録で使われているカテゴリは削除できない（ERROR 1451 が出れば合格）' AS 確認;
-- ------------------------------------------------------------
DELETE FROM categories WHERE type = 'expense' AND name = '食費';

-- ------------------------------------------------------------
SELECT '確認7：記録で使われていないカテゴリは削除できる（1件削除されれば合格）' AS 確認;
-- ------------------------------------------------------------
-- ほかの確認の結果に左右されないように、ここで使われていないカテゴリを作ってから削除する
INSERT INTO categories (type, name) VALUES ('expense', '削除の確認用');
DELETE FROM categories WHERE type = 'expense' AND name = '削除の確認用';
SELECT ROW_COUNT() AS 削除した件数;

-- ------------------------------------------------------------
SELECT '確認8：金額が 0 円の記録は登録できない（ERROR 3819 が出れば合格）' AS 確認;
-- ------------------------------------------------------------
INSERT INTO records (category_id, recorded_on, amount) VALUES (@food_id, '2026-11-01', 0);

-- ------------------------------------------------------------
SELECT '確認9：金額が 10,000,000 円の記録は登録できない（ERROR 3819 が出れば合格）' AS 確認;
-- ------------------------------------------------------------
INSERT INTO records (category_id, recorded_on, amount) VALUES (@food_id, '2026-11-01', 10000000);

-- ------------------------------------------------------------
SELECT '確認10：日付が範囲外（1999-12-31）の記録は登録できない（ERROR 3819 が出れば合格）' AS 確認;
-- ------------------------------------------------------------
INSERT INTO records (category_id, recorded_on, amount) VALUES (@food_id, '1999-12-31', 100);

-- ------------------------------------------------------------
SELECT '確認11：ないカテゴリの番号を使った記録は登録できない（ERROR 1452 が出れば合格）' AS 確認;
-- ------------------------------------------------------------
INSERT INTO records (category_id, recorded_on, amount) VALUES (9999, '2026-11-01', 100);

-- ------------------------------------------------------------
SELECT '確認12：メモが 101 文字の記録は登録できない（ERROR 1406 が出れば合格）' AS 確認;
-- ------------------------------------------------------------
INSERT INTO records (category_id, recorded_on, amount, memo) VALUES (@food_id, '2026-11-01', 100, REPEAT('あ', 101));

-- ------------------------------------------------------------
SELECT '確認13：種類が income・expense 以外のカテゴリは登録できない（ERROR 3819 が出れば合格）' AS 確認;
-- ------------------------------------------------------------
INSERT INTO categories (type, name) VALUES ('other', 'テスト');

-- ------------------------------------------------------------
SELECT '確認14：名前が空のカテゴリは登録できない（ERROR 3819 が出れば合格）' AS 確認;
-- ------------------------------------------------------------
INSERT INTO categories (type, name) VALUES ('expense', '');

-- ------------------------------------------------------------
SELECT '確認15：名前が 21 文字のカテゴリは登録できない（ERROR 1406 が出れば合格）' AS 確認;
-- ------------------------------------------------------------
INSERT INTO categories (type, name) VALUES ('expense', REPEAT('あ', 21));

-- ------------------------------------------------------------
SELECT '確認16：正しい記録は登録でき、メモを省くと空の文字になる（1件登録されれば合格）' AS 確認;
-- ------------------------------------------------------------
INSERT INTO records (category_id, recorded_on, amount) VALUES (@food_id, '2026-11-01', 9999999);
SELECT id AS 番号, amount AS 金額, CONCAT('[', memo, ']') AS メモ FROM records WHERE id = LAST_INSERT_ID();

-- ------------------------------------------------------------
SELECT '確認17：カテゴリの並び順は登録した順で、「その他」はいつも一番下（新しく登録した「ペット」が「その他」のすぐ上なら合格）' AS 確認;
-- ------------------------------------------------------------
INSERT INTO categories (type, name) VALUES ('expense', 'ペット');
SELECT name AS 支出用のカテゴリ
FROM categories
WHERE type = 'expense'
  AND name IN ('交際費', 'ペット', 'その他')
ORDER BY (name = 'その他'), id;

-- ------------------------------------------------------------
-- ここまでの変更をすべて取り消す
-- ------------------------------------------------------------
ROLLBACK;

-- ------------------------------------------------------------
SELECT '確認18：取り消したあと、元の件数（カテゴリ 18件・記録 28件）に戻っている' AS 確認;
-- ------------------------------------------------------------
SELECT (SELECT COUNT(*) FROM categories) AS カテゴリの件数,
       (SELECT COUNT(*) FROM records)    AS 記録の件数;
