// ============================================================
// API の組み立て（どのお願いを、どこで受けるか）
// 決まりごとは docs/02_設計/06_API設計書.md を参照
// ============================================================

import express from 'express';
import { healthRouter } from './routes/health.js';
import { recordsRouter } from './routes/records.js';
import { categoriesRouter } from './routes/categories.js';

export function createApp() {
  const app = express();

  // 使っている部品の名前を、返す結果に書かない（攻撃の手がかりを減らすため）
  app.disable('x-powered-by');

  // 送られてきた本文（JSON）を読み取る。大きすぎる本文は受け付けない
  app.use(express.json({ limit: '10kb' }));

  // ---------- API ----------
  app.use('/api/health', healthRouter); // API11
  app.use('/api/records', recordsRouter); // API1〜API5
  app.use('/api/categories', categoriesRouter); // API6〜API10

  // ---------- 決まっていないパスに送られたとき（S03） ----------
  app.use((req, res) => {
    res.status(404).json({ message: 'S03' });
  });

  // ---------- 共通のエラー処理 ----------
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // 本文が JSON として読めないとき（S04）
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
      res.status(400).json({ message: 'S04' });
      return;
    }
    // 思わぬ問題：くわしい内容は記録（ログ）にだけ残し、使う人には番号だけを返す
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
    res.status(500).json({ message: 'S04' });
  });

  return app;
}
