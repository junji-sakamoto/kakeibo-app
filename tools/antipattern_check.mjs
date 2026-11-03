// ============================================================
// アンチパターンチェック
// 「動くけれど、やってはいけない書き方」（アンチパターン）を探す
// ESLint の一般的な決まりでは見つけにくい、このアプリで決めた約束ごと（レビューポイント RP-xx）を確かめる
//
// 使い方（プロジェクトの一番上のフォルダで実行する）
//   node tools/antipattern_check.mjs frontend   … 画面側
//   node tools/antipattern_check.mjs backend    … 処理側
//   最後に --json を付けると、結果を JSON で出す（tools/quality_check.mjs が使う）
//
// 見つかったら終わりの番号は 1。くわしくは docs/03_手順書/04_品質チェックの手順書.md
// ============================================================

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
const asJson = process.argv.includes('--json');

// フォルダの中の、決まった拡張子のファイルを全部集める
const collect = (dir, exts) => readdirSync(dir).flatMap((name) => {
  const p = path.join(dir, name);
  return statSync(p).isDirectory() ? collect(p, exts) : exts.some((e) => name.endsWith(e)) ? [p] : [];
});

// 説明（コメント）の行は調べない（説明の中に例として書いた言葉に反応しないため）
const isComment = (line) => /^\s*(\/\/|\*|\/\*|<!--)/.test(line);

// ------------------------------------------------------------
// アンチパターンの一覧
//   id：番号、rp：もとになったレビューポイント、files：調べるファイル、test：1行ずつ調べる決まり
// ------------------------------------------------------------
const FRONTEND = [
  { id: 'AP-F01', rp: 'RP-12', title: 'v-html を使っている（XSS の危険）', test: (l) => /\bv-html\b/.test(l) },
  { id: 'AP-F02', rp: 'RP-12', title: 'innerHTML・document.write で画面を書き換えている（XSS の危険）', test: (l) => /\.innerHTML\s*=|document\.write\(/.test(l) },
  { id: 'AP-F03', rp: '2026-11-02', title: 'ブラウザの小窓（alert・confirm・prompt）を使っている（ブラウザの設定で出ないことがある。画面の中の確認の窓を使う）', test: (l) => /(^|[^.\w])(alert|confirm|prompt)\s*\(/.test(l) },
  { id: 'AP-F04', rp: 'RP-17', title: 'api.js の外で fetch を使っている（処理側とのやりとりは api.js に集める）', test: (l, f) => /\bfetch\s*\(/.test(l) && !f.endsWith('api.js') },
  { id: 'AP-F05', rp: '構成', title: '処理側のアドレス（127.0.0.1:3000 など）を直接書いている（/api に送る）', test: (l, f) => /https?:\/\/(127\.0\.0\.1|localhost)/.test(l) && !f.endsWith('vite.config.js') },
  { id: 'AP-F06', rp: '品質', title: 'console.log が残っている', test: (l) => /\bconsole\.log\(/.test(l) },
  { id: 'AP-F07', rp: '品質', title: 'debugger が残っている', test: (l) => /\bdebugger\b/.test(l) },
];

const BACKEND = [
  // SQL の中に ${ } で値を埋め込んでいる。ただし、大文字だけの名前（SELECT_RECORD などの決まった文）は許す
  { id: 'AP-B01', rp: 'RP-01', title: 'SQL の文に ${ } で値を埋め込んでいる（SQL インジェクションの危険。? を使う）',
    test: (l) => /\b(SELECT|INSERT|UPDATE|DELETE|WHERE|VALUES|SET)\b/.test(l) && [...l.matchAll(/\$\{([^}]*)\}/g)].some((m) => !/^\s*[A-Z_]+\s*$/.test(m[1])) },
  { id: 'AP-B02', rp: 'RP-01', title: 'SQL の文を + でつなげて作っている（SQL インジェクションの危険。? を使う）', test: (l) => /['"`]\s*\+\s*\w+.*\b(WHERE|VALUES|SET)\b|\b(WHERE|VALUES|SET)\b[^'"`]*['"`]\s*\+/.test(l) },
  { id: 'AP-B03', rp: '品質', title: 'SELECT * を使っている（必要な項目だけを取り出す）', test: (l) => /SELECT\s+\*/i.test(l) },
  { id: 'AP-B04', rp: 'RP-03', title: 'エラーのくわしい内容（err.message・err.stack）を使う人に返している（番号だけを返す）', test: (l) => /res\.(status\([^)]*\)\.)?(json|send)\([^)]*err\.(message|stack|sqlMessage)/.test(l) },
  { id: 'AP-B05', rp: 'RP-05', title: 'パスワードなどの秘密の情報をプログラムに直接書いている（.env に書く）', test: (l) => /(password|passwd|secret|token)\s*[:=]\s*['"][^'"]+['"]/i.test(l) },
  { id: 'AP-B06', rp: 'RP-08', title: 'server.js・scripts 以外で process.exit を使っている（受け付け中のお願いが途中で切れる）', test: (l, f) => /process\.exit\(/.test(l) && !/server\.js$|[\\/]scripts[\\/]/.test(f) },
  { id: 'AP-B07', rp: '品質', title: 'API の中で同期の読み書き（readFileSync など）を使っている（ほかのお願いを待たせてしまう）', test: (l, f) => /\b\w+Sync\(/.test(l) && /[\\/]routes[\\/]/.test(f) },
  { id: 'AP-B08', rp: 'RP-03', title: 'catch で受けたエラーを何もせずに捨てている（原因が分からなくなる）', test: (l) => /catch\s*(\([^)]*\))?\s*\{\s*\}/.test(l) },
  { id: 'AP-B09', rp: '品質', title: 'routes の中で console.log を使っている（記録は共通のエラー処理で残す）', test: (l, f) => /\bconsole\.log\(/.test(l) && /[\\/]routes[\\/]/.test(f) },
  { id: 'AP-B10', rp: 'RP-07', title: '結果の番号を書かずに返している（res.json だけ。API 設計書の番号を必ず書く）', test: (l) => /\bres\.json\(/.test(l) && !/res\.status\(/.test(l) },
];

const TARGETS = {
  frontend: { rules: FRONTEND, files: () => [...collect(path.join(ROOT, 'frontend', 'src'), ['.js', '.vue'])] },
  backend: { rules: BACKEND, files: () => collect(path.join(ROOT, 'backend', 'src'), ['.js']) },
};
if (!TARGETS[target]) {
  console.error('使い方：node tools/antipattern_check.mjs frontend|backend [--json]');
  process.exit(2);
}

// ------------------------------------------------------------
// 1行ずつ調べる
// ------------------------------------------------------------
const { rules, files } = TARGETS[target];
const findings = [];
const fileList = files();
for (const file of fileList) {
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (isComment(line)) return;
    for (const rule of rules) {
      if (rule.test(line, file)) findings.push({ ...rule, file: path.relative(ROOT, file), line: i + 1, code: line.trim() });
    }
  });
}

if (asJson) {
  process.stdout.write(JSON.stringify({ target, files: fileList.length, rules: rules.length, findings }));
} else {
  console.log(`アンチパターンチェック（${target}）：${fileList.length} 個のファイル、${rules.length} 個のアンチパターンを調べました`);
  for (const f of findings) console.log(`✖ ${f.id}（${f.rp}）${f.title}\n    ${f.file}:${f.line}  ${f.code}`);
  console.log(findings.length === 0 ? '見つかりませんでした（合格）' : `${findings.length} 個見つかりました（不合格）`);
}
process.exit(findings.length === 0 ? 0 : 1);
