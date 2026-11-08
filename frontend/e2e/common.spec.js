// ============================================================
// E2E 試験：すべての画面に共通すること
// 存在しないページ、読み込めなかったとき、カテゴリがないとき、スマートフォンの横幅
// 決まりは docs/01_要件定義/05-0_画面一覧と共通ルール.md の「共通の表示ルール」
// ============================================================

import { test, expect } from '@playwright/test';
import { createRecord, categoryId, cleanUp, ui } from './helpers.js';

test.beforeAll(async ({ request }) => cleanUp(request));
test.afterAll(async ({ request }) => cleanUp(request));

const S01 = 'サーバーとの通信に失敗しました。時間をおいて、もう一度お試しください。';

test('遷移19：存在しないページは「ページが見つかりません。」（S03）と、記録一覧画面へのリンクを表示する', async ({ page }) => {
  await page.goto('/nothing');
  await expect(page.locator('.empty')).toContainText('ページが見つかりません。');
  await page.getByRole('link', { name: '記録一覧画面へ' }).click();
  await expect(page).toHaveURL(/\/records$/);
});

test.describe('読み込めなかったとき（処理側につながらない）', () => {
  // 処理側へのお願いを、わざと全部失敗させる
  test.beforeEach(async ({ page }) => page.route('**/api/**', (route) => route.abort()));

  test('記録一覧画面：S01 と「読み込み直す」を表示し、「この月の記録はありません」「0円」とは表示しない', async ({ page }) => {
    await page.goto('/records');
    await expect(ui.toast(page)).toHaveText(S01);
    await expect(page.locator('.list .load-error')).toHaveText(S01);
    await expect(page.getByRole('button', { name: '読み込み直す' })).toBeVisible();
    // 収入・支出・差額と、前月からの繰越・繰越後の残高の5つとも「－」（0円とは表示しない）
    await expect(page.locator('.summary-card .value')).toHaveText(['－', '－', '－', '－', '－']);
    await expect(page.getByText('この月の記録はありません。')).toHaveCount(0);
  });

  test('カテゴリ一覧画面：S01 と「読み込み直す」を表示し、「カテゴリがありません。」とは表示しない', async ({ page }) => {
    await page.goto('/categories');
    await expect(page.locator('.list .load-error')).toHaveText(S01);
    await expect(page.getByRole('button', { name: '読み込み直す' })).toBeVisible();
    await expect(page.getByText('カテゴリがありません。')).toHaveCount(0);
  });

  test('記録入力画面：S01 と「戻る」を表示し、入力欄は出さない', async ({ page }) => {
    await page.goto('/records/new');
    await expect(page.locator('.list .load-error')).toHaveText(S01);
    await expect(page.getByRole('link', { name: '戻る' })).toBeVisible();
    await expect(page.locator('form.form')).toHaveCount(0);
  });

  test('つながるようになってから「読み込み直す」を押すと、表示される', async ({ page }) => {
    await page.goto('/records?month=2099-10');
    await expect(page.locator('.list .load-error')).toHaveText(S01);
    await page.unroute('**/api/**');
    await page.getByRole('button', { name: '読み込み直す' }).click();
    await expect(page.locator('.list .empty')).toHaveText('この月の記録はありません。');
  });
});

test('選んだ種類のカテゴリが1つもないときは「カテゴリがありません。カテゴリ画面で登録してください。」（N02）と出し、保存できない', async ({ page }) => {
  // 収入用のカテゴリが1つもない状態を、処理側の返事を差し替えて作る
  await page.route('**/api/categories', (route) => route.fulfill({ json: { categories: [{ id: 6, type: 'expense', name: '食費' }] } }));
  await page.goto('/records/new');
  await page.getByLabel('収入', { exact: true }).check();
  await expect(page.locator('.notice')).toHaveText('カテゴリがありません。カテゴリ画面で登録してください。');
  await expect(page.getByLabel('カテゴリ')).toBeDisabled();
  await expect(page.getByRole('button', { name: '保存する' })).toBeDisabled();
});

