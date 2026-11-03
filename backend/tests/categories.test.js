// ============================================================
// カテゴリの API（API6〜API10）の試験（テスト）
// docs/02_設計/06_API設計書.md のとおりに動くかを、実際にお願いを送って確かめる
//
// 実行のしかた：backend フォルダで「npm test」（先にデータベースを起動しておく）
//
// ・お試しデータに影響しないように、名前が「試験用」で始まるカテゴリだけを作る
// ・記録が必要なときは、2099年12月の日付だけを使う
// ・試験で作ったカテゴリと記録は、最後に全部削除する
// ============================================================

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';

let server;
let base;

async function call(method, path, body, { raw = false } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// 試験で作ったものを全部消す（記録を先に消す。カテゴリを先に消すと、外部キーの決まりで止められるため）
async function cleanUp() {
  await pool.query("DELETE FROM records WHERE recorded_on >= '2099-11-01'");
  await pool.query("DELETE FROM categories WHERE name LIKE '試験用%'");
}

// カテゴリを登録して、できたカテゴリを返す
const create = async (type, name) => (await call('POST', '/api/categories', { type, name })).body;

before(async () => {
  await cleanUp(); // 前に試験が途中で止まったときの残りを消しておく
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await cleanUp();
  server.close();
  await pool.end();
});

// ------------------------------------------------------------
describe('API6 カテゴリの一覧', () => {
  test('収入用 → 支出用の順。それぞれ登録した順で、「その他」は一番下', async () => {
    const pet = await create('expense', '試験用ペット');
    const r = await call('GET', '/api/categories');
    assert.equal(r.status, 200);
    const list = r.body.categories;

    // 収入用が先、支出用があと
    const types = list.map((c) => c.type);
    assert.equal(types.lastIndexOf('income') < types.indexOf('expense'), true);

    for (const type of ['income', 'expense']) {
      const names = list.filter((c) => c.type === type);
      assert.equal(names.at(-1).name, 'その他', `${type} の一番下は「その他」`);
      const others = names.slice(0, -1).map((c) => c.id);
      assert.deepEqual(others, [...others].sort((a, b) => a - b), `${type} は登録した順`);
    }
    // 新しく登録したカテゴリは、「その他」のすぐ上
    const expense = list.filter((c) => c.type === 'expense');
    assert.deepEqual(expense.slice(-2).map((c) => c.name), [pet.name, 'その他']);
  });
});

// ------------------------------------------------------------
describe('API8 カテゴリの登録', () => {
  test('正しいカテゴリは 201 で登録され、名前の前後の空白（全角も）は取り除かれる', async () => {
    const res = await fetch(`${base}/api/categories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'income', name: '　 試験用お祝い 　' }) });
    const body = await res.json();
    assert.equal(res.status, 201);
    assert.deepEqual({ ...body, id: 0 }, { id: 0, type: 'income', name: '試験用お祝い' });
    assert.equal(res.headers.get('location'), `/api/categories/${body.id}`); // できたカテゴリの場所（Location）
  });

  test('名前が空・空白だけ・文字でないときは E09、21文字は E10、20文字は登録できる', async () => {
    for (const name of [undefined, null, '', '   ', '　　', 123]) {
      const r = await call('POST', '/api/categories', { type: 'expense', name });
      assert.deepEqual([r.status, r.body], [400, { errors: { name: 'E09' } }], String(name));
    }
    const over = await call('POST', '/api/categories', { type: 'expense', name: `試験用${'あ'.repeat(18)}` });
    assert.deepEqual([over.status, over.body], [400, { errors: { name: 'E10' } }]);
    const just = await call('POST', '/api/categories', { type: 'expense', name: `試験用${'あ'.repeat(17)}` });
    assert.equal(just.status, 201);
  });

  test('種類が income・expense 以外のときは E03（名前の間違いとまとめて返す）', async () => {
    for (const type of [undefined, '', 'other', 'INCOME']) {
      const r = await call('POST', '/api/categories', { type, name: '試験用x' });
      assert.deepEqual([r.status, r.body], [400, { errors: { type: 'E03' } }], String(type));
    }
    const both = await call('POST', '/api/categories', {});
    assert.deepEqual([both.status, both.body], [400, { errors: { type: 'E03', name: 'E09' } }]);
  });

  test('同じ種類に同じ名前があると 409（E11）。種類が違えば登録できる', async () => {
    await create('expense', '試験用おなじ');
    const dup = await call('POST', '/api/categories', { type: 'expense', name: '試験用おなじ' });
    assert.deepEqual([dup.status, dup.body], [409, { errors: { name: 'E11' } }]);
    const otherType = await call('POST', '/api/categories', { type: 'income', name: '試験用おなじ' });
    assert.equal(otherType.status, 201);
  });

  test('完全に同じ文字のときだけ同じ名前（カフェ・かふぇ・ｶﾌｪ・Food・food は全部登録できる）', async () => {
    for (const name of ['試験用カフェ', '試験用かふぇ', '試験用ｶﾌｪ', '試験用Food', '試験用food']) {
      const r = await call('POST', '/api/categories', { type: 'expense', name });
      assert.equal(r.status, 201, name);
    }
  });

  test('本文が JSON として読めないときは 400（S04）', async () => {
    const r = await call('POST', '/api/categories', '{ これは JSON ではない', { raw: true });
    assert.deepEqual([r.status, r.body], [400, { message: 'S04' }]);
  });
});

// ------------------------------------------------------------
describe('API7 カテゴリを1件と、使われている記録の件数', () => {
  test('使われている記録の件数（すべての月）を返す。ない番号は 404（S02）', async () => {
    const cat = await create('expense', '試験用件数');
    const zero = await call('GET', `/api/categories/${cat.id}`);
    assert.deepEqual([zero.status, zero.body], [200, { ...cat, recordCount: 0 }]);

    for (const date of ['2099-11-30', '2099-12-01']) {
      await call('POST', '/api/records', { date, categoryId: cat.id, amount: 100 });
    }
    const two = await call('GET', `/api/categories/${cat.id}`);
    assert.equal(two.body.recordCount, 2);

    for (const id of ['999999999', 'abc', '0']) {
      const n = await call('GET', `/api/categories/${id}`);
      assert.deepEqual([n.status, n.body], [404, { message: 'S02' }], id);
    }
  });
});

// ------------------------------------------------------------
describe('API9 カテゴリの名前の修正', () => {
  test('名前が書き換わる。種類は送っても変わらない。同じ名前のままでも 200', async () => {
    const cat = await create('expense', '試験用まえ');
    const r = await call('PUT', `/api/categories/${cat.id}`, { name: '試験用あと', type: 'income' });
    assert.deepEqual([r.status, r.body], [200, { id: cat.id, type: 'expense', name: '試験用あと' }]);
    const same = await call('PUT', `/api/categories/${cat.id}`, { name: '試験用あと' });
    assert.equal(same.status, 200);
  });

  test('ほかのカテゴリと同じ名前は 409（E11）、名前の間違いは 400、ない番号は 404（S02）', async () => {
    await create('expense', '試験用すでにある');
    const cat = await create('expense', '試験用なおす');
    const dup = await call('PUT', `/api/categories/${cat.id}`, { name: '試験用すでにある' });
    assert.deepEqual([dup.status, dup.body], [409, { errors: { name: 'E11' } }]);
    const empty = await call('PUT', `/api/categories/${cat.id}`, { name: '  ' });
    assert.deepEqual([empty.status, empty.body], [400, { errors: { name: 'E09' } }]);
    const long = await call('PUT', `/api/categories/${cat.id}`, { name: 'あ'.repeat(21) });
    assert.deepEqual([long.status, long.body], [400, { errors: { name: 'E10' } }]);
    for (const id of ['999999999', 'abc']) {
      const n = await call('PUT', `/api/categories/${id}`, { name: '試験用x' });
      assert.deepEqual([n.status, n.body], [404, { message: 'S02' }], id);
    }
  });
});

// ------------------------------------------------------------
describe('API10 カテゴリの削除', () => {
  test('使われていないカテゴリは 204 で削除され、もう取り出せない', async () => {
    const cat = await create('income', '試験用けす');
    const r = await call('DELETE', `/api/categories/${cat.id}`);
    assert.deepEqual([r.status, r.body], [204, null]);
    assert.equal((await call('GET', `/api/categories/${cat.id}`)).status, 404);
    const again = await call('DELETE', `/api/categories/${cat.id}`);
    assert.deepEqual([again.status, again.body], [404, { message: 'S02' }]);
  });

  test('記録で使われているカテゴリは 409（E12）で削除されない', async () => {
    const cat = await create('expense', '試験用つかう');
    await call('POST', '/api/records', { date: '2099-12-10', categoryId: cat.id, amount: 500 });
    const r = await call('DELETE', `/api/categories/${cat.id}`);
    assert.deepEqual([r.status, r.body], [409, { message: 'E12' }]);
    assert.equal((await call('GET', `/api/categories/${cat.id}`)).status, 200);
  });

  test('ない番号・整数でない番号は 404（S02）', async () => {
    for (const id of ['999999999', 'abc']) {
      const r = await call('DELETE', `/api/categories/${id}`);
      assert.deepEqual([r.status, r.body], [404, { message: 'S02' }], id);
    }
  });
});
