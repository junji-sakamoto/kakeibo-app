// ============================================================
// E2E 試験：記録（画面1 記録一覧画面・画面2 記録入力画面）
// 試験の名前の「機能〇」「遷移〇」は、docs/01_要件定義/03_機能一覧.md と docs/02_設計/02_画面遷移図.md の番号
// ============================================================

import { test, expect } from '@playwright/test';
import { api, categoryId, createRecord, cleanUp, thisMonth, monthLabel, ui, yen } from './helpers.js';

const WEEK = '日月火水木金土';
const weekday = (ymd) => WEEK[new Date(`${ymd}T00:00:00`).getDay()];
const listDate = (ymd) => `${Number(ymd.slice(5, 7))}月${Number(ymd.slice(8))}日（${weekday(ymd)}）`;

let food; // 支出用「食費」の番号
let eatOut; // 支出用「外食」の番号
let salary; // 収入用「給料」の番号

test.beforeAll(async ({ request }) => {
  await cleanUp(request);
  food = await categoryId(request, 'expense', '食費');
  eatOut = await categoryId(request, 'expense', '外食');
  salary = await categoryId(request, 'income', '給料');
});
test.afterAll(async ({ request }) => cleanUp(request));
test.beforeEach(async ({ request }) => cleanUp(request));

