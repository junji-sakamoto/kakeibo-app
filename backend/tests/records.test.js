// ============================================================
// 記録の API（API1〜API5）の試験（テスト）
// docs/02_設計/06_API設計書.md のとおりに動くかを、実際にお願いを送って確かめる
//
// 実行のしかた：backend フォルダで「npm test」（先にデータベースを起動しておく）
//
// ・お試しデータに影響しないように、2099年11月・12月の日付だけを使う
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

// 処理側にお願いを送り、結果の番号（status）と本文（body）を返す
async function call(method, path, body, { raw = false } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// 正しい記録の見本（一部だけ変えて使う）
const sample = (over = {}) => ({ date: '2099-12-15', categoryId: ids.food, amount: 1200, memo: 'ランチ', ...over });

before(async () => {
  // 前に試験が途中で止まったときの残りを消しておく
  await pool.query("DELETE FROM records WHERE recorded_on >= '2099-11-01'");

  const id = async (type, name) => (await pool.query('SELECT id FROM categories WHERE type = ? AND name = ?', [type, name]))[0][0].id;
  ids = { salary: await id('income', '給料'), food: await id('expense', '食費'), eatOut: await id('expense', '外食') };

  // 処理側を、空いている番号の入口で起動する
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await pool.query("DELETE FROM records WHERE recorded_on >= '2099-11-01'");
  server.close();
  await pool.end();
});

// ------------------------------------------------------------
describe('API1 記録の一覧と合計', () => {
  test('その月の記録だけを、日付の新しい順（同じ日は番号の大きい順）に並べ、合計を計算する', async () => {
    const a = await call('POST', '/api/records', sample({ date: '2099-12-10', categoryId: ids.salary, amount: 300000, memo: '給料' }));
    const b = await call('POST', '/api/records', sample({ date: '2099-12-10', categoryId: ids.food, amount: 1000 }));
    const c = await call('POST', '/api/records', sample({ date: '2099-12-31', categoryId: ids.eatOut, amount: 2000 }));
    await call('POST', '/api/records', sample({ date: '2099-11-30', amount: 999 })); // 前の月（入らないはず）

    const r = await call('GET', '/api/records?month=2099-12');
    assert.equal(r.status, 200);
    assert.equal(r.body.month, '2099-12');
    assert.deepEqual(r.body.totals, { income: 300000, expense: 3000, balance: 297000 });
    assert.deepEqual(r.body.records.map((x) => x.id), [c.body.id, b.body.id, a.body.id]);
    assert.deepEqual(r.body.records[0], {
      id: c.body.id, date: '2099-12-31', type: 'expense', categoryId: ids.eatOut, categoryName: '外食', amount: 2000, memo: 'ランチ',
    });
  });

  test('記録のない月は、空の一覧と 0 円の合計を返す', async () => {
    const r = await call('GET', '/api/records?month=2099-10');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { month: '2099-10', totals: { income: 0, expense: 0, balance: 0 }, records: [] });
  });

  test('年月がない・形が違う・範囲外のときは 400（S04）', async () => {
    for (const q of ['', '?month=', '?month=2099-13', '?month=1999-12', '?month=2100-01', '?month=2026-1', '?month=2026-11&month=2026-12']) {
      const r = await call('GET', `/api/records${q}`);
      assert.equal(r.status, 400, q);
      assert.deepEqual(r.body, { errors: { month: 'S04' } }, q);
    }
  });
});

