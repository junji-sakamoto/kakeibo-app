// ============================================================
// API11 処理側が動いているかを確かめる
// GET /api/health
// くわしくは docs/02_設計/06_API設計書.md の「API11」
// ============================================================

import { Router } from 'express';
import { pool } from '../db.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  // データベースにもつながるかを確かめる（つながらなければ、下の共通のエラー処理で 500 になる）
  await pool.query('SELECT 1');
  res.status(200).json({ status: 'ok' });
});
