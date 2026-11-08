// ============================================================
// 記録の API（API1〜API5）
// くわしくは docs/02_設計/06_API設計書.md の「4. 記録の API」
//
// SQL に値を入れるときは、必ず「?」（プレースホルダー）を使う。
// 入力された値を SQL の文に直接つなげないことで、SQL インジェクションを防ぐ
// ============================================================

import { Router } from 'express';
import { pool } from '../db.js';
import { validateRecord, isValidMonth, parseId } from '../validation.js';

export const recordsRouter = Router();

// 記録を取り出すときの共通の部分（記録とカテゴリをつなげて、API の項目の名前にそろえる）
const SELECT_RECORD = `
  SELECT r.id, r.recorded_on AS date, c.type, r.category_id AS categoryId,
         c.name AS categoryName, r.amount, r.memo
  FROM records AS r
  JOIN categories AS c ON c.id = r.category_id`;

// 番号で記録を1件取り出す（なければ undefined）
async function findRecord(id) {
  const [rows] = await pool.query(`${SELECT_RECORD} WHERE r.id = ?`, [id]);
  return rows[0];
}

// データベースの「外部キーの決まり」で止められたか（ないカテゴリの番号を使った）
const isMissingCategory = (err) => err.code === 'ER_NO_REFERENCED_ROW_2';

// ------------------------------------------------------------
// API1 記録の一覧と合計を取り出す：GET /api/records?month=2026-11
// ------------------------------------------------------------
recordsRouter.get('/', async (req, res) => {
  const { month } = req.query;
  if (!isValidMonth(month)) {
    res.status(400).json({ errors: { month: 'S04' } });
    return;
  }

  // その月の1日から、次の月の1日の前まで
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  // 一覧：日付の新しい順、同じ日は番号の大きい順（あとから登録した順）
  const [records] = await pool.query(
    `${SELECT_RECORD}
     WHERE r.recorded_on >= ? AND r.recorded_on < ?
     ORDER BY r.recorded_on DESC, r.id DESC`,
    [from, to],
  );

  // 合計と繰越：計算はデータベース（SQL）に任せる
  //   income・expense：その月の収入・支出の合計
  //   carryover    ：その月の1日より前の、すべての記録の（収入 − 支出）＝前月からの繰越（保存せず、毎回計算する）
  const [[sum]] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN r.recorded_on >= ? AND c.type = 'income'  THEN r.amount END), 0) AS income,
            COALESCE(SUM(CASE WHEN r.recorded_on >= ? AND c.type = 'expense' THEN r.amount END), 0) AS expense,
            COALESCE(SUM(CASE WHEN r.recorded_on <  ? THEN IF(c.type = 'income', r.amount, -r.amount) END), 0) AS carryover
     FROM records AS r
     JOIN categories AS c ON c.id = r.category_id
     WHERE r.recorded_on < ?`,
    [from, from, from, to],
  );
  // SUM の結果は文字で返ってくるので、数に変える
  const income = Number(sum.income);
  const expense = Number(sum.expense);
  const carryover = Number(sum.carryover);
  const balance = income - expense;

  res.status(200).json({
    month,
    totals: { income, expense, balance, carryover, closing: carryover + balance },
    records,
  });
});

// ------------------------------------------------------------
// API2 記録を1件取り出す：GET /api/records/{番号}
// ------------------------------------------------------------
recordsRouter.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const record = id === null ? undefined : await findRecord(id);
  if (!record) {
    res.status(404).json({ message: 'S02' });
    return;
  }
  res.status(200).json(record);
});

// ------------------------------------------------------------
// API3 記録を登録する：POST /api/records
// ------------------------------------------------------------
recordsRouter.post('/', async (req, res) => {
  const { errors, value } = validateRecord(req.body);
  if (Object.keys(errors).length > 0) {
    res.status(400).json({ errors });
    return;
  }

  let result;
  try {
    [result] = await pool.query(
      'INSERT INTO records (category_id, recorded_on, amount, memo) VALUES (?, ?, ?, ?)',
      [value.categoryId, value.date, value.amount, value.memo],
    );
  } catch (err) {
    // ないカテゴリの番号（ほかの画面で削除された）：E13
    if (isMissingCategory(err)) {
      res.status(400).json({ errors: { categoryId: 'E13' } });
      return;
    }
    throw err;
  }

  // 201（作った）のときは、できた記録の場所（Location）も返す（REST の決まりごと）
  res.status(201).location(`/api/records/${result.insertId}`).json(await findRecord(result.insertId));
});

// ------------------------------------------------------------
// API4 記録を修正する：PUT /api/records/{番号}
// ------------------------------------------------------------
recordsRouter.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ message: 'S02' });
    return;
  }

  const { errors, value } = validateRecord(req.body);
  if (Object.keys(errors).length > 0) {
    res.status(400).json({ errors });
    return;
  }

  let result;
  try {
    [result] = await pool.query(
      'UPDATE records SET category_id = ?, recorded_on = ?, amount = ?, memo = ? WHERE id = ?',
      [value.categoryId, value.date, value.amount, value.memo, id],
    );
  } catch (err) {
    if (isMissingCategory(err)) {
      res.status(400).json({ errors: { categoryId: 'E13' } });
      return;
    }
    throw err;
  }

  // 書き換えた記録が0件 = その番号の記録がない（ほかの画面で削除された）
  if (result.affectedRows === 0) {
    res.status(404).json({ message: 'S02' });
    return;
  }
  res.status(200).json(await findRecord(id));
});

// ------------------------------------------------------------
// API5 記録を削除する：DELETE /api/records/{番号}
// ------------------------------------------------------------
recordsRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ message: 'S02' });
    return;
  }

  const [result] = await pool.query('DELETE FROM records WHERE id = ?', [id]);
  if (result.affectedRows === 0) {
    res.status(404).json({ message: 'S02' });
    return;
  }
  res.status(204).end();
});
