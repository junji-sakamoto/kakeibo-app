// ============================================================
// ドキュメントの整合性チェック（設計書と実装の乖離チェック）
// 資料と実装の両方を読み込んで、食い違い（乖離）がないかを機械的に見比べる
//
// 使い方（プロジェクトの一番上のフォルダで実行する）
//   node tools/docs_consistency_check.mjs          … 結果を表示する
//   node tools/docs_consistency_check.mjs --json   … 結果を JSON で出す（tools/quality_check.mjs が使う）
//
// 食い違いが見つかったら終わりの番号は 1
// 食い違っていたら、このプロジェクトでは「実装を正」として資料を直す（不具合のときは実装を直す）
// ============================================================

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const lines = (p) => read(p).split('\n');
const results = [];
const add = (name, problems, detail) => results.push({ name, ok: problems.length === 0, detail: problems.length ? problems.join('／') : detail });
const diff = (a, b) => [...a].filter((x) => !b.has(x));

// ------------------------------------------------------------
// 1. メッセージ：メッセージ一覧 ⇔ frontend/src/messages.js・処理側が返す番号
// ------------------------------------------------------------
{
  const problems = [];
  const doc = new Map();
  for (const l of lines('docs/01_要件定義/06_メッセージ一覧.md')) {
    const m = /^\|\s*([QINES]\d{2})\s*\|\s*(.+?)\s*\|/.exec(l);
    if (m) doc.set(m[1], m[2].replace(/<br>/g, ''));
  }
  const messages = await import(pathToFileURL(path.join(ROOT, 'frontend/src/messages.js')).href);
  const TEMPLATED = ['Q01', 'Q02', 'N05']; // 中身によって文章が変わるもの（関数で作る）
  for (const [code, text] of doc) {
    if (TEMPLATED.includes(code)) {
      if (typeof messages[code] !== 'function') problems.push(`${code} が messages.js にない`);
    } else if (messages.MSG[code] === undefined) {
      problems.push(`${code} が messages.js にない`);
    } else if (messages.MSG[code] !== text) {
      problems.push(`${code} の文章が違う（資料「${text}」・実装「${messages.MSG[code]}」）`);
    }
  }
  for (const code of Object.keys(messages.MSG)) if (!doc.has(code)) problems.push(`${code} が メッセージ一覧 にない`);
  // 処理側が返している番号が、メッセージ一覧にあるか
  const used = new Set();
  for (const f of readdirSync(path.join(ROOT, 'backend/src'), { recursive: true }).filter((f) => f.endsWith('.js'))) {
    for (const m of read(`backend/src/${f}`).matchAll(/'([IENS]\d{2})'/g)) used.add(m[1]);
  }
  for (const code of used) if (!doc.has(code)) problems.push(`処理側が返す ${code} が メッセージ一覧 にない`);
  add('メッセージ：メッセージ一覧 ⇔ messages.js・処理側', problems, `${doc.size} 個のメッセージ、処理側が返す番号 ${used.size} 個が一致`);
}

