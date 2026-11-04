// ============================================================
// 集計の API（API12）
// くわしくは docs/02_設計/06_API設計書.md の「7. 集計の API」
//
// SQL に値を入れるときは、必ず「?」（プレースホルダー）を使う
// ============================================================

import { Router } from 'express';
import { pool } from '../db.js';
import { isValidYear } from '../validation.js';

export const summaryRouter = Router();

// 収入の合計・支出の合計を計算する SQL の共通の部分（記録の種類は、カテゴリから決める）
const SUM_COLUMNS = `
  COALESCE(SUM(CASE WHEN c.type = 'income'  THEN r.amount END), 0) AS income,
  COALESCE(SUM(CASE WHEN c.type = 'expense' THEN r.amount END), 0) AS expense`;

// SUM の結果は文字で返ってくるので、数に変えて、差額も付ける
function toTotals(row) {
  const income = Number(row?.income ?? 0);
  const expense = Number(row?.expense ?? 0);
  return { income, expense, balance: income - expense };
}

// ------------------------------------------------------------
// API12 年の合計と、月ごとの合計を取り出す：GET /api/summary?year=2026
// ------------------------------------------------------------
summaryRouter.get('/', async (req, res) => {
  const { year } = req.query;
  if (!isValidYear(year)) {
    res.status(400).json({ errors: { year: 'S04' } });
    return;
  }

  // その年の1月1日から、次の年の1月1日の前まで
  const from = `${year}-01-01`;
  const to = `${Number(year) + 1}-01-01`;

  // 月ごとの合計：計算はデータベース（SQL）に任せる。記録のある月だけが返ってくる
  const [monthRows] = await pool.query(
    `SELECT DATE_FORMAT(r.recorded_on, '%Y-%m') AS month, ${SUM_COLUMNS}
     FROM records AS r
     JOIN categories AS c ON c.id = r.category_id
     WHERE r.recorded_on >= ? AND r.recorded_on < ?
     GROUP BY month`,
    [from, to],
  );

  // 年の合計
  const [[yearRow]] = await pool.query(
    `SELECT ${SUM_COLUMNS}
     FROM records AS r
     JOIN categories AS c ON c.id = r.category_id
     WHERE r.recorded_on >= ? AND r.recorded_on < ?`,
    [from, to],
  );

  // 記録のない月を 0 でうめて、1月〜12月の12か月分にそろえる
  const byMonth = new Map(monthRows.map((row) => [row.month, row]));
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`;
    return { month, ...toTotals(byMonth.get(month)) };
  });

  res.status(200).json({ year: Number(year), totals: toTotals(yearRow), months });
});
