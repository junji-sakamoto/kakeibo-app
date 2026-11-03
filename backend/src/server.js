// ============================================================
// 処理側（バックエンド）を起動する入口
// 起動のしかた：backend フォルダで「npm start」（直すたびに自動で起動し直すときは「npm run dev」）
// ============================================================

import { createApp } from './app.js';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);

createApp().listen(port, host, () => {
  console.log(`処理側を起動しました：http://${host}:${port}`);
  console.log('止めるときは Ctrl + C を押してください');
});
