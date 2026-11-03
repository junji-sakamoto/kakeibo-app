// ============================================================
// E2E 試験：カテゴリ（画面3 カテゴリ一覧画面・画面4 カテゴリ入力画面）
// 試験の名前の「機能〇」「遷移〇」は、docs/01_要件定義/03_機能一覧.md と docs/02_設計/02_画面遷移図.md の番号
// ============================================================

import { test, expect } from '@playwright/test';
import { api, createCategory, createRecord, cleanUp, ui } from './helpers.js';

test.beforeAll(async ({ request }) => cleanUp(request));
test.afterAll(async ({ request }) => cleanUp(request));
test.beforeEach(async ({ request }) => cleanUp(request));

const section = (page, title) => page.locator('.category-section', { has: page.locator('h2', { hasText: title }) });
const names = (page, title) => section(page, title).locator('.category-row > span:first-child');

// ------------------------------------------------------------
test.describe('画面3 カテゴリ一覧画面', () => {
  test('遷移17・機能7：メニューの「カテゴリ」で開き、支出用・収入用に分けて表示する（「その他」は一番下）', async ({ page }) => {
    await page.goto('/records');
    await page.locator('.header-nav').getByRole('link', { name: 'カテゴリ', exact: true }).click();
    await expect(page).toHaveURL(/\/categories$/);
    await expect(page.locator('.header-nav').getByRole('link', { name: 'カテゴリ', exact: true })).toHaveClass(/is-active/);
    await expect(page.locator('.category-section h2')).toHaveText(['■ 支出用', '■ 収入用']);
    await expect(names(page, '支出用').first()).toHaveText('食費');
    await expect(names(page, '支出用').last()).toHaveText('その他');
    await expect(names(page, '収入用').first()).toHaveText('給料');
    await expect(names(page, '収入用').last()).toHaveText('その他');
  });
});

// ------------------------------------------------------------
test.describe('画面4 カテゴリ入力画面（登録）', () => {
  test('遷移11・機能6：「＋ 登録」で開き、登録すると「カテゴリを登録しました。」（I04）。新しいカテゴリは「その他」のすぐ上', async ({ page }) => {
    await page.goto('/categories');
    await page.getByRole('link', { name: '＋ 登録' }).click();
    await expect(page).toHaveURL(/\/categories\/new$/);
    await expect(page.locator('.page-title')).toHaveText('カテゴリの登録');
    await expect(page.getByLabel('支出用', { exact: true })).toBeChecked();
    await expect(page.getByLabel('支出用', { exact: true })).toBeEnabled();

    await page.getByLabel('名前').fill('　 試験用E2Eペット 　'); // 前後の空白（全角も）は取り除かれる
    await page.getByRole('button', { name: '保存する' }).click();
    await expect(page).toHaveURL(/\/categories$/);
    await expect(ui.toast(page)).toHaveText('カテゴリを登録しました。');
    const expense = await names(page, '支出用').allTextContents();
    expect(expense.slice(-2)).toEqual(['試験用E2Eペット', 'その他']);
  });

  test('遷移12：名前の間違い（空白だけ E09・21文字 E10・同じ名前 E11）は項目の下に出し、「戻る」では保存しない', async ({ page, request }) => {
    await createCategory(request, 'expense', '試験用E2Eおなじ');
    await page.goto('/categories/new');
    for (const [name, message] of [['　　', 'カテゴリ名を入力してください。'], [`試験用${'あ'.repeat(18)}`, 'カテゴリ名は20文字以内で入力してください。'],
      ['試験用E2Eおなじ', '同じ名前のカテゴリがすでにあります。']]) {
      await page.getByLabel('名前').fill(name);
      await page.getByRole('button', { name: '保存する' }).click();
      await expect(ui.fieldError(page, 'name'), name).toHaveText(message);
      await expect(page).toHaveURL(/\/categories\/new$/);
    }
    // 種類が違えば、同じ名前でも登録できる
    await page.getByLabel('収入用', { exact: true }).check();
    await page.getByRole('button', { name: '保存する' }).click();
    await expect(ui.toast(page)).toHaveText('カテゴリを登録しました。');

    await page.goto('/categories/new');
    await page.getByLabel('名前').fill('試験用E2E戻る');
    await page.getByRole('link', { name: '戻る' }).click();
    await expect(page).toHaveURL(/\/categories$/);
    await expect(ui.categoryRow(page, '試験用E2E戻る')).toHaveCount(0);
  });
});

