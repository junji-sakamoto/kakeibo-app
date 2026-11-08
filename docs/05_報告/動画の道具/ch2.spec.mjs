// 第2章 月ごとの記録
// 字幕の文章は、台本（自分用のため GitHub には上げていない）の「話すこと」と同じ
// 金額が台本と合わないときは止まる（撮る前に、お試しデータを最初の状態に戻しておく）
import { test, expect } from './pw.mjs';
import { BASE, setup, say, title, next, press, point, type, choose, setDate, cleanUp } from './lib.mjs';

test.afterEach(async ({ request }) => cleanUp(request)); // 途中で止まっても、撮影で作った記録を残さない

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const last = new Date(now.getFullYear(), now.getMonth() - 1, 15);
const LAST15 = `${last.getFullYear()}-${pad(last.getMonth() + 1)}-15`;

test('第2章 月ごとの記録', async ({ page }) => {
  await setup(page);
  await page.goto(BASE);
  const totals = page.locator('.summary:not(.carry) .summary-card');
  const carry = page.locator('.summary.carry .summary-card');
  const v = (loc, i) => loc.nth(i).locator('.value');
  await expect(v(carry, 0)).toHaveText('308,200円'); // 最初の状態か
  await title(page, '第2章', '月ごとの記録');

  // 2-1 開いたときの画面
  await say(page, 'アプリを開くと、最初に今月の記録が表示されます。');
  await point(page.locator('.header-nav a'));
  await say(page, '上のメニューで、月ごとの記録、年間の集計、カテゴリの設定を切り替えます。');
  await point(totals, 1200);
  await say(page, '上には、今月の収入、支出、差額が出ます。\n差額がマイナスのときは、赤い色で表示します。');
  await point(carry, 1200);
  await say(page, 'その下は、前の月から繰り越したお金と、今月が終わったときの残高です。');
  await say(page, '今月は、先月からの繰越が 308,200円 で、\n差額のマイナス 5,200円 を足して、残高は 303,000円 です。');
  await point(page.locator('.list'), 1200);
  await say(page, '記録は、日付の新しい順に並びます。\n収入と支出は、色だけでなく文字でも分かるようにしています。');

  // 2-2 月の切り替えと繰越
  await say(page, '前の月ボタンで、先月に移ります。', 1800);
  await press(page.getByRole('button', { name: '◀ 前の月' }));
  await expect(v(carry, 1)).toHaveText('308,200円');
  await point(carry.nth(1), 1200);
  await say(page, '先月の繰越後の残高は 308,200円 です。\nこれが、今月の前月からの繰越と同じ金額になっています。');
  await say(page, '次の月ボタンで1か月先に、今月ボタンで今月に戻ります。', 1800);
  await press(page.getByRole('button', { name: '次の月 ▶' }));
  await press(page.getByRole('button', { name: '今月' }));

  // 2-3 登録と入力のチェック
  await press(page.getByRole('link', { name: '＋ 登録' }));
  await say(page, '記録を登録します。\n日付は今日、種類は支出が、最初から選ばれています。');
  await say(page, '何も入れずに保存すると、項目のすぐ下に、何が足りないかが出ます。', 1800);
  await press(page.getByRole('button', { name: '保存する' }));
  await point(page.locator('.field-error:not(:empty)'), 1000);
  await say(page, 'この場合は、保存されません。');
  await type(page.getByLabel('金額'), '0');
  await press(page.getByRole('button', { name: '保存する' }));
  await say(page, '金額は、1円以上の整数だけです。0円は登録できません。');
  await type(page.getByLabel('金額'), '10000000');
  await press(page.getByRole('button', { name: '保存する' }));
  await say(page, '上限は 9,999,999円 です。それより大きい金額も止めます。');
  await press(page.getByLabel('収入', { exact: true }));
  await say(page, '種類を収入に切り替えると、カテゴリの選択肢も、収入用に変わります。', 1500);
  await point(page.getByLabel('カテゴリ'), 600);
  const options = await page.getByLabel('カテゴリ').locator('option').allTextContents();
  await say(page, `収入用のカテゴリ：${options.slice(1).join('・')}`);
  await press(page.getByLabel('支出', { exact: true }));
  await say(page, '支出に戻して、正しく入れて保存します。', 1500);
  await choose(page.getByLabel('カテゴリ'), '食費');
  await type(page.getByLabel('金額'), '1500');
  await type(page.getByLabel('メモ'), '動画の確認');
  await press(page.getByRole('button', { name: '保存する' }));
  await expect(page.locator('.toast')).toHaveText('記録を登録しました。');
  await say(page, '登録したというお知らせが出て、一覧に加わりました。', 2000);
  await expect(v(totals, 1)).toHaveText('6,700円');
  await point(page.locator('.summary-card'), 1200);
  await say(page, '支出の合計は 6,700円 に、残高は 301,500円 に、すぐ計算し直されます。');

  // 2-4 修正と削除
  const row = page.locator('.list-row', { has: page.locator('.memo', { hasText: '動画の確認' }) });
  await say(page, '登録した記録を直します。', 1500);
  await press(row.getByRole('link', { name: '修正' }));
  await say(page, '登録してある内容が入った状態で開きます。\n金額を 2,000円 にして、更新します。');
  await type(page.getByLabel('金額'), '2000');
  await press(page.getByRole('button', { name: '更新する' }));
  await expect(page.locator('.toast')).toHaveText('記録を更新しました。');
  await say(page, '更新したというお知らせが出て、合計も変わりました。');
  await say(page, '削除するときは、間違えて消さないように、確認の窓を出します。', 1800);
  await press(row.getByRole('button', { name: '削除' }));
  await say(page, '消す記録の日付、種類、カテゴリ、金額も表示します。');
  await say(page, 'キャンセルを押すと、何もしません。', 1500);
  await press(page.locator('dialog').getByRole('button', { name: 'キャンセル' }));
  await expect(row).toHaveCount(1);
  await press(row.getByRole('button', { name: '削除' }));
  await say(page, 'もう一度押して、削除するを押すと、消えます。', 1500);
  await press(page.locator('dialog').getByRole('button', { name: '削除する' }));
  await expect(row).toHaveCount(0);
  await expect(v(carry, 1)).toHaveText('303,000円');
  await say(page, '記録が消えて、合計も元の金額に戻りました。');

  // 2-5 繰越の自動計算
  await say(page, '繰越は、保存しておくのではなく、表示するたびに計算しています。\n確かめるために、先月に収入を足してみます。');
  await press(page.getByRole('button', { name: '◀ 前の月' }));
  await press(page.getByRole('link', { name: '＋ 登録' }));
  await press(page.getByLabel('収入', { exact: true }));
  await setDate(page.getByLabel('日付'), LAST15);
  await choose(page.getByLabel('カテゴリ'), '副業');
  await type(page.getByLabel('金額'), '5000');
  await type(page.getByLabel('メモ'), '動画の確認（先月）');
  await say(page, '先月に、副業の収入を 5,000円 登録します。', 1800);
  await press(page.getByRole('button', { name: '保存する' }));
  await expect(v(carry, 1)).toHaveText('313,200円');
  await point(carry.nth(1), 1200);
  await say(page, '先月の残高が、5,000円 増えて、313,200円 になりました。');
  await press(page.getByRole('button', { name: '次の月 ▶' }));
  await expect(v(carry, 0)).toHaveText('313,200円');
  await point(carry.nth(0), 1200);
  await say(page, '今月に戻ると、前月からの繰越も 313,200円 に変わっています。\n前の月の記録を直しても、すぐに正しい金額になります。');
  await say(page, '確かめたので、この記録は消しておきます。', 1800);
  await press(page.getByRole('button', { name: '◀ 前の月' }));
  const lastRow = page.locator('.list-row', { has: page.locator('.memo', { hasText: '動画の確認（先月）' }) });
  await press(lastRow.getByRole('button', { name: '削除' }));
  await press(page.locator('dialog').getByRole('button', { name: '削除する' }));
  await expect(v(carry, 1)).toHaveText('308,200円');

  // 2-6 繰越金のカテゴリ
  await press(page.getByRole('link', { name: '＋ 登録' }));
  await press(page.getByLabel('収入', { exact: true }));
  await say(page, '家計簿を使い始める前から持っていたお金は、繰越金というカテゴリで、\n使い始めた月に1回だけ記録します。');
  await choose(page.getByLabel('カテゴリ'), '繰越金');
  await point(page.locator('.info'), 1000);
  await say(page, '繰越金を選ぶと、1回だけ記録することと、次の月からは自動で繰り越されることを、\n案内として表示します。毎月入れて、二重に数えないようにするためです。', 7000);
  await say(page, '今回は登録せずに、戻ります。', 1800);
  await press(page.getByRole('link', { name: '戻る' }));
  await page.waitForTimeout(1000);
  await next(page, 3);
});