// ------------------------------------------------------------
test.describe('画面1 記録一覧画面', () => {
  test('遷移1：アプリを開くと、今月の記録一覧画面が表示され、メニューの「月ごとの記録」が目立つ', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/records$/);
    await expect(page.locator('.month-label')).toHaveText(monthLabel(thisMonth()));
    await expect(page.locator('.header-nav').getByRole('link', { name: '月ごとの記録', exact: true })).toHaveClass(/is-active/);
    // メニューの名前は、押すと何ができるかが分かる名前にしている
    await expect(page.locator('.header-nav a')).toHaveText(['月ごとの記録', '年間の集計', 'カテゴリの設定']);
  });

  test('機能2・機能5：その月の記録だけを、日付の新しい順（同じ日はあとから登録した順）に並べ、合計を表示する', async ({ page, request }) => {
    await createRecord(request, { date: '2099-12-10', categoryId: salary, amount: 300000, memo: 'E2E給料' });
    await createRecord(request, { date: '2099-12-10', categoryId: food, amount: 1000, memo: 'E2E食費' });
    await createRecord(request, { date: '2099-12-31', categoryId: eatOut, amount: 2000, memo: 'E2E外食' });
    await createRecord(request, { date: '2099-11-30', categoryId: food, amount: 999, memo: 'E2E前の月' });

    await page.goto('/records?month=2099-12');
    await expect(page.locator('.month-label')).toHaveText('2099年12月');
    await expect(ui.rows(page).locator('.memo')).toHaveText(['E2E外食', 'E2E食費', 'E2E給料']);
    await expect(ui.row(page, 'E2E外食').locator('.date')).toHaveText(listDate('2099-12-31'));
    await expect(ui.row(page, 'E2E外食').locator('.badge')).toHaveText('支出');
    await expect(ui.row(page, 'E2E給料').locator('.badge')).toHaveText('収入');
    await expect(ui.row(page, 'E2E外食').locator('.category')).toHaveText('外食');
    await expect(ui.row(page, 'E2E給料').locator('.amount')).toHaveText('300,000円');
    await expect(ui.totals(page)).toHaveText(['300,000円', '3,000円', '297,000円']);
  });

  test('機能2・機能5：記録のない月は「この月の記録はありません。」（N01）と 0円 を表示する', async ({ page }) => {
    await page.goto('/records?month=2099-10');
    await expect(page.locator('.list .empty')).toHaveText('この月の記録はありません。');
    await expect(ui.totals(page)).toHaveText(['0円', '0円', '0円']);
  });

  test('機能5：差額がマイナスのときは「-」を付けて赤系の色にする', async ({ page, request }) => {
    await createRecord(request, { date: '2099-12-01', categoryId: food, amount: 5200, memo: 'E2Eマイナス' });
    await page.goto('/records?month=2099-12');
    const balance = ui.totals(page).nth(2);
    await expect(balance).toHaveText('-5,200円');
    await expect(balance).toHaveClass(/is-minus/);
  });

  test('機能5（繰越）：前月からの繰越は前の月までの全部の記録の 収入 − 支出、繰越後の残高は 繰越 ＋ 差額。収入の合計には入れない', async ({ page, request }) => {
    // 試験の記録を入れる前の、2099年11月の繰越（お試しデータなどから計算された金額）
    const base = (await api(request, 'GET', '/records?month=2099-11')).body.totals.carryover;
    await createRecord(request, { date: '2099-11-20', categoryId: food, amount: 999, memo: 'E2E前の月' });
    await createRecord(request, { date: '2099-12-10', categoryId: salary, amount: 300000, memo: 'E2E給料' });
    await createRecord(request, { date: '2099-12-11', categoryId: food, amount: 1000, memo: 'E2E食費' });

    await page.goto('/records?month=2099-12');
    await expect(ui.totals(page)).toHaveText(['300,000円', '1,000円', '299,000円']); // 繰越は収入に入らない
    await expect(ui.carry(page)).toHaveText([yen(base - 999), yen(base - 999 + 299000)]);

    // 前の月に戻ると、その月の「繰越後の残高」が、12月の「前月からの繰越」と同じ
    await page.getByRole('button', { name: '◀ 前の月' }).click();
    await expect(page.locator('.month-label')).toHaveText('2099年11月');
    await expect(ui.carry(page)).toHaveText([yen(base), yen(base - 999)]);

    // 前の月の記録を削除すると、保存していないので、12月の繰越もすぐに変わる
    await page.getByRole('button', { name: '削除' }).click();
    await ui.dialog(page).getByRole('button', { name: '削除する' }).click();
    await expect(ui.toast(page)).toHaveText('記録を削除しました。');
    await page.getByRole('button', { name: '次の月 ▶' }).click();
    await expect(ui.carry(page)).toHaveText([yen(base), yen(base + 299000)]);
  });

  test('機能5（繰越）：繰越がマイナスのときは「-」を付けて赤系の色にする', async ({ page, request }) => {
    // 前の月までの残高がマイナスになるように、11月に大きな支出を入れる
    const base = (await api(request, 'GET', '/records?month=2099-11')).body.totals.carryover;
    const amount = Math.min(Math.max(base + 1, 1), 9999999);
    await createRecord(request, { date: '2099-11-20', categoryId: food, amount, memo: 'E2E大きな支出' });
    await page.goto('/records?month=2099-12');
    const carryover = ui.carry(page).first();
    await expect(carryover).toHaveText(yen(base - amount));
    await expect(carryover).toHaveClass(/is-minus/);
  });

  test('月の切り替え：「前の月」「次の月」「今月」で、表示する月が変わる', async ({ page }) => {
    await page.goto('/records?month=2099-12');
    await page.getByRole('button', { name: '◀ 前の月' }).click();
    await expect(page).toHaveURL(/month=2099-11/);
    await expect(page.locator('.month-label')).toHaveText('2099年11月');
    await page.getByRole('button', { name: '次の月 ▶' }).click();
    await expect(page.locator('.month-label')).toHaveText('2099年12月');
    await page.getByRole('button', { name: '今月' }).click();
    await expect(page.locator('.month-label')).toHaveText(monthLabel(thisMonth()));
  });
});

