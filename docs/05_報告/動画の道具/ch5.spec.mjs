// 第5章 使いやすさと安全（スマートフォンの幅・https・存在しないページ）
import { test, expect } from './pw.mjs';
import { BASE, setup, say, clearCaption, title, point } from './lib.mjs';

// スマートフォンの大きさ（390×780）の枠の中に、アプリを表示する画面
const PHONE = (src) => `<!doctype html><meta charset="utf-8">
<style>
  html, body { margin: 0; height: 100%; background: #e9ecf1; }
  .wrap { display: flex; justify-content: center; padding-top: 18px; }
  .phone { padding: 14px 10px; border-radius: 36px; background: #1f2328; box-shadow: 0 10px 30px rgba(0,0,0,.25); }
  iframe { display: block; width: 390px; height: 700px; border: 0; border-radius: 22px; background: #fff; }
</style>
<div class="wrap"><div class="phone"><iframe src="${src}"></iframe></div></div>`;

test('第5章 使いやすさと安全', async ({ page }) => {
  await setup(page);
  await page.goto(BASE);
  await page.locator('.summary.carry').waitFor();
  await title(page, '第5章', '使いやすさと安全');

  // スマートフォンの幅
  await page.setContent(PHONE(BASE));
  await page.evaluate(() => { window.__urlOverride = () => document.querySelector('iframe').src; });
  const app = page.frameLocator('iframe');
  await app.locator('.summary.carry').waitFor();
  await say(page, 'スマートフォンの幅でも、崩れずに使えるようにしています。');
  await say(page, 'メニューは2行目に並び、合計や記録は、縦に並べて表示します。');
  await app.locator('.list').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  for (const [path, text] of [['yearly', '年間の集計も、'], ['categories', 'カテゴリの設定も、']]) {
    await page.evaluate((u) => { document.querySelector('iframe').src = u; }, `${BASE}${path}`);
    await page.waitForTimeout(1500);
    await say(page, `${text}同じように使えます。`, 2500);
  }

  // https（本番のアドレスで撮るときだけ）
  await page.goto(BASE);
  await page.locator('.summary.carry').waitFor();
  if (BASE.startsWith('https://')) {
    await say(page, '通信は https で暗号化しています。\n左下のアドレスに、鍵の印が付いています。', 4500);
    await say(page, '試しに、http で開いてみます。', 2000);
    await page.goto(BASE.replace('https://', 'http://'));
    await expect(page).toHaveURL(/^https:\/\//);
    await page.locator('.summary.carry').waitFor();
    await say(page, 'http で開いても、自動で https に移ります。');
  }

  // 存在しないページ
  await say(page, '存在しないページを開いてみます。', 2000);
  await page.goto(`${BASE}abc`);
  await expect(page.getByText('ページが見つかりません。')).toBeVisible();
  await point(page.locator('.empty'), 1000);
  await say(page, 'ページが見つかりませんと表示し、記録一覧画面へ戻れるリンクを出します。');
  await clearCaption(page);
  await page.waitForTimeout(800);
});
