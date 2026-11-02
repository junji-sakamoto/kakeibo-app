-- ============================================================
-- お試し用の記録（今月・先月・先々月の3か月分、全部で28件）
-- 実行した日を基準に日付を計算するので、いつ実行しても「最近3か月分」になる
-- ※ 削除の確認ができるように、記録で使わないカテゴリ（賞与・臨時収入・その他）も残している
-- ============================================================

SET NAMES utf8mb4;

-- 月の初めの日を計算しておく
SET @this_month   = DATE_FORMAT(CURDATE(), '%Y-%m-01');      -- 今月の1日
SET @last_month   = @this_month - INTERVAL 1 MONTH;          -- 先月の1日
SET @before_last  = @this_month - INTERVAL 2 MONTH;          -- 先々月の1日

-- 「種類」と「カテゴリの名前」から、カテゴリの番号を探して記録を入れる
INSERT INTO records (category_id, recorded_on, amount, memo)
SELECT c.id, s.recorded_on, s.amount, s.memo
FROM (
  -- ---------- 先々月（12件） ----------
  SELECT 'income'  AS type, '給料'   AS name, @before_last + INTERVAL 24 DAY AS recorded_on, 250000 AS amount, '給料' AS memo
  UNION ALL SELECT 'expense', '外食',       @before_last + INTERVAL  1 DAY,   1200, 'ランチ'
  UNION ALL SELECT 'expense', '交通費',     @before_last + INTERVAL  2 DAY,    500, 'バス'
  UNION ALL SELECT 'expense', '食費',       @before_last + INTERVAL  5 DAY,   3800, 'スーパーで買い物'
  UNION ALL SELECT 'expense', '日用品',     @before_last + INTERVAL  8 DAY,   1500, '洗剤・ティッシュ'
  UNION ALL SELECT 'expense', '交際費',     @before_last + INTERVAL 12 DAY,   4000, '友人と食事'
  UNION ALL SELECT 'expense', '光熱費',     @before_last + INTERVAL 14 DAY,   8200, '電気代'
  UNION ALL SELECT 'expense', '光熱費',     @before_last + INTERVAL 17 DAY,   4300, 'ガス代'
  UNION ALL SELECT 'expense', '通信費',     @before_last + INTERVAL 19 DAY,   3300, 'スマートフォン'
  UNION ALL SELECT 'expense', '食費',       @before_last + INTERVAL 20 DAY,   2600, ''
  UNION ALL SELECT 'expense', '趣味・娯楽', @before_last + INTERVAL 22 DAY,   5000, '本'
  UNION ALL SELECT 'expense', '住居費',     @before_last + INTERVAL 26 DAY,  65000, '家賃'

  -- ---------- 先月（13件） ----------
  UNION ALL SELECT 'income',  '給料',       @last_month + INTERVAL 24 DAY, 250000, '給料'
  UNION ALL SELECT 'income',  '副業',       @last_month + INTERVAL 10 DAY,   3000, 'フリマアプリで売上'
  UNION ALL SELECT 'expense', '食費',       @last_month + INTERVAL  0 DAY,   4200, 'スーパーで買い物'
  UNION ALL SELECT 'expense', '交通費',     @last_month + INTERVAL  3 DAY,   1040, '電車（往復）'
  UNION ALL SELECT 'expense', '外食',       @last_month + INTERVAL  6 DAY,    980, 'ランチ'
  UNION ALL SELECT 'expense', '日用品',     @last_month + INTERVAL  9 DAY,    780, '歯みがき粉'
  UNION ALL SELECT 'expense', '光熱費',     @last_month + INTERVAL 14 DAY,   7900, '電気代'
  UNION ALL SELECT 'expense', '医療費',     @last_month + INTERVAL 15 DAY,   1500, '病院'
  UNION ALL SELECT 'expense', '光熱費',     @last_month + INTERVAL 18 DAY,   3100, '水道代'
  UNION ALL SELECT 'expense', '通信費',     @last_month + INTERVAL 19 DAY,   3300, 'スマートフォン'
  UNION ALL SELECT 'expense', '外食',       @last_month + INTERVAL 21 DAY,   5600, '家族で外食'
  UNION ALL SELECT 'expense', '衣服・美容', @last_month + INTERVAL 26 DAY,   2000, '散髪'
  UNION ALL SELECT 'expense', '住居費',     @last_month + INTERVAL 26 DAY,  65000, '家賃'

  -- ---------- 今月（3件。今日より先の日付にならないようにする） ----------
  UNION ALL SELECT 'expense', '食費',   LEAST(@this_month + INTERVAL 0 DAY, CURDATE()), 3500, 'スーパーで買い物'
  UNION ALL SELECT 'expense', '交通費', LEAST(@this_month + INTERVAL 1 DAY, CURDATE()),  500, 'バス'
  UNION ALL SELECT 'expense', '外食',   LEAST(@this_month + INTERVAL 1 DAY, CURDATE()), 1200, 'ランチ'
) AS s
JOIN categories AS c
  ON  c.type = s.type
  AND c.name = s.name COLLATE utf8mb4_bin;
