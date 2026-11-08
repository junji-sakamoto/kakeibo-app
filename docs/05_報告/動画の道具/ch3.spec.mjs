// 第3章 年間の集計
import { test, expect } from './pw.mjs';
import { BASE, setup, say, clearCaption, title, press, point } from './lib.mjs';

test('第3章 年間の集計', async ({ page }) => {
  await setup(page);
  await page.goto(BASE);
  await page.locator('.summary.carry').waitFor();
  await title(page, '第3章', '年間の集計');

  await press(page.locator('.header-nav').getByRole('link', { name: '年間の集計', exact: true }));
  const cards = page.locator('.summary-card .value');
  await expect(cards).toHaveText(['503,000円', '200,000円', '303,000円']); // お試しデータの最初の状態
  await say(page, '年間の集計では、1年の合計と、1月から12月までの月ごとの合計を見られます。');
  await point(page.locator('.summary-card'), 1200);
  await say(page, '今年の収入は 503,000円、支出は 200,000円、差額は 303,000円 です。');

  const now = new Date();
  const thisRow = page.locator('.year-row:not(.list-head)').nth(now.getMonth());
  await point(thisRow, 1200);
  await say(page, '月ごとの数字は、月ごとの記録の画面と同じです。\n記録のない月は、0円 と表示します。');
  await say(page, '月の名前を押すと、その月の記録の一覧に移ります。', 1800);
  await press(thisRow.locator('.month a'));
  await page.locator('.summary.carry').waitFor();
  await say(page, '今月の記録の一覧に移りました。');
  await page.goBack();
  await page.locator('.year-row').first().waitFor();

  await say(page, '前の年ボタンと今年ボタンで、年を切り替えられます。', 1800);
  await press(page.getByRole('button', { name: '◀ 前の年' }));
  await expect(cards).toHaveText(['0円', '0円', '0円']);
  await say(page, '去年は記録がないので、すべて 0円 です。');
  await press(page.getByRole('button', { name: '今年' }));
  await expect(cards.first()).toHaveText('503,000円');
  await page.waitForTimeout(1000);
  await clearCaption(page);
});
