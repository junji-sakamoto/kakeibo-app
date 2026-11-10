// 第3章 カテゴリの設定
import { test, expect } from './pw.mjs';
import { BASE, setup, say, title, next, press, point, type, cleanUp } from './lib.mjs';

test.afterEach(async ({ request }) => cleanUp(request)); // 途中で止まっても、撮影で作ったカテゴリを残さない

test('第3章 カテゴリの設定', async ({ page }) => {
  await setup(page);
  await page.goto(BASE);
  await page.locator('.summary.carry').waitFor();
  await title(page, '第3章', 'カテゴリの設定');

  await press(page.locator('.header-nav').getByRole('link', { name: 'カテゴリの設定', exact: true }));
  const expense = page.locator('.category-section').first();
  await expect(expense.locator('.category-row').last()).toContainText('その他');
  await say(page, 'カテゴリは、記録を分類するためのものです。');
  await point(page.locator('.category-section h2'), 1200);
  await say(page, '支出用と収入用に分けて表示し、その他はいつも一番下に並べます。');

  // 登録
  await say(page, '新しいカテゴリを登録します。支出用に、ペットを登録します。', 2500);
  await press(page.getByRole('link', { name: '＋ 登録' }));
  await type(page.getByLabel('名前'), 'ペット');
  await press(page.getByRole('button', { name: '保存する' }));
  await expect(page.locator('.toast')).toHaveText('カテゴリを登録しました。');
  const pet = expense.locator('.category-row', { hasText: 'ペット' });
  await pet.scrollIntoViewIfNeeded();
  await point(expense.locator('.category-row').filter({ hasText: /^(ペット|その他)/ }), 1500);
  await say(page, '登録したカテゴリは、その他のすぐ上に並びます。');

  // 同じ名前
  await say(page, '同じ種類に、同じ名前のカテゴリは登録できません。', 1800);
  await press(page.getByRole('link', { name: '＋ 登録' }));
  await type(page.getByLabel('名前'), '食費');
  await press(page.getByRole('button', { name: '保存する' }));
  await expect(page.locator('#err-name')).toHaveText('同じ名前のカテゴリがすでにあります。');
  await point(page.locator('#err-name'), 1200);
  await say(page, '戻るを押すと、保存せずに一覧に戻ります。', 1800);
  await press(page.getByRole('link', { name: '戻る' }));

  // 使われているカテゴリの修正
  const food = expense.locator('.category-row').filter({ has: page.getByText('食費', { exact: true }) });
  await press(food.getByRole('link', { name: '修正' }));
  await expect(page.locator('.info')).toContainText('件の記録で使われています');
  await point(page.locator('.info'), 1200);
  await say(page, 'すでに記録で使われているカテゴリを直すときは、何件の記録で使われているかと、\n名前を変えると、すべての記録に反映されることを知らせます。', 7000);
  await point(page.locator('.hint').first(), 1000);
  await say(page, '種類は、登録したあとは変えられません。');
  await press(page.getByRole('link', { name: '戻る' }));

  // 使われているカテゴリは削除できない
  await say(page, '記録で使われているカテゴリは、削除できません。', 1800);
  await press(food.getByRole('button', { name: '削除' }));
  await press(page.locator('dialog').getByRole('button', { name: '削除する' }));
  await expect(page.locator('.toast')).toHaveText('このカテゴリは記録で使われているため削除できません。');
  await say(page, '記録が分類できなくなるのを防ぐためです。');

  // 使われていないカテゴリは削除できる
  await say(page, '記録で使われていないカテゴリは、削除できます。', 1800);
  await press(pet.getByRole('button', { name: '削除' }));
  await press(page.locator('dialog').getByRole('button', { name: '削除する' }));
  await expect(page.locator('.toast')).toHaveText('カテゴリを削除しました。');
  await expect(pet).toHaveCount(0);
  await say(page, 'ペットが一覧から消えました。');
  await next(page, 4);
});
