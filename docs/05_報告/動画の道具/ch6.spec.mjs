// 第6章 どう作り、どう確かめたか（資料・Terraform・Issue と PR・品質チェック）
//
// 撮る前に、品質チェックを実行して、結果をこのフォルダに保存しておく（frontend フォルダで実行する場合）：
//   node ../tools/quality_check.mjs > ../docs/05_報告/動画の道具/品質チェックの結果.txt
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from './pw.mjs';
import { GITHUB, GITHUB_TREE, setup, say, title, next, scrollTo, scrollDown, point } from './lib.mjs';

const QC_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '品質チェックの結果.txt');

// 品質チェックの結果の表を、見やすく表示する画面
function qualityPage() {
  const text = readFileSync(QC_FILE, 'utf8');
  const start = text.lastIndexOf('品質チェックの結果');
  if (start < 0 || !/27 項目中、合格 27・不合格 0/.test(text)) throw new Error('品質チェックの結果が「27項目すべて合格」ではありません。撮る前に実行し直してください');
  const when = statSync(QC_FILE).mtime.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const lines = text.slice(start).split(/\r?\n/).filter((l) => l.trim() && !/^=+$/.test(l.trim()))
    .map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;'))
    .map((l) => `<div class="${/【/.test(l) ? 'group' : /✔/.test(l) ? 'ok' : /✖/.test(l) ? 'ng' : ''}${/試験：API|E2E 試験/.test(l) ? ' test' : ''}">${l}</div>`);
  return `<!doctype html><meta charset="utf-8"><title>品質チェックの結果</title>
<style>
  body { margin: 0; background: #1e1e1e; color: #ddd; font: 15px/1.65 "Cascadia Mono", "BIZ UDGothic", "MS Gothic", monospace; }
  .bar { padding: 10px 18px; background: #333; color: #fff; font-family: "Yu Gothic UI", sans-serif; }
  .bar small { opacity: .7; margin-left: 12px; }
  pre { margin: 0; padding: 14px 18px; white-space: pre-wrap; }
  .group { color: #9cdcfe; margin-top: 6px; } .ok { color: #b5e0a8; } .ng { color: #f48771; }
</style>
<div class="bar">PS C:\\…\\syokyu-kadai&gt; node tools/quality_check.mjs <small>（${when} に実行）</small></div>
<pre>${lines.join('')}</pre>`;
}

test('第6章 どう作り、どう確かめたか', async ({ page }) => {
  const quality = qualityPage(); // 先に結果を確かめておく（なければここで止まる）
  await setup(page);

  // 要件定義書
  await page.goto(`${GITHUB}要件定義書.md`);
  await page.locator('article.markdown-body').first().waitFor();
  await title(page, '第6章', 'どう作り、どう確かめたか');
  await say(page, '作る前に、何を作るかを要件定義書にまとめました。');
  await scrollDown(page, 700);
  await say(page, '機能、画面、メッセージ、性能や安全の決まりなどを書いています。');

  // 設計書
  await say(page, '次に、画面のつながり、データの形、画面と処理のやりとりを、\n設計書にまとめてから作りました。', 4500);
  for (const [file, label] of [['02_画面遷移図.md', '画面遷移図：どの画面から、どの画面に移るか'], ['03_ER図.md', 'ER図：保存するデータの形とつながり'], ['06_API設計書.md', 'API 設計書：画面と処理のやりとりの決まり']]) {
    await page.goto(`${GITHUB}docs/02_設計/${file}`);
    await page.locator('article.markdown-body').first().waitFor();
    await scrollDown(page, file === '06_API設計書.md' ? 900 : 350, 2500);
    await say(page, label, 3000);
  }

  // 構成設計書と Terraform
  await page.goto(`${GITHUB}docs/02_設計/07_構成設計書.md`);
  await page.locator('article.markdown-body').first().waitFor();
  await scrollTo(page.locator('article.markdown-body h2').nth(1), 3000);
  await say(page, 'AWS は、管理画面で手作業で作るのではなく、\nTerraform というコードで作りました。', 5000);
  await page.goto(`${GITHUB_TREE}infra`);
  await page.getByRole('link', { name: 'compute.tf' }).first().waitFor();
  await say(page, 'ここにあるファイルで、EC2、RDS、CloudFront などをまとめて作り、\n使い終わったら、まとめて消せます。', 6000);
  await say(page, '料金がかからないように、確かめるときだけ作っています。');

  // Issue と PR
  await page.goto('https://github.com/junji-sakamoto/kakeibo-app/issues?q=is%3Aissue');
  await page.waitForTimeout(2500);
  await say(page, '作業は、機能ごとに Issue とプルリクエストに分けて進めました。', 4000);
  await page.goto('https://github.com/junji-sakamoto/kakeibo-app/pulls?q=is%3Apr');
  await page.waitForTimeout(2500);
  await say(page, 'プルリクエストで、変更の内容と、確かめたことを書いてから取りこんでいます。', 4500);

  // 品質チェックの結果
  await page.goto('about:blank');
  await page.setContent(quality);
  await expect(page.locator('pre')).toContainText('27 項目中、合格 27・不合格 0');
  await say(page, '最後に、品質チェックで確かめています。\n書き方のチェック、組み立て、試験などを、まとめて行います。', 5500);
  await point(page.locator('pre > div').last(), 1200);
  await say(page, '27項目、すべて合格です。');
  await point(page.locator('.test'), 1500);
  await say(page, '処理側の試験が 40件、画面を操作する試験が、Edge と Chrome で 92件、すべて合格しています。', 5500);
  await say(page, '入力のチェックは、画面側だけでなく、処理側でも行っていて、試験で確かめています。', 5000);
  await next(page, 7);
});
