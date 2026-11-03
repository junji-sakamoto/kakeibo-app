// ============================================================
// E2E 試験で使う道具
// ・試験のデータの準備と後片付けは、処理側の API に直接お願いを送って行う（画面を通さないので速い）
// ・お試しデータに影響しないように、2099年11月・12月の日付と、名前が「試験用」で始まるカテゴリだけを使う
// ============================================================

import { expect } from '@playwright/test';

export const API = 'http://127.0.0.1:3000/api';
export const TEST_MONTHS = ['2099-11', '2099-12'];

// 処理側にお願いを送る（request は Playwright が用意する、画面を通さずにお願いを送る道具）
export async function api(request, method, path, data) {
  const res = await request.fetch(`${API}${path}`, { method, data });
  const text = await res.text();
  return { status: res.status(), body: text ? JSON.parse(text) : null };
}

// 種類と名前から、カテゴリの番号を探す
export async function categoryId(request, type, name) {
  const { body } = await api(request, 'GET', '/categories');
  return body.categories.find((c) => c.type === type && c.name === name)?.id;
}

// 記録を1件作る（試験の準備用）
export async function createRecord(request, record) {
  const r = await api(request, 'POST', '/records', record);
  expect(r.status, '試験の準備で記録を作れなかった').toBe(201);
  return r.body;
}

// カテゴリを1件作る（試験の準備用）
export async function createCategory(request, type, name) {
  const r = await api(request, 'POST', '/categories', { type, name });
  expect(r.status, '試験の準備でカテゴリを作れなかった').toBe(201);
  return r.body;
}

// 試験で作ったものを全部消す（記録を先に消す。カテゴリを先に消すと、記録で使われていて消せないため）
export async function cleanUp(request) {
  for (const month of TEST_MONTHS) {
    const { body } = await api(request, 'GET', `/records?month=${month}`);
    for (const r of body.records) await api(request, 'DELETE', `/records/${r.id}`);
  }
  const { body } = await api(request, 'GET', '/categories');
  for (const c of body.categories.filter((x) => x.name.startsWith('試験用'))) {
    await api(request, 'DELETE', `/categories/${c.id}`);
  }
}

// 今月（「2026-11」の形）
export function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 「2026-11」→「2026年11月」
export const monthLabel = (m) => `${Number(m.slice(0, 4))}年${Number(m.slice(5))}月`;

// 画面の部品の見つけ方（何度も使うもの）
export const ui = {
  toast: (page) => page.locator('.toast'),
  rows: (page) => page.locator('.list-row:not(.list-head)'),
  row: (page, memo) => page.locator('.list-row:not(.list-head)', { has: page.locator('.memo', { hasText: memo }) }),
  categoryRow: (page, name) => page.locator('.category-row').filter({ has: page.getByText(name, { exact: true }) }),
  dialog: (page) => page.locator('dialog.dialog'),
  fieldError: (page, id) => page.locator(`#err-${id}`),
};
