-- ============================================================
-- テーブルを作る
-- くわしい決まりは docs/設計/テーブル定義書.md を参照
-- ============================================================

SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- カテゴリ（categories）
-- ------------------------------------------------------------
CREATE TABLE categories (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT                              COMMENT '番号',
  type       VARCHAR(10)  NOT NULL                                             COMMENT '種類（income：収入用、expense：支出用）',
  name       VARCHAR(20)  NOT NULL                                             COMMENT '名前',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP                   COMMENT '登録した日時',
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP               COMMENT '最後に更新した日時',

  PRIMARY KEY (id),
  -- 同じ種類の中で、同じ名前は登録できない
  UNIQUE KEY uq_categories_type_name (type, name),
  -- 種類は income か expense だけ
  CONSTRAINT chk_categories_type CHECK (type IN ('income', 'expense')),
  -- 名前は空の文字を許さない
  CONSTRAINT chk_categories_name CHECK (name <> '')
)
ENGINE = InnoDB
DEFAULT CHARSET = utf8mb4
-- 完全に同じ文字だけを同じとみなす
-- （「カフェ」と「かふぇ」、全角「カフェ」と半角「ｶﾌｪ」、「Food」と「food」はすべて別の名前）
COLLATE = utf8mb4_bin
COMMENT = 'カテゴリ';

-- ------------------------------------------------------------
-- 記録（records）
-- ------------------------------------------------------------
CREATE TABLE records (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT                             COMMENT '番号',
  category_id INT UNSIGNED NOT NULL                                            COMMENT 'カテゴリの番号',
  recorded_on DATE         NOT NULL                                            COMMENT '日付',
  amount      INT UNSIGNED NOT NULL                                            COMMENT '金額（円）',
  memo        VARCHAR(100) NOT NULL DEFAULT ''                                 COMMENT 'メモ',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP                  COMMENT '登録した日時',
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP              COMMENT '最後に更新した日時',

  PRIMARY KEY (id),
  -- 日付で探すのを速くする（月ごとの一覧・合計で使う）
  KEY idx_records_recorded_on (recorded_on),
  -- カテゴリの番号は categories の id を指す
  -- 記録で使われているカテゴリは削除できない（RESTRICT）
  CONSTRAINT fk_records_category
    FOREIGN KEY (category_id) REFERENCES categories (id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,
  -- 金額は 1〜9,999,999 円
  CONSTRAINT chk_records_amount CHECK (amount BETWEEN 1 AND 9999999),
  -- 日付は 2000-01-01〜2099-12-31
  CONSTRAINT chk_records_recorded_on CHECK (recorded_on BETWEEN '2000-01-01' AND '2099-12-31')
)
ENGINE = InnoDB
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_bin
COMMENT = '記録';
