// ============================================================
// カテゴリの API（API6〜API10）
// くわしくは docs/02_設計/06_API設計書.md の「5. カテゴリの API」
//
// 「同じ名前のカテゴリ（E11）」と「記録で使われているカテゴリの削除（E12）」は、
// 先に調べずに、データベースの決まり（同じ値を許さない決まり・外部キーの決まり）に任せる。
// 先に調べると、調べてから書き込むまでの間にほかの画面で操作されたとき、すり抜けてしまうため
// ============================================================

import { Router } from 'express';
import { pool } from '../db.js';
import { validateCategory, parseId } from '../validation.js';

export const categoriesRouter = Router();

// 番号でカテゴリを1件取り出す（なければ undefined）
async function findCategory(id) {
  const [rows] = await pool.query('SELECT id, type, name FROM categories WHERE id = ?', [id]);
  return rows[0];
}

// データベースの決まりで止められたか
const isDuplicateName = (err) => err.code === 'ER_DUP_ENTRY'; // 同じ種類に同じ名前がある
const isUsedByRecords = (err) => err.code === 'ER_ROW_IS_REFERENCED_2'; // 記録で使われている

// ------------------------------------------------------------
// API6 カテゴリの一覧を取り出す：GET /api/categories
// 並び順：収入用 → 支出用。それぞれ登録した順。ただし「その他」は一番下
// ------------------------------------------------------------
categoriesRouter.get('/', async (req, res) => {
  const [categories] = await pool.query(
    `SELECT id, type, name
     FROM categories
     ORDER BY FIELD(type, 'income', 'expense'), (name = 'その他'), id`,
  );
  res.status(200).json({ categories });
});

// ------------------------------------------------------------
// API7 カテゴリを1件と、使われている記録の件数を取り出す：GET /api/categories/{番号}
// ------------------------------------------------------------
categoriesRouter.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const [rows] = id === null ? [[]] : await pool.query(
    `SELECT c.id, c.type, c.name,
            (SELECT COUNT(*) FROM records AS r WHERE r.category_id = c.id) AS recordCount
     FROM categories AS c
     WHERE c.id = ?`,
    [id],
  );
  if (rows.length === 0) {
    res.status(404).json({ message: 'S02' });
    return;
  }
  res.status(200).json({ ...rows[0], recordCount: Number(rows[0].recordCount) });
});

// ------------------------------------------------------------
// API8 カテゴリを登録する：POST /api/categories
// ------------------------------------------------------------
categoriesRouter.post('/', async (req, res) => {
  const { errors, value } = validateCategory(req.body, { withType: true });
  if (Object.keys(errors).length > 0) {
    res.status(400).json({ errors });
    return;
  }

  let result;
  try {
    [result] = await pool.query('INSERT INTO categories (type, name) VALUES (?, ?)', [value.type, value.name]);
  } catch (err) {
    if (isDuplicateName(err)) {
      res.status(409).json({ errors: { name: 'E11' } });
      return;
    }
    throw err;
  }
  // 201（作った）のときは、できたカテゴリの場所（Location）も返す（REST の決まりごと）
  res.status(201).location(`/api/categories/${result.insertId}`).json(await findCategory(result.insertId));
});

// ------------------------------------------------------------
// API9 カテゴリの名前を修正する：PUT /api/categories/{番号}
// 種類は変えられないので、送られてきても使わない
// ------------------------------------------------------------
categoriesRouter.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ message: 'S02' });
    return;
  }

  const { errors, value } = validateCategory(req.body, { withType: false });
  if (Object.keys(errors).length > 0) {
    res.status(400).json({ errors });
    return;
  }

  let result;
  try {
    [result] = await pool.query('UPDATE categories SET name = ? WHERE id = ?', [value.name, id]);
  } catch (err) {
    if (isDuplicateName(err)) {
      res.status(409).json({ errors: { name: 'E11' } });
      return;
    }
    throw err;
  }

  if (result.affectedRows === 0) {
    res.status(404).json({ message: 'S02' });
    return;
  }
  res.status(200).json(await findCategory(id));
});

// ------------------------------------------------------------
// API10 カテゴリを削除する：DELETE /api/categories/{番号}
// ------------------------------------------------------------
categoriesRouter.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ message: 'S02' });
    return;
  }

  let result;
  try {
    [result] = await pool.query('DELETE FROM categories WHERE id = ?', [id]);
  } catch (err) {
    if (isUsedByRecords(err)) {
      res.status(409).json({ message: 'E12' });
      return;
    }
    throw err;
  }

  if (result.affectedRows === 0) {
    res.status(404).json({ message: 'S02' });
    return;
  }
  res.status(204).end();
});