// ------------------------------------------------------------
// 2. API：API 設計書 ⇔ 処理側の受け口・画面側の呼び出し
// ------------------------------------------------------------
{
  const problems = [];
  const docApis = new Set();
  for (const l of lines('docs/02_設計/06_API設計書.md')) {
    const m = /^\|\s*API\d+\s*\|\s*`(GET|POST|PUT|DELETE)`\s*\|\s*`([^`]+)`/.exec(l);
    if (m) docApis.add(`${m[1]} ${m[2].split('?')[0].replace('{番号}', ':id')}`);
  }
  // 処理側：app.js の app.use('/api/…', 〇〇Router) と、routes の 〇〇Router.get('/…')
  const app = read('backend/src/app.js');
  const backend = new Set();
  for (const [, name, file] of app.matchAll(/import \{ (\w+) \} from '\.\/routes\/(\w+)\.js'/g)) {
    const prefix = new RegExp(`app\\.use\\('([^']+)',\\s*${name}\\)`).exec(app)?.[1];
    if (!prefix) { problems.push(`${name} が app.js で使われていない`); continue; }
    for (const [, method, sub] of read(`backend/src/routes/${file}.js`).matchAll(new RegExp(`${name}\\.(get|post|put|delete)\\('([^']*)'`, 'g'))) {
      backend.add(`${method.toUpperCase()} ${prefix}${sub === '/' ? '' : sub}`);
    }
  }
  for (const a of diff(docApis, backend)) problems.push(`API 設計書の「${a}」が処理側にない`);
  for (const a of diff(backend, docApis)) problems.push(`処理側の「${a}」が API 設計書にない`);
  // 画面側：api.js の request('GET', `/records/${id}`)（見張り用の API11 は画面側では使わない）
  const frontend = new Set();
  for (const [, method, p] of read('frontend/src/api.js').matchAll(/request\('(\w+)',\s*[`'](\/[^`'?]*)/g)) {
    frontend.add(`${method} /api${p.replace(/\$\{\w+\}/g, ':id')}`);
  }
  const docForFront = new Set([...docApis].filter((a) => a !== 'GET /api/health'));
  for (const a of diff(docForFront, frontend)) problems.push(`API 設計書の「${a}」を画面側が呼んでいない`);
  for (const a of diff(frontend, docApis)) problems.push(`画面側が呼ぶ「${a}」が API 設計書にない`);
  add('API：API 設計書 ⇔ 処理側の受け口・画面側の呼び出し', problems, `${docApis.size} 個の API が一致（画面側は見張り用を除く ${frontend.size} 個）`);
}

// ------------------------------------------------------------
// 3. 画面：画面一覧 ⇔ 画面のファイル（views）・router.js
// ------------------------------------------------------------
{
  const problems = [];
  const screens = [];
  for (const l of lines('docs/01_要件定義/05-0_画面一覧と共通ルール.md')) {
    const m = /^\|\s*(画面\d+)\s*\|\s*\[([^\]]+)\]/.exec(l);
    if (m) screens.push(`${m[1]} ${m[2]}`);
  }
  const router = read('frontend/src/router.js');
  const views = readdirSync(path.join(ROOT, 'frontend/src/views')).filter((f) => f.endsWith('.vue'));
  for (const s of screens) {
    const view = views.find((v) => read(`frontend/src/views/${v}`).split('\n').slice(0, 5).join('\n').includes(s));
    if (!view) problems.push(`「${s}」の画面のファイルがない`);
    else if (!router.includes(`./views/${view}`)) problems.push(`「${s}」（${view}）が router.js にない`);
  }
  add('画面：画面一覧 ⇔ 画面のファイル・router.js', problems, `${screens.length} 個の画面が一致`);
}

// ------------------------------------------------------------
// 4. テーブル：テーブル定義書 ⇔ database/sql/01_create_tables.sql
// ------------------------------------------------------------
{
  const problems = [];
  // 長い名前（DATETIME）を先に書く。先に DATE と書くと、DATETIME の先頭の「DATE」だけで一致してしまうため
  // 最後の (?![A-Z]) は「すぐあとに英字が続かない」という意味（\b だと VARCHAR(20) の「)」のあとで働かないため）
  const TYPE = /(INT UNSIGNED|VARCHAR\(\d+\)|DATETIME|DATE)(?![A-Z])/;
  const doc = {};
  let table = null;
  for (const l of lines('docs/02_設計/04_テーブル定義書.md')) {
    const h = /^## \d+\. (\w+)（/.exec(l);
    if (h) { table = h[1]; doc[table] = new Map(); continue; }
    if (/^## /.test(l)) table = null;
    const m = table && new RegExp(`^\\|[^|]+\\|\\s*(\\w+)\\s*\\|\\s*${TYPE.source}\\s*\\|`).exec(l);
    if (m) doc[table].set(m[1], m[2]);
  }
  const sql = {};
  for (const [, name, body] of read('database/sql/01_create_tables.sql').matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\n\)/g)) {
    sql[name] = new Map();
    for (const l of body.split('\n')) {
      const m = new RegExp(`^\\s+(\\w+)\\s+${TYPE.source}`).exec(l);
      if (m) sql[name].set(m[1], m[2]);
    }
  }
  for (const t of new Set([...Object.keys(doc), ...Object.keys(sql)])) {
    if (!doc[t]) { problems.push(`テーブル ${t} がテーブル定義書にない`); continue; }
    if (!sql[t]) { problems.push(`テーブル ${t} が SQL にない`); continue; }
    for (const [col, type] of doc[t]) {
      if (!sql[t].has(col)) problems.push(`${t}.${col} が SQL にない`);
      else if (sql[t].get(col) !== type) problems.push(`${t}.${col} の型が違う（資料 ${type}・SQL ${sql[t].get(col)}）`);
    }
    for (const col of sql[t].keys()) if (!doc[t].has(col)) problems.push(`${t}.${col} がテーブル定義書にない`);
  }
  const count = Object.values(sql).reduce((n, m) => n + m.size, 0);
  add('テーブル：テーブル定義書 ⇔ 01_create_tables.sql', problems, `${Object.keys(sql).length} 個のテーブル、${count} 個の項目が一致`);
}