// ------------------------------------------------------------
describe('API3 記録の登録', () => {
  test('正しい記録は 201 で登録され、メモの前後の空白は取り除かれる', async () => {
    const r = await call('POST', '/api/records', sample({ memo: '  ランチ  ' }));
    assert.equal(r.status, 201);
    assert.ok(Number.isInteger(r.body.id));
    assert.deepEqual({ ...r.body, id: 0 }, {
      id: 0, date: '2099-12-15', type: 'expense', categoryId: ids.food, categoryName: '食費', amount: 1200, memo: 'ランチ',
    });
  });

  test('メモを省くと、空の文字になる', async () => {
    const { memo, ...withoutMemo } = sample();
    const r = await call('POST', '/api/records', withoutMemo);
    assert.equal(r.status, 201);
    assert.equal(r.body.memo, '');
  });

  test('何も入れないと、日付 E01・カテゴリ E04・金額 E05', async () => {
    for (const body of [{}, { date: '', categoryId: null, amount: '' }, []]) {
      const r = await call('POST', '/api/records', body);
      assert.equal(r.status, 400);
      assert.deepEqual(r.body, { errors: { date: 'E01', categoryId: 'E04', amount: 'E05' } });
    }
  });

  test('ない日付・範囲外・形の違う日付は E02', async () => {
    for (const date of ['2099-02-30', '1999-12-31', '2100-01-01', '2099/12/01', '2099-12-1', 20991201]) {
      const r = await call('POST', '/api/records', sample({ date }));
      assert.equal(r.status, 400, String(date));
      assert.deepEqual(r.body, { errors: { date: 'E02' } }, String(date));
    }
  });

  test('金額：整数でない・1未満・文字は E06、9,999,999 より大きいと E07、1 と 9,999,999 は登録できる', async () => {
    for (const amount of [0, -1, 1.5, '1200', '1,200']) {
      const r = await call('POST', '/api/records', sample({ amount }));
      assert.deepEqual([r.status, r.body], [400, { errors: { amount: 'E06' } }], String(amount));
    }
    const over = await call('POST', '/api/records', sample({ amount: 10000000 }));
    assert.deepEqual([over.status, over.body], [400, { errors: { amount: 'E07' } }]);
    for (const amount of [1, 9999999]) {
      assert.equal((await call('POST', '/api/records', sample({ amount }))).status, 201, String(amount));
    }
  });

  test('メモ：101文字は E08、100文字（絵文字でも）は登録できる', async () => {
    const over = await call('POST', '/api/records', sample({ memo: 'あ'.repeat(101) }));
    assert.deepEqual([over.status, over.body], [400, { errors: { memo: 'E08' } }]);
    for (const memo of ['あ'.repeat(100), '😀'.repeat(100)]) {
      const r = await call('POST', '/api/records', sample({ memo }));
      assert.equal(r.status, 201);
      assert.equal(r.body.memo, memo);
    }
  });

  test('ないカテゴリの番号・番号が整数でないときは E13', async () => {
    for (const categoryId of [99999999, 0, '6', 1.5]) {
      const r = await call('POST', '/api/records', sample({ categoryId }));
      assert.deepEqual([r.status, r.body], [400, { errors: { categoryId: 'E13' } }], String(categoryId));
    }
  });

  test('間違いのある項目は、まとめて返す', async () => {
    const r = await call('POST', '/api/records', sample({ date: '2099-02-30', amount: 0, memo: 'あ'.repeat(101) }));
    assert.deepEqual([r.status, r.body], [400, { errors: { date: 'E02', amount: 'E06', memo: 'E08' } }]);
  });

  test('本文が JSON として読めないときは 400（S04）', async () => {
    const r = await call('POST', '/api/records', '{ これは JSON ではない', { raw: true });
    assert.deepEqual([r.status, r.body], [400, { message: 'S04' }]);
  });
});

// ------------------------------------------------------------
describe('API2 記録を1件取り出す', () => {
  test('ある記録は 200、ない番号・整数でない番号は 404（S02）', async () => {
    const created = await call('POST', '/api/records', sample());
    const r = await call('GET', `/api/records/${created.body.id}`);
    assert.deepEqual([r.status, r.body], [200, created.body]);
    for (const id of ['999999999', 'abc', '0', '-1', '1.5', '99999999999']) {
      const n = await call('GET', `/api/records/${id}`);
      assert.deepEqual([n.status, n.body], [404, { message: 'S02' }], id);
    }
  });
});

// ------------------------------------------------------------
describe('API4 記録の修正', () => {
  test('正しい内容で 200 になり、書き換わる。同じ内容でもう一度送っても 200', async () => {
    const created = await call('POST', '/api/records', sample());
    const changes = { date: '2099-12-20', categoryId: ids.salary, amount: 5000, memo: '臨時' };
    const r = await call('PUT', `/api/records/${created.body.id}`, changes);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { id: created.body.id, ...changes, type: 'income', categoryName: '給料' });
    const again = await call('PUT', `/api/records/${created.body.id}`, changes);
    assert.equal(again.status, 200);
  });

  test('入力の間違いは 400、ないカテゴリは E13、ない記録は 404（S02）', async () => {
    const created = await call('POST', '/api/records', sample());
    const bad = await call('PUT', `/api/records/${created.body.id}`, sample({ amount: 0 }));
    assert.deepEqual([bad.status, bad.body], [400, { errors: { amount: 'E06' } }]);
    const noCategory = await call('PUT', `/api/records/${created.body.id}`, sample({ categoryId: 99999999 }));
    assert.deepEqual([noCategory.status, noCategory.body], [400, { errors: { categoryId: 'E13' } }]);
    for (const id of ['999999999', 'abc']) {
      const r = await call('PUT', `/api/records/${id}`, sample());
      assert.deepEqual([r.status, r.body], [404, { message: 'S02' }], id);
    }
  });
});

// ------------------------------------------------------------
describe('API5 記録の削除', () => {
  test('削除すると 204、もう一度削除すると 404（S02）、削除した記録は取り出せない', async () => {
    const created = await call('POST', '/api/records', sample());
    const r = await call('DELETE', `/api/records/${created.body.id}`);
    assert.deepEqual([r.status, r.body], [204, null]);
    assert.equal((await call('GET', `/api/records/${created.body.id}`)).status, 404);
    const again = await call('DELETE', `/api/records/${created.body.id}`);
    assert.deepEqual([again.status, again.body], [404, { message: 'S02' }]);
    assert.equal((await call('DELETE', '/api/records/abc')).status, 404);
  });
});

// ------------------------------------------------------------
describe('共通', () => {
  test('決まっていないパスは 404（S03）', async () => {
    const r = await call('GET', '/api/records/1/extra');
    assert.deepEqual([r.status, r.body], [404, { message: 'S03' }]);
  });
});
