// 第7章 まとめ
import { test } from './pw.mjs';
import { BASE, setup, say, clearCaption, title } from './lib.mjs';

test('第7章 まとめ', async ({ page }) => {
  await setup(page);
  await page.goto(BASE);
  await page.locator('.summary.carry').waitFor();
  await title(page, '第7章', 'まとめ');

  await say(page, '工夫したところは、3つあります。', 2500);
  await say(page, '1つ目は、繰越を保存せずに毎回計算して、\n前の月を直しても、金額がずれないようにしたことです。', 6000);
  await say(page, '2つ目は、入力のチェックを、画面と処理の両方で行ったことです。', 4500);
  await say(page, '3つ目は、AWS をコードで作り、何度でも同じ形で作り直せるようにしたことです。', 5000);
  await say(page, 'ふだん家計簿ソフトを使っていて、自分でも作れるのか試したいと思い、\nこのアプリを選びました。', 6000);
  await say(page, '実際に作ってみて、画面、処理、データベース、AWS が、\nどうつながっているのかが分かりました。', 6000);
  await say(page, 'ご覧いただき、ありがとうございました。', 3500);
  await clearCaption(page);
  await page.waitForTimeout(1500);
});