// ------------------------------------------------------------
// 5. 版：開発環境と版の一覧 ⇔ package.json・compose.yaml・Node.js
// ------------------------------------------------------------
{
  const problems = [];
  const doc = lines('docs/03_手順書/00_開発環境と版の一覧.md');
  // 資料の中での部品の書き方（呼び名）
  const ALIAS = {
    express: 'Express', mysql2: 'mysql2', helmet: 'helmet', eslint: 'ESLint', '@eslint/js': '@eslint/js', globals: 'globals',
    vue: 'Vue.js', 'vue-router': 'Vue Router', vite: 'Vite', '@vitejs/plugin-vue': '@vitejs/plugin-vue',
    'eslint-plugin-vue': 'eslint-plugin-vue', 'vue-eslint-parser': 'vue-eslint-parser', minimatch: 'minimatch',
  };
  const written = (alias, version) => doc.some((l) => l.includes(alias) && l.includes(`**${version}**`));
  let count = 0;
  for (const dir of ['backend', 'frontend']) {
    const pkg = JSON.parse(read(`${dir}/package.json`));
    for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.overrides })) {
      count++;
      if (!/^\d+\.\d+\.\d+$/.test(version)) problems.push(`${dir} の ${name} の版が細かく固定されていない（${version}）`);
      if (!ALIAS[name]) problems.push(`${dir} の ${name} が 版の一覧 にない（この道具の ALIAS にも足す）`);
      else if (!written(ALIAS[name], version)) problems.push(`${dir} の ${name} ${version} が 版の一覧 と違う`);
    }
  }
  const image = /image:\s*mysql:(\S+)/.exec(read('database/compose.yaml'))?.[1];
  if (!written('MySQL', image)) problems.push(`MySQL ${image}（compose.yaml）が 版の一覧 と違う`);
  if (!written('Node.js', process.versions.node)) problems.push(`Node.js ${process.versions.node}（このパソコン）が 版の一覧 と違う`);
  add('版：開発環境と版の一覧 ⇔ package.json・compose.yaml・Node.js', problems, `部品 ${count} 個・MySQL ${image}・Node.js ${process.versions.node} が一致`);
}

// ------------------------------------------------------------
// 結果
// ------------------------------------------------------------
if (asJson) {
  process.stdout.write(JSON.stringify(results));
} else {
  for (const r of results) console.log(`${r.ok ? '✔ 合格  ' : '✖ 不合格'}  ${r.name}\n          ${r.detail}`);
}
process.exit(results.every((r) => r.ok) ? 0 : 1);
