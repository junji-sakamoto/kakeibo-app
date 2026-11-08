// ============================================================
// 日付や金額の表示のしかた、入力のチェックに使う小さな道具
// 表示のルールは docs/01_要件定義/05-0_画面一覧と共通ルール.md の「共通の表示ルール」
// ============================================================

const WEEK = '日月火水木金土';
const pad = (n) => String(n).padStart(2, '0');

// 日付を「2026-11-02」の形にする
export const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 今日・今月（今月は「2026-11」の形）
export const today = () => toYmd(new Date());
export const thisMonth = () => today().slice(0, 7);
// 今年（「2026」の形の文字）
export const thisYear = () => today().slice(0, 4);

// 「2026-11」に月を足したり引いたりする
export function addMonth(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// 「2026-11」→「2026年11月」
export function formatMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return `${y}年${m}月`;
}

// 「2026-11-02」→「11月2日（月）」
export function formatListDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${m}月${d}日（${WEEK[new Date(y, m - 1, d).getDay()]}）`;
}

// 「2026-11-02」→「11月2日」
export function formatShortDate(ymd) {
  const [, m, d] = ymd.split('-').map(Number);
  return `${m}月${d}日`;
}

// 金額：1200 →「1,200円」、-5200 →「-5,200円」
export const formatYen = (n) => `${n < 0 ? '-' : ''}${Math.abs(n).toLocaleString('ja-JP')}円`;

// 文字の長さ（絵文字なども1文字として数える）
export const charLength = (text) => [...text].length;

// 「2026-11-02」の形で、実際にある日付で、2000-01-01〜2099-12-31 の範囲か
export function isValidDate(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  const real = date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
  return real && text >= '2000-01-01' && text <= '2099-12-31';
}

// 「2026-11」の形で、2000-01〜2099-12 の範囲か
export const isValidMonth = (text) =>
  typeof text === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(text) && text >= '2000-01' && text <= '2099-12';

// 選べる年の範囲（記録の日付として登録できる範囲と同じ）
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2099;

// 「2026」の形（4けたの数字）で、2000〜2099 の範囲か
export const isValidYear = (text) =>
  typeof text === 'string' && /^\d{4}$/.test(text) && Number(text) >= MIN_YEAR && Number(text) <= MAX_YEAR;

// 「2026-03」→「3月」
export const formatMonthOnly = (month) => `${Number(month.slice(5, 7))}月`;
