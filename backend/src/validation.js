// ============================================================
// 入力のチェック
// ルールは docs/01_要件定義/04_機能要件.md、返す番号は docs/02_設計/06_API設計書.md を参照
// 間違いがあれば、項目の名前とメッセージの番号の組（例：{ amount: 'E06' }）を返す
// ============================================================

// 文字の長さ（絵文字なども1文字として数える）
export const charLength = (text) => [...text].length;

// 空かどうか（送られていない・null・空の文字）
const isEmpty = (value) => value === undefined || value === null || value === '';

// 「2026-11-02」の形で、実際にある日付で、2000-01-01〜2099-12-31 の範囲か
export function isValidDate(text) {
  if (typeof text !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  const real = date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d; // 2月30日などを除く
  return real && text >= '2000-01-01' && text <= '2099-12-31';
}

// 「2026-11」の形で、2000-01〜2099-12 の範囲か
export function isValidMonth(text) {
  return typeof text === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(text) && text >= '2000-01' && text <= '2099-12';
}

// 「2026」の形（4けたの数字）で、2000〜2099 の範囲か（API12）
export function isValidYear(text) {
  return typeof text === 'string' && /^\d{4}$/.test(text) && text >= '2000' && text <= '2099';
}

// パスの {番号} を数に変える。1以上の整数（データベースで扱える範囲）でなければ null
export function parseId(text) {
  if (!/^[1-9]\d{0,9}$/.test(text)) return null;
  const id = Number(text);
  return id <= 4294967295 ? id : null;
}

// 記録の入力をチェックする（API3・API4）
// 戻り値：{ errors: { 項目: 番号 }, value: { date, categoryId, amount, memo } }
export function validateRecord(body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = {};

  // 日付（E01・E02）
  if (isEmpty(input.date)) errors.date = 'E01';
  else if (!isValidDate(input.date)) errors.date = 'E02';

  // カテゴリの番号（E04。ないカテゴリの番号は、データベースに入れるときに E13 にする）
  if (isEmpty(input.categoryId)) errors.categoryId = 'E04';
  else if (!Number.isInteger(input.categoryId) || input.categoryId < 1) errors.categoryId = 'E13';

  // 金額（E05・E06・E07）。文字の "1200" やカンマ付きは不可
  if (isEmpty(input.amount)) errors.amount = 'E05';
  else if (!Number.isInteger(input.amount) || input.amount < 1) errors.amount = 'E06';
  else if (input.amount > 9999999) errors.amount = 'E07';

  // メモ（E08）。省いたときは空の文字。前後の空白は取り除く
  let memo = '';
  if (!isEmpty(input.memo)) {
    if (typeof input.memo !== 'string') errors.memo = 'E08';
    else {
      memo = input.memo.trim();
      if (charLength(memo) > 100) errors.memo = 'E08';
    }
  }

  return {
    errors,
    value: { date: input.date, categoryId: input.categoryId, amount: input.amount, memo },
  };
}

// カテゴリの入力をチェックする（API8・API9）
// withType：種類もチェックするか（登録のときは true。修正のときは種類を変えられないので false）
// 戻り値：{ errors: { 項目: 番号 }, value: { type, name } }
export function validateCategory(body, { withType }) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = {};

  // 種類（E03）
  if (withType && !['income', 'expense'].includes(input.type)) errors.type = 'E03';

  // 名前（E09・E10）。前後の空白（全角の空白も）は取り除く。空白だけの名前は空とみなす
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name === '') errors.name = 'E09';
  else if (charLength(name) > 20) errors.name = 'E10';

  return { errors, value: { type: input.type, name } };
}
