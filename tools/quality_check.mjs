// ============================================================
// 全体の品質チェック
// 書き方のチェック（LINT）・試験・組み立て・部品の弱点・資料の確認を、順番に全部行い、結果を表にまとめる
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

// コマンドを実行して、結果を記録する
// cwd：実行するフォルダ（プロジェクトの一番上から見た場所。「.」は一番上）
function check(name, command, cwd = '.', { okWhen = (r) => r.status === 0, note = () => '' } = {}) {
  process.stdout.write(`\n■ ${name}\n  ${command}\n`);
  const r = spawnSync(command, { cwd: path.join(ROOT, cwd), shell: true, encoding: 'utf8' });
  // 実行そのものができなかったとき（フォルダがない など）も、原因が分かるように表示する
  if (r.error) r.stderr = `実行できませんでした：${r.error.message}`;
  const output = `${r.stdout || ''}${r.stderr || ''}`;
  const ok = okWhen(r, output);
  const detail = note(output, r);
  results.push({ name, ok, detail });
  // 不合格のときは、原因を調べられるように出力の最後のほうを表示する
  if (!ok) process.stdout.write(output.split('\n').slice(-25).map((l) => `  | ${l}`).join('\n') + '\n');
  process.stdout.write(`  → ${ok ? '合格' : '不合格'}${detail ? `（${detail}）` : ''}\n`);
  return { ok, output };
}

// 記録だけ残す（コマンドを使わない確認）
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  process.stdout.write(`\n■ ${name}\n  → ${ok ? '合格' : '不合格'}${detail ? `（${detail}）` : ''}\n`);
}

const last = (pattern) => (out) => (out.match(pattern) || [])[0]?.trim() || '';

// ------------------------------------------------------------
// 1. 動かす仕組みの版
// ------------------------------------------------------------
const nodeMajor = Number(process.versions.node.split('.')[0]);
record('Node.js の版が 26 系か', nodeMajor === 26, `v${process.versions.node}`);

// ------------------------------------------------------------
// 2. 書き方のチェック（LINT）
// ------------------------------------------------------------
check('LINT：処理側（backend）', 'npm run lint --silent', 'backend', { note: (o) => (o.match(/✖ .*problems?.*/) || ['問題 0 件'])[0] });
check('LINT：画面側（frontend）', 'npm run lint --silent', 'frontend', { note: (o) => (o.match(/✖ .*problems?.*/) || ['問題 0 件'])[0] });

// ------------------------------------------------------------
// 3. 試験（データベースが必要）
// ------------------------------------------------------------
const db = spawnSync('docker', ['inspect', '-f', '{{.State.Health.Status}}', 'kakeibo-db'], { encoding: 'utf8' });
const dbReady = db.status === 0 && db.stdout.trim() === 'healthy';
if (!dbReady) {
  record('データベースが起動しているか', false, 'kakeibo-db が起動していません。docs/03_手順書/01_データベースの手順書.md の「2. 起動する」を行ってから、もう一度実行してください');
} else {
  record('データベースが起動しているか', true, 'kakeibo-db');
  check('試験：処理側の API（npm test）', 'npm test --silent', 'backend', {
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
}

// ------------------------------------------------------------
// 4. 組み立て（画面側を公開用に組み立てられるか）
// ------------------------------------------------------------
check('組み立て：画面側（npm run build）', 'npm run build --silent', 'frontend', { note: last(/built in [\d.]+m?s/) });

// ------------------------------------------------------------
// 5. 部品の弱点（npm audit）
// ------------------------------------------------------------
for (const dir of ['backend', 'frontend']) {
  check(`部品の弱点：${dir}（npm audit）`, 'npm audit', dir, { note: last(/found \d+ vulnerabilit\w+|\d+ \w+ severity vulnerabilit\w+/) });
}

// ------------------------------------------------------------
// 6. 資料
// ------------------------------------------------------------
check('資料：要件定義書.md が最新か', 'node tools/build_requirements.mjs --check');

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
record('資料：リンク切れがないか', broken.length === 0, `リンク ${linkCount} 個、リンク切れ ${broken.length} 個${broken.length ? `：${broken.join('、')}` : ''}`);

// ------------------------------------------------------------
// 結果のまとめ
// ------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
process.stdout.write('\n============================================================\n');
process.stdout.write(' 品質チェックの結果\n');
process.stdout.write('============================================================\n');
for (const r of results) process.stdout.write(` ${r.ok ? '✔ 合格  ' : '✖ 不合格'}  ${r.name}${r.detail ? `（${r.detail}）` : ''}\n`);
process.stdout.write('------------------------------------------------------------\n');
process.stdout.write(` ${results.length} 項目中、合格 ${results.length - failed.length}・不合格 ${failed.length}\n`);
process.exit(failed.length === 0 ? 0 : 1);
