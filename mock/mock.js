// ============================================================
// 家計簿 画面モックの動き
// ・画面の内容は docs/01_要件定義/05-0〜05-4 の画面要件どおり
// ・表示する文章は docs/01_要件定義/06_メッセージ一覧.md どおり
// ・データはブラウザの中だけで持つ（保存しない。再読み込みで元に戻る）
// ============================================================

// ------------------------------------------------------------
// メッセージ一覧（06_メッセージ一覧.md の番号と同じ）
// ------------------------------------------------------------
const MSG = {
  I01: '記録を登録しました。',
  I02: '記録を更新しました。',
  I03: '記録を削除しました。',
  I04: 'カテゴリを登録しました。',
  I05: 'カテゴリを更新しました。',
  I06: 'カテゴリを削除しました。',
  N01: 'この月の記録はありません。',
  N02: 'カテゴリがありません。カテゴリ画面で登録してください。',
  N03: 'カテゴリがありません。',
  N05: (count) => `このカテゴリは${count}件の記録で使われています。\n名前を変えると、すべての記録に反映されます。`,
  E01: '日付を入力してください。',
  E02: '日付は2000年1月1日から2099年12月31日までの、正しい日付を入力してください。',
  E04: 'カテゴリを選んでください。',
  E05: '金額を入力してください。',
  E06: '金額は1以上の整数で入力してください。',
  E07: '金額は9,999,999円以下で入力してください。',
  E08: 'メモは100文字以内で入力してください。',
  E09: 'カテゴリ名を入力してください。',
  E10: 'カテゴリ名は20文字以内で入力してください。',
  E11: '同じ名前のカテゴリがすでにあります。',
  E12: 'このカテゴリは記録で使われているため削除できません。',
  S02: '対象のデータが見つかりません。すでに削除された可能性があります。',
  S03: 'ページが見つかりません。',
};

const TYPE_LABEL = { income: '収入', expense: '支出' };
const WEEK = '日月火水木金土';

// ------------------------------------------------------------
// 小さな道具（日付・金額の表示など）
// ------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function getToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// "2026-11-02" を日付に変える。ない日付（2月30日など）は null
function parseYmd(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return d;
}