// ------------------------------------------------------------
test.describe('画面2 記録入力画面（登録）', () => {
  test('遷移2：「＋ 登録」で記録入力画面が開き、最初の値は 今日・支出・未選択', async ({ page }) => {
    await page.goto('/records?month=2099-12');
    await page.getByRole('link', { name: '＋ 登録' }).click();
    await expect(page).toHaveURL(/\/records\/new\?month=2099-12/);
    await expect(page.locator('.page-title')).toHaveText('記録の登録');
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    await expect(page.getByLabel('日付')).toHaveValue(today);
    await expect(page.getByLabel('支出', { exact: true })).toBeChecked();
    await expect(page.getByLabel('カテゴリ')).toHaveValue('');
    await expect(page.getByRole('button', { name: '保存する' })).toBeVisible();
  });

  test('機能1・遷移4：正しく入力して保存すると、保存した記録の月の一覧に戻り「記録を登録しました。」（I01）', async ({ page }) => {
    await page.goto('/records'); // 今月の一覧から始めて、2099年12月の記録を登録する
    await page.getByRole('link', { name: '＋ 登録' }).click();
    await page.getByLabel('日付').fill('2099-12-05');
    await page.getByLabel('カテゴリ').selectOption({ label: '食費' });
    await page.getByLabel('金額').fill('800');
    await page.getByLabel('メモ').fill('  E2E登録  ');
    await page.getByRole('button', { name: '保存する' }).click();

    await expect(page).toHaveURL(/\/records\?month=2099-12$/);
    await expect(ui.toast(page)).toHaveText('記録を登録しました。');
    await expect(ui.row(page, 'E2E登録').locator('.amount')).toHaveText('800円'); // メモの前後の空白は取り除かれる
  });

  test('遷移5：入力に間違いがあると、項目の下にメッセージを出し、画面は変わらない（読み上げ用の印も付く）', async ({ page }) => {
    await page.goto('/records/new?month=2099-12');
    await page.getByLabel('日付').fill('');
    await page.getByRole('button', { name: '保存する' }).click();
    await expect(page).toHaveURL(/\/records\/new/);
    await expect(ui.fieldError(page, 'date')).toHaveText('日付を入力してください。');
    await expect(ui.fieldError(page, 'category')).toHaveText('カテゴリを選んでください。');
    await expect(ui.fieldError(page, 'amount')).toHaveText('金額を入力してください。');
    await expect(page.getByLabel('金額')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('メモ')).not.toHaveAttribute('aria-invalid', 'true');

    for (const [amount, message] of [['0', '金額は1以上の整数で入力してください。'], ['1.5', '金額は1以上の整数で入力してください。'],
      ['1,200', '金額は1以上の整数で入力してください。'], ['10000000', '金額は9,999,999円以下で入力してください。']]) {
      await page.getByLabel('金額').fill(amount);
      await page.getByRole('button', { name: '保存する' }).click();
      await expect(ui.fieldError(page, 'amount'), amount).toHaveText(message);
    }
    await page.getByLabel('メモ').fill('あ'.repeat(101));
    await page.getByRole('button', { name: '保存する' }).click();
    await expect(ui.fieldError(page, 'memo')).toHaveText('メモは100文字以内で入力してください。');
  });

  test('N06：収入用の「繰越金」を選んでいるときだけ、1回だけ記録する注意書きを出す（保存はできる）', async ({ page, request }) => {
    const N06 = '繰越金は、家計簿を使い始めた月に1回だけ記録します。次の月からは、自動で繰り越されます。';
    await page.goto('/records/new?month=2099-12');
    await expect(page.getByText(N06)).toHaveCount(0);
    await page.getByLabel('収入', { exact: true }).check();
    await page.getByLabel('カテゴリ').selectOption({ label: '繰越金' });
    await expect(page.getByText(N06)).toBeVisible();
    await page.getByLabel('カテゴリ').selectOption({ label: '給料' });
    await expect(page.getByText(N06)).toHaveCount(0);

    // 入力の間違いではないので、繰越金でも保存できる。ふつうの収入として、その月の収入の合計に入る
    await page.getByLabel('カテゴリ').selectOption({ label: '繰越金' });
    await page.getByLabel('日付').fill('2099-12-01');
    await page.getByLabel('金額').fill('50000');
    await page.getByLabel('メモ').fill('E2E使い始めの手持ち');
    await page.getByRole('button', { name: '保存する' }).click();
    await expect(ui.toast(page)).toHaveText('記録を登録しました。');
    await expect(ui.row(page, 'E2E使い始めの手持ち').locator('.category')).toHaveText('繰越金');
    await expect(ui.totals(page).first()).toHaveText('50,000円');
    const { body } = await api(request, 'GET', '/records?month=2099-12');
    expect(body.totals.income).toBe(50000);
  });

  test('種類を「収入」に切り替えると、カテゴリの選択肢が収入用に変わり、「未選択」に戻る（「その他」は一番下）', async ({ page, request }) => {
    await page.goto('/records/new?month=2099-12');
    await page.getByLabel('日付').fill('2099-12-03');
    await page.getByLabel('カテゴリ').selectOption({ label: '食費' });
    await page.getByLabel('金額').fill('100');
    await page.getByLabel('収入', { exact: true }).check();
    await expect(page.getByLabel('カテゴリ')).toHaveValue('');
    const options = page.getByLabel('カテゴリ').locator('option');
    await expect(options.first()).toHaveText('選んでください');
    await expect(options.last()).toHaveText('その他');
    await expect(options.filter({ hasText: '給料' })).toHaveCount(1);
    await expect(options.filter({ hasText: '食費' })).toHaveCount(0);

    // 見た目だけでなく、本当に「未選択」に戻っているか：そのまま保存すると E04 が出て、保存されない
    // （戻っていないと、見た目は空なのに、前に選んだ「食費」で保存されてしまう）
    await page.getByRole('button', { name: '保存する' }).click();
    await expect(ui.fieldError(page, 'category')).toHaveText('カテゴリを選んでください。');
    const { body } = await api(request, 'GET', '/records?month=2099-12');
    expect(body.records).toHaveLength(0);
  });

  test('遷移6：「戻る」で、保存せずに直前に見ていた月の一覧に戻る', async ({ page, request }) => {
    await page.goto('/records?month=2099-12');
    await page.getByRole('link', { name: '＋ 登録' }).click();
    await page.getByLabel('金額').fill('500');
    await page.getByRole('link', { name: '戻る' }).click();
    await expect(page).toHaveURL(/\/records\?month=2099-12$/);
    const { body } = await api(request, 'GET', '/records?month=2099-12');
    expect(body.records).toHaveLength(0);
  });

  test('二重の登録の防止：「保存する」を押してから結果が出るまで、ボタンを押せない', async ({ page }) => {
    // 処理側の返事をわざと遅らせて、ボタンの状態を確かめる
    await page.route('**/api/records', async (route) => {
      if (route.request().method() === 'POST') await new Promise((r) => setTimeout(r, 1000));
      await route.continue();
    });
    await page.goto('/records/new?month=2099-12');
    await page.getByLabel('日付').fill('2099-12-06');
    await page.getByLabel('カテゴリ').selectOption({ label: '食費' });
    await page.getByLabel('金額').fill('100');
    await page.getByRole('button', { name: '保存する' }).click();
    await expect(page.getByRole('button', { name: '保存する' })).toBeDisabled();
    await expect(ui.toast(page)).toHaveText('記録を登録しました。');
  });
});