test.describe('ふだんは起こしにくい場面のメッセージ（処理側の返事を差し替えて確かめる）', () => {
  test('N03：ある種類のカテゴリが0件のとき、その種類の所に「カテゴリがありません。」', async ({ page }) => {
    await page.route('**/api/categories', (route) => route.fulfill({ json: { categories: [{ id: 6, type: 'expense', name: '食費' }] } }));
    await page.goto('/categories');
    const income = page.locator('.category-section', { has: page.locator('h2', { hasText: '収入用' }) });
    await expect(income.locator('.empty')).toHaveText('カテゴリがありません。');
  });

  test('N04：読み込んでいる間は「読み込み中…」と表示する', async ({ page }) => {
    await page.route('**/api/records?**', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto('/records?month=2099-10');
    await expect(page.locator('.list .empty')).toHaveText('読み込み中…');
    await expect(page.locator('.list .empty')).toHaveText('この月の記録はありません。');
  });

  test('E13：保存したときに、選んだカテゴリが削除されていたら、カテゴリの欄の下に E13 を表示する', async ({ page }) => {
    await page.route('**/api/records', (route) => (route.request().method() === 'POST'
      ? route.fulfill({ status: 400, json: { errors: { categoryId: 'E13' } } })
      : route.continue()));
    await page.goto('/records/new?month=2099-12');
    await page.getByLabel('カテゴリ').selectOption({ label: '食費' });
    await page.getByLabel('金額').fill('100');
    await page.getByRole('button', { name: '保存する' }).click();
    await expect(page.locator('#err-category')).toHaveText('選んだカテゴリは使えません。もう一度選んでください。');
    await expect(page).toHaveURL(/\/records\/new/);
  });

  test('S04：処理側で思わぬ問題が起きたら「予期しないエラーが発生しました。…」を表示する', async ({ page }) => {
    await page.route('**/api/records?**', (route) => route.fulfill({ status: 500, json: { message: 'S04' } }));
    await page.goto('/records');
    await expect(page.locator('.toast')).toHaveText('予期しないエラーが発生しました。時間をおいて、もう一度お試しください。');
    await expect(page.locator('.list .load-error')).toHaveText('予期しないエラーが発生しました。時間をおいて、もう一度お試しください。');
  });
});

test('XSS 対策：メモやカテゴリ名に HTML やプログラムを入れても、文字として表示され、動かない', async ({ page, request }) => {
  const attack = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';
  let dialogOpened = false;
  page.on('dialog', async (d) => { dialogOpened = true; await d.dismiss(); });

  // 記録のメモ（100文字まで）
  const food = await categoryId(request, 'expense', '食費');
  await createRecord(request, { date: '2099-12-02', categoryId: food, amount: 100, memo: attack });
  await page.goto('/records?month=2099-12');
  await expect(page.locator('.list-row:not(.list-head) .memo').first()).toHaveText(attack);
  // カテゴリの名前（20文字まで）
  await page.goto('/categories/new');
  await page.getByLabel('名前').fill('試験用<b>太字</b>');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('試験用<b>太字</b>', { exact: true })).toBeVisible();

  expect(await page.evaluate(() => window.__xss)).toBeUndefined(); // プログラムは動いていない
  expect(dialogOpened).toBe(false);
  await expect(page.locator('.memo img, .category-row b')).toHaveCount(0); // HTML の部品として作られていない
});

test('スマートフォンの横幅（375）でも、どの画面も横にはみ出さない', async ({ page, request }) => {
  const food = await categoryId(request, 'expense', '食費');
  await createRecord(request, { date: '2099-12-01', categoryId: food, amount: 1234567, memo: 'とても長いメモとても長いメモとても長いメモとても長いメモとても長いメモ' });
  await page.setViewportSize({ width: 375, height: 800 });
  for (const path of ['/records?month=2099-12', '/records/new', '/categories', '/categories/new', '/yearly?year=2099']) {
    await page.goto(path);
    await expect(page.locator('.page-title, .month-label').first()).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, path).toBeLessThanOrEqual(375);
  }
});
