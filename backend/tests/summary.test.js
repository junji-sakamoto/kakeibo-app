// ============================================================
// 集計の API（API12）の試験（テスト）
// docs/02_設計/06_API設計書.md のとおりに動くかを、実際にお願いを送って確かめる
//
// 実行のしかた：backend フォルダで「npm test」（先にデータベースを起動しておく）
//
// ・お試しデータに影響しないように、2098年12月31日〜2099年の日付だけを使う
// ・試験で作った記録は、最後に全部削除する
// ============================================================

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';

let server;
let base;
let ids; // 試験で使うカテゴリの番号

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const add = (date, categoryId, amount) => call('POST', '/api/records', { date, categoryId, amount, memo: '試験用' });
const cleanup = () => pool.query("DELETE FROM records WHERE recorded_on >= '2098-12-31'");

before(async () => {
  // 前に試験が途中で止まったときの残りを消しておく
  await cleanup();

  const id = async (type, name) => (await pool.query('SELECT id FROM categories WHERE type = ? AND name = ?', [type, name]))[0][0].id;
  ids = { salary: await id('income', '給料'), food: await id('expense', '食費') };

  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await cleanup();
  server.close();
  await pool.end();
});

// ------------------------------------------------------------
describe('API12 年の合計と、月ごとの合計', () => {
  test('記録のない年は、年の合計も12か月分もすべて 0 を返す', async () => {
    const r = await call('GET', '/api/summary?year=2099');
    assert.equal(r.status, 200);
    assert.equal(r.body.year, 2099);
    assert.deepEqual(r.body.totals, { income: 0, expense: 0, balance: 0 });
    assert.equal(r.body.months.length, 12);
    assert.deepEqual(
      r.body.months.map((m) => m.month),
      ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((mm) => `2099-${mm}`),
    );
    for (const m of r.body.months) assert.deepEqual({ ...m, month: undefined }, { month: undefined, income: 0, expense: 0, balance: 0 });
  });

  test('月ごとにまとめて計算し、記録のない月は 0 にする。年の境目（1月1日・12月31日）も正しく分ける', async () => {
    await add('2098-12-31', ids.salary, 777777); // 前の年（入らないはず）
    await add('2099-01-01', ids.salary, 300000);
    await add('2099-01-31', ids.food, 1000);
    await add('2099-03-15', ids.food, 2500);
    await add('2099-03-16', ids.food, 500);
    await add('2099-12-31', ids.food, 400000); // 差額がマイナスになる月

    const r = await call('GET', '/api/summary?year=2099');
    assert.equal(r.status, 200);
    const byMonth = Object.fromEntries(r.body.months.map((m) => [m.month, m]));
    assert.deepEqual(byMonth['2099-01'], { month: '2099-01', income: 300000, expense: 1000, balance: 299000 });
    assert.deepEqual(byMonth['2099-02'], { month: '2099-02', income: 0, expense: 0, balance: 0 });
    assert.deepEqual(byMonth['2099-03'], { month: '2099-03', income: 0, expense: 3000, balance: -3000 });
    assert.deepEqual(byMonth['2099-12'], { month: '2099-12', income: 0, expense: 400000, balance: -400000 });
    // 年の合計（前の年の 777,777 円は入らない）
    assert.deepEqual(r.body.totals, { income: 300000, expense: 404000, balance: -104000 });
  });

  test('12か月分を足すと、年の合計と同じになる', async () => {
    const r = await call('GET', '/api/summary?year=2099');
    const sum = (key) => r.body.months.reduce((s, m) => s + m[key], 0);
    assert.deepEqual({ income: sum('income'), expense: sum('expense'), balance: sum('balance') }, r.body.totals);
  });

  test('記録一覧（API1）の月の合計と、同じ月の値が一致する', async () => {
    const year = await call('GET', '/api/summary?year=2099');
    const month = await call('GET', '/api/records?month=2099-03');
    const { income, expense, balance } = year.body.months.find((m) => m.month === '2099-03');
    assert.deepEqual({ income, expense, balance }, month.body.totals);
  });

  test('年がない・形が違う・範囲外のときは 400（S04）', async () => {
    for (const q of ['', '?year=', '?year=1999', '?year=2100', '?year=26', '?year=２０２６', '?year=2026.0', "?year=2026' OR '1'='1", '?year=2026&year=2027']) {
      const r = await call('GET', `/api/summary${q}`);
      assert.equal(r.status, 400, `${q} のとき`);
      assert.deepEqual(r.body, { errors: { year: 'S04' } }, `${q} のとき`);
    }
  });
});