// ------------------------------------------------------------
test.describe('画面2 記録入力画面（修正）', () => {
  test('遷移3・機能3：「修正」で登録してある値が入った状態で開き、更新すると「記録を更新しました。」（I02）', async ({ page, request }) => {
    const r = await createRecord(request, { date: '2099-12-07', categoryId: food, amount: 1500, memo: 'E2E修正前' });
    await page.goto('/records?month=2099-12');
    await ui.row(page, 'E2E修正前').getByRole('link', { name: '修正' }).click();

    await expect(page).toHaveURL(new RegExp(`/records/${r.id}/edit\\?month=2099-12`));
    await expect(page.locator('.page-title')).toHaveText('記録の修正');
    await expect(page.getByLabel('日付')).toHaveValue('2099-12-07');
    await expect(page.getByLabel('カテゴリ')).toHaveValue(String(food));
    await expect(page.getByLabel('金額')).toHaveValue('1500');
    await page.getByLabel('金額').fill('2500');
    await page.getByLabel('メモ').fill('E2E修正後');
    await page.getByRole('button', { name: '更新する' }).click();

    await expect(ui.toast(page)).toHaveText('記録を更新しました。');
    await expect(ui.row(page, 'E2E修正後').locator('.amount')).toHaveText('2,500円');
    await expect(ui.row(page, 'E2E修正前')).toHaveCount(0);
  });

  test('遷移7：修正しようとした記録が削除されていたら、一覧に戻り S02 を表示する（開くとき・更新するとき）', async ({ page, request }) => {
    // 開くとき
    const gone = await createRecord(request, { date: '2099-12-08', categoryId: food, amount: 100, memo: 'E2E消えた' });
    await api(request, 'DELETE', `/records/${gone.id}`);
    await page.goto(`/records/${gone.id}/edit?month=2099-12`);
    await expect(page).toHaveURL(/\/records\?month=2099-12$/);
    await expect(ui.toast(page)).toHaveText('対象のデータが見つかりません。すでに削除された可能性があります。');

    // 更新するとき（開いたあとに、ほかの画面で削除された）
    const r = await createRecord(request, { date: '2099-12-09', categoryId: food, amount: 100, memo: 'E2E途中で消えた' });
    await page.goto(`/records/${r.id}/edit?month=2099-12`);
    await expect(page.getByLabel('金額')).toHaveValue('100');
    await api(request, 'DELETE', `/records/${r.id}`);
    await page.getByRole('button', { name: '更新する' }).click();
    await expect(page).toHaveURL(/\/records\?month=2099-12$/);
    await expect(ui.toast(page)).toHaveText('対象のデータが見つかりません。すでに削除された可能性があります。');
  });
});

