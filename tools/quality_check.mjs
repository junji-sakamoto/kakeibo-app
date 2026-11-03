// ============================================================
// 全体の品質チェック
// 次の3つのまとまり（と、共通の確認）を順番に全部行い、結果を表にまとめる
//   ① フロントエンド：ESLint の実行・ビルド確認・アンチパターンチェック（＋部品の弱点）
//   ② バックエンド　：Checkstyle にあたるもの（ESLint）の実行・ビルド確認・アンチパターンチェック（＋試験・部品の弱点）
//   ③ ドキュメントの整合性：設計書と実装の乖離チェック（＋要件定義書が最新か・リンク切れ）
//
// 使い方（プロジェクトの一番上のフォルダで実行する。先にデータベースを起動しておく）
//   node tools/quality_check.mjs
//
// すべて合格なら終わりの番号は 0、1つでも不合格なら 1 になる
// くわしくは docs/03_手順書/04_品質チェックの手順書.md
// ============================================================

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
let group = '';

const heading = (title) => {
  group = title;
  process.stdout.write(`\n============================================================\n ${title}\n============================================================\n`);
};

// コマンドを実行して、結果を記録する
// cwd：実行するフォルダ（プロジェクトの一番上から見た場所。「.」は一番上）
function check(name, command, cwd = '.', { okWhen = (r) => r.status === 0, note = () => '' } = {}) {
  process.stdout.write(`\n■ ${name}\n  ${command}\n`);
  const r = spawnSync(command, { cwd: path.join(ROOT, cwd), shell: true, encoding: 'utf8' });
  // 実行そのものができなかったとき（フォルダがない など）も、原因が分かるように表示する
  if (r.error) r.stderr = `${r.stderr || ''}実行できませんでした：${r.error.message}`;
  const output = `${r.stdout || ''}${r.stderr || ''}`;
  const ok = okWhen(r, output);
  const detail = note(output, r);
  results.push({ group, name, ok, detail });
  // 不合格のときは、原因を調べられるように出力の最後のほうを表示する
  if (!ok) process.stdout.write(`${output.split('\n').slice(-25).map((l) => `  | ${l}`).join('\n')}\n`);
  process.stdout.write(`  → ${ok ? '合格' : '不合格'}${detail ? `（${detail}）` : ''}\n`);
  return { ok, output };
}

// 記録だけ残す（コマンドを使わない確認）
function record(name, ok, detail) {
  results.push({ group, name, ok, detail });
  process.stdout.write(`\n■ ${name}\n  → ${ok ? '合格' : '不合格'}${detail ? `（${detail}）` : ''}\n`);
}

const last = (pattern) => (out) => (out.match(pattern) || [])[0]?.trim() || '';
const lintNote = (o) => (o.match(/✖ .*problems?.*/) || ['問題 0 件'])[0];
const auditNote = last(/found \d+ vulnerabilit\w+|\d+ \w+ severity vulnerabilit\w+/);

// アンチパターンチェック（tools/antipattern_check.mjs）を行い、見つかったものを表示する
function antipattern(target) {
  const r = spawnSync(process.execPath, ['tools/antipattern_check.mjs', target, '--json'], { cwd: ROOT, encoding: 'utf8' });
  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch {
    record(`アンチパターンチェック（${target}）`, false, `実行できませんでした：${r.stderr}`);
    return;
  }
  for (const f of data.findings) process.stdout.write(`  ✖ ${f.id}（${f.rp}）${f.title}\n      ${f.file}:${f.line}  ${f.code}\n`);
  record(`アンチパターンチェック（node tools/antipattern_check.mjs ${target}）`, data.findings.length === 0,
    `${data.files} 個のファイル・${data.rules} 個のアンチパターンを調べて、見つかったのは ${data.findings.length} 個`);
}

// ============================================================
// 共通
// ============================================================
heading('共通');
const nodeMajor = Number(process.versions.node.split('.')[0]);
record('Node.js の版が 26 系か', nodeMajor === 26, `v${process.versions.node}`);
const db = spawnSync('docker', ['inspect', '-f', '{{.State.Health.Status}}', 'kakeibo-db'], { encoding: 'utf8' });
const dbReady = db.status === 0 && db.stdout.trim() === 'healthy';
record('データベースが起動しているか', dbReady, dbReady ? 'kakeibo-db'
  : 'kakeibo-db が起動していません。docs/03_手順書/01_データベースの手順書.md の「2. 起動する」を行ってから、もう一度実行してください');

// ============================================================
// ① フロントエンド
// ============================================================
heading('① フロントエンド');
check('ESLint の実行（npm run lint）', 'npm run lint --silent', 'frontend', { note: lintNote });
check('ビルド確認（npm run build）', 'npm run build --silent', 'frontend', { note: last(/built in [\d.]+m?s/) });
antipattern('frontend');
check('部品の弱点（npm audit）', 'npm audit', 'frontend', { note: auditNote });

