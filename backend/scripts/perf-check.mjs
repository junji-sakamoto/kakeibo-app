// ============================================================
// 性能の試験（非機能要件「速さ」）
// 決まり（docs/01_要件定義/07_非機能要件.md の「2. 性能・拡張性」）
//   ・記録が1万件あっても、10人が同時に使っても、結果を3秒以内に返す
//
// やること
//   ① お試しデータとは別に、2099年1月〜12月に記録を 10,000 件入れる（メモは「性能試験」）
//   ② 処理側を起動して、次のお願いを送り、かかった時間を測る
//      ・1人：その月の一覧と合計（API1）
//      ・10人が同時に：違う月の一覧と合計（API1）×10
//      ・10人が同時に：カテゴリの一覧（API6）×10
//      ・10人が同時に：記録の登録（API3）×10
//   ③ 入れた記録を全部消す（途中で失敗しても消す）
//
// 実行のしかた：backend フォルダで「npm run perf」（先にデータベースを起動しておく）
// ============================================================

import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';

const COUNT = 10000; // 入れる記録の数
const LIMIT_MS = 3000; // 守る時間（3秒）
const MARK = '性能試験'; // この試験で入れた記録の目印（メモ）

const cleanUp = () => pool.query("DELETE FROM records WHERE memo = ? AND recorded_on >= '2099-01-01'", [MARK]);
const results = [];
let server;

// お願いを送って、かかった時間（ミリ秒）と結果の番号を返す
async function timed(base, method, path, body) {
  const start = performance.now();
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  await res.text();
  return { ms: performance.now() - start, status: res.status };
}

// 同時に送って、いちばん遅かった時間を記録する
async function measure(name, requests, okStatus) {
  const start = performance.now();
  const r = await Promise.all(requests());
  const total = performance.now() - start;
  const max = Math.max(...r.map((x) => x.ms));
  const ok = max <= LIMIT_MS && r.every((x) => x.status === okStatus);
  results.push({ name, count: r.length, max, total, ok });
  console.log(`${ok ? '✔' : '✖'} ${name}：${r.length} 件、いちばん遅いもの ${max.toFixed(0)} ミリ秒（全部で ${total.toFixed(0)} ミリ秒）`);
}

try {
  // ① 記録を 10,000 件入れる（2099年1月1日〜12月31日に、支出と収入を交互に）
  await cleanUp();
  const [[food]] = await pool.query("SELECT id FROM categories WHERE type = 'expense' AND name = '食費'");
  const [[salary]] = await pool.query("SELECT id FROM categories WHERE type = 'income' AND name = '給料'");
  const rows = [];
  for (let i = 0; i < COUNT; i++) {
    const d = new Date(Date.UTC(2099, 0, 1 + (i % 365)));
    rows.push([i % 2 ? food.id : salary.id, d.toISOString().slice(0, 10), 100 + (i % 9000), MARK]);
  }
  for (let i = 0; i < rows.length; i += 1000) {
    await pool.query('INSERT INTO records (category_id, recorded_on, amount, memo) VALUES ?', [rows.slice(i, i + 1000)]);
  }
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM records');
  console.log(`① 記録を ${COUNT} 件入れました（データベースの記録は全部で ${total} 件）`);

  // ② 測る
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  await timed(base, 'GET', '/health'); // 最初の1回は準備に時間がかかることがあるので、測る前に1回送っておく

  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM records WHERE recorded_on >= '2099-06-01' AND recorded_on < '2099-07-01'");
  await measure(`1人：2099年6月の一覧と合計（API1、その月の記録 ${n} 件）`, () => [timed(base, 'GET', '/records?month=2099-06')], 200);
  await measure('10人が同時に：違う月の一覧と合計（API1）', () => Array.from({ length: 10 }, (_, i) => timed(base, 'GET', `/records?month=2099-${String(i + 1).padStart(2, '0')}`)), 200);
  await measure('10人が同時に：カテゴリの一覧（API6）', () => Array.from({ length: 10 }, () => timed(base, 'GET', '/categories')), 200);
  await measure('10人が同時に：記録の登録（API3）', () => Array.from({ length: 10 }, (_, i) => timed(base, 'POST', '/records', { date: `2099-03-${String(i + 1).padStart(2, '0')}`, categoryId: food.id, amount: 100, memo: MARK })), 201);
} catch (err) {
  console.error(`✖ 性能の試験を最後まで行えませんでした：${err.message}`);
  results.push({ ok: false });
} finally {
  // ③ 後片付け
  await cleanUp();
  server?.close();
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM records');
  console.log(`③ 入れた記録を消しました（データベースの記録は ${total} 件に戻りました）`);
  await pool.end();
}

const allOk = results.length > 0 && results.every((r) => r.ok);
console.log(allOk ? `性能の試験：合格（すべて ${LIMIT_MS / 1000} 秒以内）` : '性能の試験：不合格');
process.exit(allOk ? 0 : 1);
