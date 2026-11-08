// ============================================================
// E2E 試験：年間集計画面（画面5・機能10）
// 決まりは docs/01_要件定義/05-5_年間集計画面.md、遷移は docs/02_設計/02_画面遷移図.md の 遷移21・22
// お試しデータに影響しないように、2099年11月・12月の記録だけを使う
// ============================================================

import { test, expect } from '@playwright/test';
import { api, createRecord, categoryId, cleanUp, monthLabel, thisMonth } from './helpers.js';

test.beforeAll(async ({ request }) => cleanUp(request));
test.afterEach(async ({ request }) => cleanUp(request));

const S01 = 'サーバーとの通信に失敗しました。時間をおいて、もう一度お試しください。';
const rows = (page) => page.locator('.year-row:not(.list-head)');
const row = (page, n) => rows(page).nth(n - 1); // n 月の行
const cards = (page) => page.locator('.summary-card .value');

test('遷移21：メニュー「年間の集計」を押すと、今年の年間集計画面を開き、「年間の集計」を目立たせる', async ({ page }) => {
  await page.goto('/records');
  await page.locator('.header-nav').getByRole('link', { name: '年間の集計', exact: true }).click();
  await expect(page).toHaveURL(/\/yearly$/);
  await expect(page.locator('.month-label')).toHaveText(`${thisMonth().slice(0, 4)}年`);
  await expect(page.locator('.header-nav a.is-active')).toHaveText('年間の集計');
  await expect(rows(page)).toHaveCount(12);
});

test('年の合計と、1月〜12月の月ごとの合計を表示する（記録のない月は 0円）。値は処理側の集計と一致する', async ({ page, request }) => {
  const salary = await categoryId(request, 'income', '給料');
  const food = await categoryId(request, 'expense', '食費');
  await createRecord(request, { date: '2099-11-25', categoryId: salary, amount: 300000, memo: '試験用' });
  await createRecord(request, { date: '2099-12-01', categoryId: food, amount: 1200, memo: '試験用' });
  await createRecord(request, { date: '2099-12-31', categoryId: food, amount: 400000, memo: '試験用' });

  await page.goto('/yearly?year=2099');
  await expect(page.locator('.month-label')).toHaveText('2099年');
  await expect(cards(page)).toHaveText(['300,000円', '401,200円', '-101,200円']);
  await expect(page.locator('.summary-card .value.is-minus')).toHaveCount(1); // 差額がマイナスなので赤系

  await expect(rows(page)).toHaveCount(12);
  await expect(row(page, 1)).toContainText('1月');
  await expect(row(page, 1).locator('.amount')).toHaveText(['0円', '0円', '0円'].map((v, i) => `${['収入', '支出', '差額'][i]}${v}`));
  await expect(row(page, 11).locator('.amount')).toHaveText(['収入300,000円', '支出0円', '差額300,000円']);
  await expect(row(page, 12).locator('.amount')).toHaveText(['収入0円', '支出401,200円', '差額-401,200円']);
  await expect(row(page, 12).locator('.balance')).toHaveClass(/is-minus/);

  // 見た目だけでなく、処理側の集計（本当の状態）とも一致すること
  const { body } = await api(request, 'GET', '/summary?year=2099');
  expect(body.totals).toEqual({ income: 300000, expense: 401200, balance: -101200 });
  expect(body.months[10]).toEqual({ month: '2099-11', income: 300000, expense: 0, balance: 300000 });
});

test('「前の年」「次の年」「今年」で表示する年が変わる。2099年では「次の年」、2000年では「前の年」を押せない', async ({ page }) => {
  await page.goto('/yearly?year=2098');
  await page.getByRole('button', { name: '次の年 ▶' }).click();
  await expect(page).toHaveURL(/\?year=2099$/);
  await expect(page.locator('.month-label')).toHaveText('2099年');
  await expect(page.getByRole('button', { name: '次の年 ▶' })).toBeDisabled();

  await page.getByRole('button', { name: '◀ 前の年' }).click();
  await expect(page.locator('.month-label')).toHaveText('2098年');

  await page.getByRole('button', { name: '今年' }).click();
  await expect(page.locator('.month-label')).toHaveText(`${thisMonth().slice(0, 4)}年`);

  await page.goto('/yearly?year=2000');
  await expect(page.getByRole('button', { name: '◀ 前の年' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '次の年 ▶' })).toBeEnabled();
});

test('遷移22：月を押すと、その月の記録一覧画面を開く。ブラウザの「戻る」で年間集計画面に戻る', async ({ page, request }) => {
  const food = await categoryId(request, 'expense', '食費');
  await createRecord(request, { date: '2099-12-01', categoryId: food, amount: 1200, memo: '試験用の年間' });

  await page.goto('/yearly?year=2099');
  await row(page, 12).getByRole('link', { name: '12月' }).click();
  await expect(page).toHaveURL(/\/records\?month=2099-12$/);
  await expect(page.locator('.month-label')).toHaveText(monthLabel('2099-12'));
  await expect(page.locator('.list-row:not(.list-head) .memo')).toHaveText(['試験用の年間']);

  await page.goBack();
  await expect(page).toHaveURL(/\/yearly\?year=2099$/);
  await expect(page.locator('.month-label')).toHaveText('2099年');
});

test('アドレスの年が正しくないとき（文字・範囲外）は、今年を表示する', async ({ page }) => {
  for (const q of ['abc', '1999', '2100', '26']) {
    await page.goto(`/yearly?year=${q}`);
    await expect(page.locator('.month-label'), q).toHaveText(`${thisMonth().slice(0, 4)}年`);
  }
});

test('読み込めなかったとき：S01 と「読み込み直す」を表示し、合計は「－」、月の表は出さない', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/yearly?year=2099');
  await expect(page.locator('.toast')).toHaveText(S01);
  await expect(page.locator('.list .load-error')).toHaveText(S01);
  await expect(cards(page)).toHaveText(['－', '－', '－']);
  await expect(rows(page)).toHaveCount(0);

  await page.unroute('**/api/**');
  await page.getByRole('button', { name: '読み込み直す' }).click();
  await expect(rows(page)).toHaveCount(12);
});
