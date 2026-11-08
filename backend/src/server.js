// ============================================================
// 処理側（バックエンド）を起動する入口
// 起動のしかた：backend フォルダで「npm start」（直すたびに自動で起動し直すときは「npm run dev」）
// ============================================================

import { createApp } from './app.js';
import { pool } from './db.js';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);

const server = createApp().listen(port, host, () => {
  console.log(`処理側を起動しました：http://${host}:${port}`);
  console.log('止めるときは Ctrl + C を押してください');
});

// 止める合図（Ctrl + C、本番のサーバーからの停止の合図）を受けたら、
// 受け付け中のお願いを終わらせ、データベースとのつなぎ口を閉じてから止まる
function shutdown(signal) {
  console.log(`${signal} を受け取りました。止める準備をしています…`);
  server.close(async () => {
    await pool.end();
    console.log('処理側を止めました');
    process.exit(0);
  });
  // 10秒たっても終わらないときは、そのまま止める
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