// ------------------------------------------------------------
test.describe('画面4 カテゴリ入力画面（修正）', () => {
  test('機能8：記録で使われているカテゴリの修正画面では、件数を知らせ（N05）、種類は変えられない。更新すると I05', async ({ page, request }) => {
    const cat = await createCategory(request, 'expense', '試験用E2E件数');
    await createRecord(request, { date: '2099-11-30', categoryId: cat.id, amount: 100 });
    await createRecord(request, { date: '2099-12-01', categoryId: cat.id, amount: 200 });

    await page.goto('/categories');
    await ui.categoryRow(page, '試験用E2E件数').getByRole('link', { name: '修正' }).click();
    await expect(page).toHaveURL(new RegExp(`/categories/${cat.id}/edit$`));
    await expect(page.locator('.page-title')).toHaveText('カテゴリの修正');
    await expect(page.getByLabel('名前')).toHaveValue('試験用E2E件数');
    await expect(page.getByLabel('支出用', { exact: true })).toBeDisabled();
    await expect(page.locator('.info')).toContainText('このカテゴリは2件の記録で使われています。');
    await expect(page.locator('.info')).toContainText('名前を変えると、すべての記録に反映されます。');

    await page.getByLabel('名前').fill('試験用E2E件数2');
    await page.getByRole('button', { name: '更新する' }).click();
    await expect(ui.toast(page)).toHaveText('カテゴリを更新しました。');
    await expect(ui.categoryRow(page, '試験用E2E件数2')).toHaveCount(1);
    // 記録の一覧にも、新しい名前で表示される
    await page.goto('/records?month=2099-12');
    await expect(ui.rows(page).locator('.category')).toHaveText(['試験用E2E件数2']);
  });

  test('機能8：記録で使われていないカテゴリの修正画面では、件数のお知らせを出さない', async ({ page, request }) => {
    const cat = await createCategory(request, 'income', '試験用E2E未使用');
    await page.goto(`/categories/${cat.id}/edit`);
    await expect(page.getByLabel('名前')).toHaveValue('試験用E2E未使用');
    await expect(page.locator('.info')).toHaveCount(0);
  });

  test('遷移12：修正しようとしたカテゴリが削除されていたら、一覧に戻り S02 を表示する', async ({ page, request }) => {
    const cat = await createCategory(request, 'expense', '試験用E2E消えた');
    await api(request, 'DELETE', `/categories/${cat.id}`);
    await page.goto(`/categories/${cat.id}/edit`);
    await expect(page).toHaveURL(/\/categories$/);
    await expect(ui.toast(page)).toHaveText('対象のデータが見つかりません。すでに削除された可能性があります。');
  });
});

// ------------------------------------------------------------
test.describe('カテゴリの削除', () => {
  test('遷移13・遷移14・機能9：確認の窓（Q02）。「キャンセル」なら何もせず、「削除する」で削除して I06', async ({ page, request }) => {
    await createCategory(request, 'income', '試験用E2E消す');
    await page.goto('/categories');
    await ui.categoryRow(page, '試験用E2E消す').getByRole('button', { name: '削除', exact: true }).click();
    expect(await ui.dialog(page).locator('.dialog-message').textContent()).toBe('カテゴリ「試験用E2E消す」を削除しますか？\n削除すると元に戻せません。');
    await ui.dialog(page).getByRole('button', { name: 'キャンセル' }).click();
    await expect(ui.categoryRow(page, '試験用E2E消す')).toHaveCount(1);

    await ui.categoryRow(page, '試験用E2E消す').getByRole('button', { name: '削除', exact: true }).click();
    await ui.dialog(page).getByRole('button', { name: '削除する' }).click();
    await expect(ui.toast(page)).toHaveText('カテゴリを削除しました。');
    await expect(ui.categoryRow(page, '試験用E2E消す')).toHaveCount(0);
  });

  test('遷移14・機能9：記録で使われているカテゴリは削除されず「このカテゴリは記録で使われているため削除できません。」（E12）', async ({ page, request }) => {
    const cat = await createCategory(request, 'expense', '試験用E2E使用中');
    await createRecord(request, { date: '2099-12-01', categoryId: cat.id, amount: 100 });
    await page.goto('/categories');
    await ui.categoryRow(page, '試験用E2E使用中').getByRole('button', { name: '削除', exact: true }).click();
    await ui.dialog(page).getByRole('button', { name: '削除する' }).click();
    await expect(ui.toast(page)).toHaveText('このカテゴリは記録で使われているため削除できません。');
    await expect(ui.toast(page)).toHaveClass(/error/);
    await expect(ui.categoryRow(page, '試験用E2E使用中')).toHaveCount(1);
  });
});
