// ============================================================
// 処理側（バックエンド）の「ビルド確認」
// Node.js には Java のようなビルド（コンパイル）がないので、次の3つで「組み立てられるか」を確かめる
//   ① すべての .js ファイルの書き方（文法）が正しいか（node --check）
//   ② プログラムとして読み込めるか（足りない部品や、つながっていないファイルがないか）
//   ③ 実際に起動して、API11（GET /api/health）が 200 を返すか（データベースが必要）
//
// 実行のしかた：backend フォルダで「npm run build」
// ============================================================

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = false;

// ① 書き方（文法）
const jsFiles = (dir) => readdirSync(dir).flatMap((name) => {
  const p = path.join(dir, name);
  return statSync(p).isDirectory() ? jsFiles(p) : name.endsWith('.js') || name.endsWith('.mjs') ? [p] : [];
});
const files = ['src', 'tests', 'scripts'].flatMap((d) => jsFiles(path.join(ROOT, d)));
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) {
    failed = true;
    console.error(`✖ 書き方の間違い：${path.relative(ROOT, file)}\n${r.stderr}`);
  }
}
console.log(`① 書き方（文法）：${files.length} 個のファイルを確かめました`);

// ② 読み込めるか・③ 起動できるか
try {
  const { createApp } = await import(pathToFileURL(path.join(ROOT, 'src', 'app.js')).href);
  const { pool } = await import(pathToFileURL(path.join(ROOT, 'src', 'db.js')).href);
  console.log('② プログラムとして読み込めました');

  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
  if (res.status === 200) {
    console.log('③ 起動して、GET /api/health が 200 を返しました');
  } else {
    failed = true;
    console.error(`✖ ③ GET /api/health が ${res.status} を返しました（データベースが起動しているか確かめてください）`);
  }
  server.close();
  await pool.end();
} catch (err) {
  failed = true;
  console.error(`✖ ②③ 読み込み・起動できませんでした：${err.message}`);
}

console.log(failed ? 'ビルド確認：不合格' : 'ビルド確認：合格');
process.exit(failed ? 1 : 0);