// 一覧の日付：「11月2日（月）」
function formatListDate(text) {
  const d = parseYmd(text);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）`;
}

// 金額：「1,000円」「-1,000円」
function formatYen(n) {
  return (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('ja-JP') + '円';
}

// 文字の長さ（絵文字なども1文字として数える）
const charLength = (text) => [...text].length;

// 画面に表示する文字を安全な形にする（XSS 対策）
function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ------------------------------------------------------------
// データ（データベースのお試しデータと同じ内容）
// ------------------------------------------------------------
const today = getToday();
const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
const beforeLast = new Date(today.getFullYear(), today.getMonth() - 2, 1);

const state = {
  // 表示中の月（その月の1日）
  month: thisMonth,
  categories: [],
  records: [],
  nextRecordId: 1,
  nextCategoryId: 1,
};

// 最初から入れておくカテゴリ（database/sql/02_insert_categories.sql と同じ順番）
[
  ['income', ['給料', '賞与', '副業', '臨時収入', 'その他']],
  ['expense', ['食費', '外食', '日用品', '住居費', '光熱費', '通信費', '交通費', '医療費', '衣服・美容', '趣味・娯楽', '交際費', 'その他']],
].forEach(([type, names]) => {
  names.forEach((name) => state.categories.push({ id: state.nextCategoryId++, type, name }));
});

// 種類と名前から、カテゴリの番号を探す
const categoryId = (type, name) => state.categories.find((c) => c.type === type && c.name === name).id;

// 今月の分は、今日より先の日付にならないようにする
const inThisMonth = (n) => {
  const d = addDays(thisMonth, n);
  return d > today ? today : d;
};

// お試し用の記録（database/sql/03_insert_sample_records.sql と同じ内容・28件）
[
  // [種類, カテゴリの名前, 日付, 金額, メモ]
  // ---------- 先々月（12件） ----------
  ['income', '給料', addDays(beforeLast, 24), 250000, '給料'],
  ['expense', '外食', addDays(beforeLast, 1), 1200, 'ランチ'],
  ['expense', '交通費', addDays(beforeLast, 2), 500, 'バス'],
  ['expense', '食費', addDays(beforeLast, 5), 3800, 'スーパーで買い物'],
  ['expense', '日用品', addDays(beforeLast, 8), 1500, '洗剤・ティッシュ'],
  ['expense', '交際費', addDays(beforeLast, 12), 4000, '友人と食事'],
  ['expense', '光熱費', addDays(beforeLast, 14), 8200, '電気代'],
  ['expense', '光熱費', addDays(beforeLast, 17), 4300, 'ガス代'],
  ['expense', '通信費', addDays(beforeLast, 19), 3300, 'スマートフォン'],
  ['expense', '食費', addDays(beforeLast, 20), 2600, ''],
  ['expense', '趣味・娯楽', addDays(beforeLast, 22), 5000, '本'],
  ['expense', '住居費', addDays(beforeLast, 26), 65000, '家賃'],
  // ---------- 先月（13件） ----------
  ['income', '給料', addDays(lastMonth, 24), 250000, '給料'],
  ['income', '副業', addDays(lastMonth, 10), 3000, 'フリマアプリで売上'],
  ['expense', '食費', addDays(lastMonth, 0), 4200, 'スーパーで買い物'],
  ['expense', '交通費', addDays(lastMonth, 3), 1040, '電車（往復）'],
  ['expense', '外食', addDays(lastMonth, 6), 980, 'ランチ'],
  ['expense', '日用品', addDays(lastMonth, 9), 780, '歯みがき粉'],
  ['expense', '光熱費', addDays(lastMonth, 14), 7900, '電気代'],
  ['expense', '医療費', addDays(lastMonth, 15), 1500, '病院'],
  ['expense', '光熱費', addDays(lastMonth, 18), 3100, '水道代'],
  ['expense', '通信費', addDays(lastMonth, 19), 3300, 'スマートフォン'],
  ['expense', '外食', addDays(lastMonth, 21), 5600, '家族で外食'],
  ['expense', '衣服・美容', addDays(lastMonth, 26), 2000, '散髪'],
  ['expense', '住居費', addDays(lastMonth, 26), 65000, '家賃'],
  // ---------- 今月（3件） ----------
  ['expense', '食費', inThisMonth(0), 3500, 'スーパーで買い物'],
  ['expense', '交通費', inThisMonth(1), 500, 'バス'],
  ['expense', '外食', inThisMonth(1), 1200, 'ランチ'],
].forEach(([type, name, date, amount, memo]) => {
  state.records.push({ id: state.nextRecordId++, categoryId: categoryId(type, name), date: toYmd(date), amount, memo });
});

const findCategory = (id) => state.categories.find((c) => c.id === id);

// 種類ごとのカテゴリを、表示する順に並べて返す
// 並び順：登録した順。ただし名前が「その他」のカテゴリは一番下
function categoriesOf(type) {
  const isOther = (c) => (c.name === 'その他' ? 1 : 0);
  return state.categories
    .filter((c) => c.type === type)
    .sort((a, b) => isOther(a) - isOther(b) || a.id - b.id);
}
const findRecord = (id) => state.records.find((r) => r.id === id);

// ------------------------------------------------------------
// 完了・エラーのお知らせ（数秒間だけ表示）
// ------------------------------------------------------------
const toast = document.getElementById('toast');
let toastTimer = null;
// お知らせを出した時刻（出した直後の画面の切り替えでは、お知らせを消さないため）
let toastShownAt = 0;

function showToast(message, kind = 'success') {
  toast.textContent = message;
  toast.className = `toast ${kind}`;
  toast.hidden = false;
  toastShownAt = Date.now();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
}

// 画面を切り替えたら、前の画面のお知らせを消す
// （保存した直後に一覧へ戻るときなど、今出したばかりのお知らせは残す）
function clearOldToast() {
  if (Date.now() - toastShownAt > 500) toast.hidden = true;
}

// ------------------------------------------------------------
// 削除の確認の窓（画面の中に表示するダイアログ）
// 「削除する」を押したら true、「キャンセル」や Esc キーなら false を返す
// ------------------------------------------------------------
const confirmDialog = document.getElementById('confirm-dialog');

function askConfirm(message) {
  return new Promise((resolve) => {
    confirmDialog.querySelector('.dialog-message').textContent = message;
    confirmDialog.returnValue = '';
    confirmDialog.addEventListener('close', () => resolve(confirmDialog.returnValue === 'ok'), { once: true });
    confirmDialog.showModal();
  });
}

// ------------------------------------------------------------
// 画面の切り替え（アドレスの # の後ろで、どの画面を出すか決める）
// ------------------------------------------------------------
const app = document.getElementById('app');

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function render() {
  clearOldToast();
  const hash = location.hash || '#/records';
  let m;
  if (hash === '#/records') renderRecordList();
  else if (hash === '#/records/new') renderRecordForm(null);
  else if ((m = /^#\/records\/(\d+)\/edit$/.exec(hash))) renderRecordForm(Number(m[1]));
  else if (hash === '#/categories') renderCategoryList();
  else if (hash === '#/categories/new') renderCategoryForm(null);
  else if ((m = /^#\/categories\/(\d+)\/edit$/.exec(hash))) renderCategoryForm(Number(m[1]));
  else renderNotFound();

  // ヘッダーのメニューの「今開いている所」を目立たせる
  const section = hash.startsWith('#/categories') ? 'categories' : 'records';
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('is-active', a.dataset.nav === section);
  });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);

// ヘッダーの「家計簿」「記録」を押したら、今月を表示する（遷移15・16）
document.querySelectorAll('[data-reset-month]').forEach((a) => {
  a.addEventListener('click', () => { state.month = thisMonth; go('#/records'); });
});

// ============================================================
// 画面1 記録一覧画面
// ============================================================
function renderRecordList() {
  const y = state.month.getFullYear();
  const mon = state.month.getMonth();
  const prefix = `${y}-${pad(mon + 1)}-`;

  // 表示中の月の記録だけを、日付の新しい順（同じ日はあとから登録した順）に並べる
  const list = state.records
    .filter((r) => r.date.startsWith(prefix))
    .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));

  // 月の合計
  let income = 0;
  let expense = 0;
  list.forEach((r) => {
    if (findCategory(r.categoryId).type === 'income') income += r.amount;
    else expense += r.amount;
  });
  const diff = income - expense;

  const rows = list.map((r) => {
    const c = findCategory(r.categoryId);
    return `
      <div class="list-row">
        <span class="date">${formatListDate(r.date)}</span>
        <span class="type"><span class="badge ${c.type}">${TYPE_LABEL[c.type]}</span></span>
        <span class="category">${esc(c.name)}</span>
        <span class="amount">${formatYen(r.amount)}</span>
        <span class="memo" title="${esc(r.memo)}">${esc(r.memo)}</span>
        <span class="actions">
          <a class="btn btn-small" href="#/records/${r.id}/edit">修正</a>
          <button type="button" class="btn btn-small btn-danger" data-delete-record="${r.id}">削除</button>
        </span>
      </div>`;
  }).join('');

  app.innerHTML = `
    <div class="month-nav">
      <button type="button" class="btn" data-month="-1">◀ 前の月</button>
      <span class="month-label">${y}年${mon + 1}月</span>
      <button type="button" class="btn" data-month="1">次の月 ▶</button>
      <button type="button" class="btn" data-month="0">今月</button>
    </div>

    <div class="summary">
      <div class="summary-card income"><div class="label">収入</div><div class="value">${formatYen(income)}</div></div>
      <div class="summary-card expense"><div class="label">支出</div><div class="value">${formatYen(expense)}</div></div>
      <div class="summary-card"><div class="label">差額</div><div class="value ${diff < 0 ? 'is-minus' : ''}">${formatYen(diff)}</div></div>
    </div>

    <div class="page-head">
      <h1 class="page-title">記録</h1>
      <a class="btn btn-primary" href="#/records/new">＋ 登録</a>
    </div>

    <div class="list">
      ${list.length === 0
        ? `<p class="empty">${MSG.N01}</p>`
        : `<div class="list-row list-head"><span>日付</span><span>種類</span><span>カテゴリ</span><span class="amount">金額</span><span>メモ</span><span></span></div>${rows}`}
    </div>`;

  // 月の切り替え
  app.querySelectorAll('[data-month]').forEach((b) => {
    b.addEventListener('click', () => {
      const n = Number(b.dataset.month);
      state.month = n === 0 ? thisMonth : new Date(y, mon + n, 1);
      render();
    });
  });

  // 削除（確認の窓 Q01）
  app.querySelectorAll('[data-delete-record]').forEach((b) => {
    b.addEventListener('click', async () => {
      const r = findRecord(Number(b.dataset.deleteRecord));
      if (!r) { showToast(MSG.S02, 'error'); render(); return; }
      const c = findCategory(r.categoryId);
      const d = parseYmd(r.date);
      const ok = await askConfirm(`この記録を削除しますか？\n（${d.getMonth() + 1}月${d.getDate()}日　${TYPE_LABEL[c.type]}　${c.name}　${formatYen(r.amount)}）\n削除すると元に戻せません。`);
      if (!ok) return;
      state.records = state.records.filter((x) => x.id !== r.id);
      showToast(MSG.I03);
      render();
    });
  });
}

// ============================================================
// 画面2 記録入力画面（登録・修正）
// ============================================================
function renderRecordForm(id) {
  const isEdit = id !== null;
  const record = isEdit ? findRecord(id) : null;

  // 修正しようとした記録が、すでに削除されていたとき（遷移7）
  if (isEdit && !record) {
    showToast(MSG.S02, 'error');
    go('#/records');
    return;
  }

  // 最初の値（登録：今日・支出・未選択／修正：登録してある値）
  const form = isEdit
    ? { date: record.date, type: findCategory(record.categoryId).type, categoryId: record.categoryId, amount: String(record.amount), memo: record.memo }
    : { date: toYmd(today), type: 'expense', categoryId: null, amount: '', memo: '' };

  app.innerHTML = `
    <h1 class="page-title">${isEdit ? '記録の修正' : '記録の登録'}</h1>
    <form class="form" novalidate>
      <div class="field" data-field="date">
        <label class="field-label" for="f-date">日付<span class="required">＊</span></label>
        <input type="date" id="f-date" value="${esc(form.date)}">
        <p class="field-error"></p>
      </div>

      <div class="field" data-field="type">
        <span class="field-label">種類<span class="required">＊</span></span>
        <div class="radio-group">
          <label><input type="radio" name="type" value="expense" ${form.type === 'expense' ? 'checked' : ''}> 支出</label>
          <label><input type="radio" name="type" value="income" ${form.type === 'income' ? 'checked' : ''}> 収入</label>
        </div>
      </div>

      <div class="field" data-field="category">
        <label class="field-label" for="f-category">カテゴリ<span class="required">＊</span></label>
        <div id="category-area"></div>
        <p class="field-error"></p>
      </div>

      <div class="field" data-field="amount">
        <label class="field-label" for="f-amount">金額<span class="required">＊</span></label>
        <div class="amount-input"><input type="text" id="f-amount" inputmode="numeric" value="${esc(form.amount)}"> 円</div>
        <p class="field-error"></p>
      </div>

      <div class="field" data-field="memo">
        <label class="field-label" for="f-memo">メモ</label>
        <input type="text" id="f-memo" value="${esc(form.memo)}">
        <span class="hint">（100文字まで）</span>
        <p class="field-error"></p>
      </div>

      <div class="form-buttons">
        <button type="submit" class="btn btn-primary" id="save-button">${isEdit ? '更新する' : '保存する'}</button>
        <a class="btn" href="#/records">戻る</a>
      </div>
      <p class="form-note">＊は必須の項目です</p>
    </form>`;

  const formEl = app.querySelector('form');
  const saveButton = app.querySelector('#save-button');

  // カテゴリの選択肢を、選んだ種類のものだけにする
  function drawCategorySelect(type, selectedId) {
    const options = categoriesOf(type);
    const area = app.querySelector('#category-area');
    if (options.length === 0) {
      // 選んだ種類のカテゴリが1つもない（N02）→ 保存できないようにする
      area.innerHTML = `<select id="f-category" disabled><option>－</option></select><p class="notice">${MSG.N02}</p>`;
      saveButton.disabled = true;
      return;
    }
    area.innerHTML = `
      <select id="f-category">
        <option value="">選んでください</option>
        ${options.map((c) => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>`;
    saveButton.disabled = false;
  }
  drawCategorySelect(form.type, form.categoryId);

  // 種類を切り替えると、カテゴリの選択肢が変わり、「未選択」に戻る
  formEl.querySelectorAll('input[name="type"]').forEach((radio) => {
    radio.addEventListener('change', () => drawCategorySelect(radio.value, null));
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = formEl.querySelector('#f-date').value;
    const categoryValue = formEl.querySelector('#f-category').value;
    const amountText = formEl.querySelector('#f-amount').value.trim();
    const memo = formEl.querySelector('#f-memo').value.trim();

    // 入力のチェック
    const errors = {};
    const d = parseYmd(date);
    if (date === '') errors.date = MSG.E01;
    else if (!d || date < '2000-01-01' || date > '2099-12-31') errors.date = MSG.E02;
    if (categoryValue === '') errors.category = MSG.E04;
    if (amountText === '') errors.amount = MSG.E05;
    else if (!/^\d+$/.test(amountText) || Number(amountText) < 1) errors.amount = MSG.E06;
    else if (Number(amountText) > 9999999) errors.amount = MSG.E07;
    if (charLength(memo) > 100) errors.memo = MSG.E08;

    showFieldErrors(formEl, errors);
    if (Object.keys(errors).length > 0) return;

    const data = { categoryId: Number(categoryValue), date, amount: Number(amountText), memo };
    if (isEdit) {
      Object.assign(record, data);
      showToast(MSG.I02);
    } else {
      state.records.push({ id: state.nextRecordId++, ...data });
      showToast(MSG.I01);
    }
    // 保存した記録の月を表示する
    state.month = new Date(d.getFullYear(), d.getMonth(), 1);
    go('#/records');
  });
}

// 項目の下にエラーを表示する
function showFieldErrors(formEl, errors) {
  formEl.querySelectorAll('.field').forEach((field) => {
    const message = errors[field.dataset.field] || '';
    field.classList.toggle('has-error', message !== '');
    const p = field.querySelector('.field-error');
    if (p) p.textContent = message;
  });
}

// ============================================================
// 画面3 カテゴリ一覧画面
// ============================================================
function renderCategoryList() {
  const section = (type, title) => {
    const list = categoriesOf(type); // 登録した順（「その他」は一番下）
    const rows = list.map((c) => `
      <div class="category-row">
        <span>${esc(c.name)}</span>
        <span class="actions">
          <a class="btn btn-small" href="#/categories/${c.id}/edit">修正</a>
          <button type="button" class="btn btn-small btn-danger" data-delete-category="${c.id}">削除</button>
        </span>
      </div>`).join('');
    return `
      <section class="category-section">
        <h2>■ ${title}</h2>
        <div class="list">${list.length === 0 ? `<p class="empty">${MSG.N03}</p>` : rows}</div>
      </section>`;
  };

  app.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">カテゴリ</h1>
      <a class="btn btn-primary" href="#/categories/new">＋ 登録</a>
    </div>
    ${section('expense', '支出用')}
    ${section('income', '収入用')}`;

  // 削除（確認の窓 Q02）
  app.querySelectorAll('[data-delete-category]').forEach((b) => {
    b.addEventListener('click', async () => {
      const c = findCategory(Number(b.dataset.deleteCategory));
      if (!c) { showToast(MSG.S02, 'error'); render(); return; }
      if (!(await askConfirm(`カテゴリ「${c.name}」を削除しますか？\n削除すると元に戻せません。`))) return;
      // 記録で使われているカテゴリは削除できない（E12）
      if (state.records.some((r) => r.categoryId === c.id)) {
        showToast(MSG.E12, 'error');
        return;
      }
      state.categories = state.categories.filter((x) => x.id !== c.id);
      showToast(MSG.I06);
      render();
    });
  });
}

// ============================================================
// 画面4 カテゴリ入力画面（登録・修正）
// ============================================================
function renderCategoryForm(id) {
  const isEdit = id !== null;
  const category = isEdit ? findCategory(id) : null;

  if (isEdit && !category) {
    showToast(MSG.S02, 'error');
    go('#/categories');
    return;
  }

  const type = isEdit ? category.type : 'expense';
  const disabled = isEdit ? 'disabled' : '';
  // 修正のとき：このカテゴリを使っている記録の件数（すべての月）
  const usedCount = isEdit ? state.records.filter((r) => r.categoryId === id).length : 0;

  app.innerHTML = `
    <h1 class="page-title">${isEdit ? 'カテゴリの修正' : 'カテゴリの登録'}</h1>
    <form class="form" novalidate>
      <div class="field" data-field="type">
        <span class="field-label">種類<span class="required">＊</span></span>
        <div class="radio-group">
          <label><input type="radio" name="type" value="expense" ${type === 'expense' ? 'checked' : ''} ${disabled}> 支出用</label>
          <label><input type="radio" name="type" value="income" ${type === 'income' ? 'checked' : ''} ${disabled}> 収入用</label>
        </div>
        ${isEdit ? '<span class="hint">種類は、登録したあとは変えられません</span>' : ''}
      </div>

      <div class="field" data-field="name">
        <label class="field-label" for="f-name">名前<span class="required">＊</span></label>
        <input type="text" id="f-name" value="${isEdit ? esc(category.name) : ''}">
        <span class="hint">（20文字まで）</span>
        <p class="field-error"></p>
        ${usedCount > 0 ? `<p class="info">${esc(MSG.N05(usedCount))}</p>` : ''}
      </div>

      <div class="form-buttons">
        <button type="submit" class="btn btn-primary">${isEdit ? '更新する' : '保存する'}</button>
        <a class="btn" href="#/categories">戻る</a>
      </div>
      <p class="form-note">＊は必須の項目です</p>
    </form>`;

  const formEl = app.querySelector('form');
  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const selectedType = formEl.querySelector('input[name="type"]:checked').value;
    const name = formEl.querySelector('#f-name').value.trim();

    // 入力のチェック（同じ名前は「完全に同じ文字」のときだけ）
    const errors = {};
    if (name === '') errors.name = MSG.E09;
    else if (charLength(name) > 20) errors.name = MSG.E10;
    else if (state.categories.some((c) => c.type === selectedType && c.name === name && c.id !== id)) errors.name = MSG.E11;

    showFieldErrors(formEl, errors);
    if (Object.keys(errors).length > 0) return;

    if (isEdit) {
      category.name = name;
      showToast(MSG.I05);
    } else {
      state.categories.push({ id: state.nextCategoryId++, type: selectedType, name });
      showToast(MSG.I04);
    }
    go('#/categories');
  });
}

// ============================================================
// 存在しないページ（S03）
// ============================================================
function renderNotFound() {
  app.innerHTML = `
    <div class="list"><p class="empty">${MSG.S03}<br><a href="#/records">記録一覧画面へ</a></p></div>`;
}

// 最初の表示
render();