// ------------------------------------------------------------
test.describe('記録の削除', () => {
  test('遷移8〜10・機能4：「削除」で確認の窓（Q01）。「キャンセル」なら何もせず、「削除する」で削除して「記録を削除しました。」（I03）', async ({ page, request }) => {
    await createRecord(request, { date: '2099-12-08', categoryId: food, amount: 1200, memo: 'E2E削除' });
    await createRecord(request, { date: '2099-12-09', categoryId: food, amount: 300, memo: 'E2E残す' });
    await page.goto('/records?month=2099-12');
    await expect(ui.totals(page).nth(1)).toHaveText('1,500円');

    await ui.row(page, 'E2E削除').getByRole('button', { name: '削除', exact: true }).click();
    await expect(ui.dialog(page)).toBeVisible();
    // toHaveText は空白（全角の空白・改行も）をまとめてしまうので、文字そのものを比べる（表示されるまで待つ：RP-29）
    await expect.poll(() => ui.dialog(page).locator('.dialog-message').textContent())
      .toBe('この記録を削除しますか？\n（12月8日　支出　食費　1,200円）\n削除すると元に戻せません。');

    await ui.dialog(page).getByRole('button', { name: 'キャンセル' }).click();
    await expect(ui.dialog(page)).toBeHidden();
    await expect(ui.row(page, 'E2E削除')).toHaveCount(1);

    await ui.row(page, 'E2E削除').getByRole('button', { name: '削除', exact: true }).click();
    await ui.dialog(page).getByRole('button', { name: '削除する' }).click();
    await expect(ui.toast(page)).toHaveText('記録を削除しました。');
    await expect(ui.row(page, 'E2E削除')).toHaveCount(0);
    await expect(ui.totals(page).nth(1)).toHaveText('300円'); // 合計も計算し直される
  });
});

// ------------------------------------------------------------
test.describe('画面の上のメニュー・ブラウザの「戻る」', () => {
  test('遷移15・遷移16：「家計簿」「月ごとの記録」を押すと、今月の記録一覧に移る', async ({ page }) => {
    for (const name of ['家計簿', '月ごとの記録']) {
      await page.goto('/records?month=2099-12');
      const link = name === '家計簿' ? page.locator('.header-title') : page.locator('.header-nav').getByRole('link', { name, exact: true });
      await link.click();
      await expect(page, name).toHaveURL(/\/records$/);
      await expect(page.locator('.month-label'), name).toHaveText(monthLabel(thisMonth()));
    }
  });

  test('遷移18：入力の途中でメニューを押すと、その画面に移り、入力した内容は保存されない', async ({ page, request }) => {
    await page.goto('/records/new?month=2099-12');
    await page.getByLabel('日付').fill('2099-12-10');
    await page.getByLabel('カテゴリ').selectOption({ label: '食費' });
    await page.getByLabel('金額').fill('700');
    await page.locator('.header-nav').getByRole('link', { name: 'カテゴリの設定', exact: true }).click();
    await expect(page).toHaveURL(/\/categories$/);
    const { body } = await api(request, 'GET', '/records?month=2099-12');
    expect(body.records).toHaveLength(0);
  });

  test('遷移20：ブラウザの「戻る」で、1つ前の画面に戻る', async ({ page }) => {
    await page.goto('/records?month=2099-12');
    await page.getByRole('button', { name: '◀ 前の月' }).click();
    await expect(page.locator('.month-label')).toHaveText('2099年11月');
    await page.goBack();
    await expect(page.locator('.month-label')).toHaveText('2099年12月');
    await page.getByRole('link', { name: '＋ 登録' }).click();
    await expect(page.locator('.page-title')).toHaveText('記録の登録');
    await page.goBack();
    await expect(page).toHaveURL(/\/records\?month=2099-12$/);
  });
});
