// 第1章 はじめに（GitHub の README と、本番環境の構成）
import { test } from './pw.mjs';
import { BASE, GITHUB, setup, say, title, next, scrollTo, scrollDown } from './lib.mjs';

test('第1章 はじめに', async ({ page }) => {
  await setup(page);
  await page.goto(`${GITHUB}README.md`);
  await page.locator('article.markdown-body').first().waitFor();
  await title(page, '第1章', 'はじめに');

  await say(page, 'スクールの課題で作った、家計簿アプリを紹介します。');
  await say(page, '収入と支出を記録して、月ごとの合計と、1年の合計を確認できるアプリです。');
  await scrollDown(page, 500);
  await say(page, 'GitHub の README には、資料の一覧と、フォルダの中身をまとめています。');

  const heading = page.locator('article.markdown-body h2', { hasText: '本番環境（AWS）の構成' });
  await scrollTo(heading, 2500); // 構成図（Mermaid）が描かれるのを待つ
  await say(page, '画面は Vue.js、処理は Node.js と Express、データベースは MySQL で作りました。\nこれまでの学習で使ってきた技術とは、別の技術を選びました。', 6500);
  await say(page, '本番環境は AWS です。\n使う人は CloudFront を通して https で開き、\nEC2 で画面と処理を動かし、データは RDS に保存しています。', 7000);
  await scrollDown(page, 350);
  await say(page, 'それでは、実際の画面で、機能を順番に紹介します。');

  await page.goto(BASE);
  await page.locator('.summary.carry').waitFor();
  await page.waitForTimeout(1500);
  await next(page, 2);
});