// ============================================================
// ② バックエンド
// ============================================================
heading('② バックエンド');
// Checkstyle は Java 用の道具。JavaScript では ESLint が同じ役割をする
check('Checkstyle にあたるもの：ESLint の実行（npm run lint）', 'npm run lint --silent', 'backend', { note: lintNote });
if (dbReady) {
  check('ビルド確認（npm run build：書き方・読み込み・起動）', 'npm run build --silent', 'backend', { note: last(/① .*を確かめました/) });
} else {
  record('ビルド確認（npm run build：書き方・読み込み・起動）', false, 'データベースが起動していないため、行えませんでした');
}
antipattern('backend');
if (dbReady) {
  check('試験：API（npm test）', 'npm test --silent', 'backend', {
    note: (o) => [last(/ℹ pass \d+/)(o), last(/ℹ fail \d+/)(o)].filter(Boolean).join('・'),
  });
  // データベースの決まりの確認（check_rules.sql）。ERROR の数が決まった数（合格のしるし）と同じかを見る
  spawnSync('docker', ['cp', 'database/tests/check_rules.sql', 'kakeibo-db:/tmp/check_rules.sql'], { cwd: ROOT });
  check('試験：データベースの決まり（check_rules.sql）',
    'docker exec kakeibo-db sh -c "mysql --force --default-character-set=utf8mb4 -u\\"$MYSQL_USER\\" -p\\"$MYSQL_PASSWORD\\" \\"$MYSQL_DATABASE\\" < /tmp/check_rules.sql"', '.', {
      // 「ERROR が出れば合格」の確認が10個（確認3・6・8〜15）。予定外の ERROR が出ていないか・最後の件数の確認まで進んだかを見る
      okWhen: (r, o) => (o.match(/^ERROR /gm) || []).length === 10 && /確認18/.test(o),
      note: (o) => `決まりどおりのエラー ${(o.match(/^ERROR /gm) || []).length} / 10 件`,
    });
} else {
  record('試験：API・データベースの決まり', false, 'データベースが起動していないため、行えませんでした');
}
check('部品の弱点（npm audit）', 'npm audit', 'backend', { note: auditNote });

// ============================================================
// ③ ドキュメントの整合性
// ============================================================
heading('③ ドキュメントの整合性');
// 設計書と実装の乖離チェック（tools/docs_consistency_check.mjs）。見比べる観点ごとに1行にする
{
  const r = spawnSync(process.execPath, ['tools/docs_consistency_check.mjs', '--json'], { cwd: ROOT, encoding: 'utf8' });
  let items;
  try {
    items = JSON.parse(r.stdout);
  } catch {
    items = [{ name: '設計書と実装の乖離チェック', ok: false, detail: `実行できませんでした：${r.stderr}` }];
  }
  for (const it of items) record(`乖離チェック：${it.name}`, it.ok, it.detail);
}
check('要件定義書.md が最新か（node tools/build_requirements.mjs --check）', 'node tools/build_requirements.mjs --check');

// 資料のリンクの行き先が、すべてあるか
function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (['node_modules', '.git', 'dist'].includes(name)) return [];
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? markdownFiles(p) : name.endsWith('.md') ? [p] : [];
  });
}
const broken = [];
let linkCount = 0;
for (const file of markdownFiles(ROOT)) {
  let fence = false;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (/^\s*```/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    for (const m of line.matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)) {
      if (/^[a-z]+:/i.test(m[1])) continue; // インターネットのアドレスは調べない
      linkCount++;
      if (!existsSync(path.resolve(path.dirname(file), decodeURI(m[1])))) broken.push(`${path.relative(ROOT, file)} → ${m[1]}`);
    }
  }
}
record('資料のリンク切れがないか', broken.length === 0, `リンク ${linkCount} 個、リンク切れ ${broken.length} 個${broken.length ? `：${broken.join('、')}` : ''}`);

// ============================================================
// 結果のまとめ
// ============================================================
const failed = results.filter((r) => !r.ok);
process.stdout.write('\n============================================================\n');
process.stdout.write(' 品質チェックの結果\n');
process.stdout.write('============================================================\n');
let shown = '';
for (const r of results) {
  if (r.group !== shown) {
    process.stdout.write(` 【${r.group}】\n`);
    shown = r.group;
  }
  process.stdout.write(`  ${r.ok ? '✔ 合格  ' : '✖ 不合格'}  ${r.name}${r.detail ? `（${r.detail}）` : ''}\n`);
}
process.stdout.write('------------------------------------------------------------\n');
process.stdout.write(` ${results.length} 項目中、合格 ${results.length - failed.length}・不合格 ${failed.length}\n`);
process.exit(failed.length === 0 ? 0 : 1);
