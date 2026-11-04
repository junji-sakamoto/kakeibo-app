// ============================================================
// 本番のデータベース（RDS）の準備をする道具
// EC2 の中で、deploy.ps1（infra/deploy.ps1）から動かす。手で動かすことはふつうない
//
// 使い方：
//   node scripts/setup-db.mjs           … アプリ用の利用者を作り（パスワードをそろえ）、
//                                          テーブルがなければ、テーブルとお試しデータを作る
//   node scripts/setup-db.mjs --reset   … お試しデータを最初の状態に戻す（非機能要件 3-2）
//
// 使う設定（環境変数）：
//   DB_HOST・DB_PORT・DB_NAME          … つなぎ先（EC2 の /etc/kakeibo/backend.env）
//   DB_USER                            … アプリ用の利用者の名前（kakeibo_app）
//   DB_ADMIN_USER・DB_ADMIN_PASSWORD   … 管理者（パソコンから SSH で渡す。ファイルには残さない）
//   DB_APP_PASSWORD                    … アプリ用のパスワード（同じく SSH で渡す）
// SQL のファイルは、database/sql と database/reset のものを、そのまま使う
// ============================================================

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_ADMIN_USER', 'DB_ADMIN_PASSWORD', 'DB_APP_PASSWORD'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`次の設定がありません：${missing.join('、')}`);
  process.exit(1);
}

const reset = process.argv.includes('--reset');
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
// EC2 では /opt/kakeibo/backend/scripts → /opt/kakeibo/database、
// 自分のパソコンでは backend/scripts → database を指す
const databaseDir = path.resolve(scriptDir, '..', '..', 'database');

const createFiles = ['sql/01_create_tables.sql', 'sql/02_insert_categories.sql', 'sql/03_insert_sample_records.sql'];
const resetFiles = ['reset/reset_data.sql', 'sql/02_insert_categories.sql', 'sql/03_insert_sample_records.sql'];

// SQL のファイルを読んで、そのまま流す（ファイルの中に複数の文があるため multipleStatements を使う）
async function runFiles(conn, files) {
  for (const file of files) {
    const sql = await readFile(path.join(databaseDir, file), 'utf8');
    await conn.query(sql);
    console.log(`  実行しました：database/${file}`);
  }
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_ADMIN_USER,
  password: process.env.DB_ADMIN_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  multipleStatements: true, // この道具だけで使う（処理側の db.js では使わない）
});

try {
  if (reset) {
    console.log('お試しデータを最初の状態に戻します');
    await runFiles(conn, resetFiles);
  } else {
    // 1. アプリ用の利用者を作る。すでにあれば、パスワードを SSM パラメータストアのものにそろえる
    const appUser = process.env.DB_USER;
    const appPassword = process.env.DB_APP_PASSWORD;
    await conn.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [appUser, '%', appPassword]);
    await conn.query('ALTER USER ?@? IDENTIFIED BY ?', [appUser, '%', appPassword]);
    // できることは、記録とカテゴリの読み書きだけ（テーブルを作ったり消したりはできない）
    await conn.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${conn.escapeId(process.env.DB_NAME)}.* TO ?@?`, [appUser, '%']);
    console.log(`アプリ用の利用者 ${appUser} を用意しました`);

    // 2. テーブルがまだなければ、テーブルとお試しデータを作る
    const [rows] = await conn.query(
      'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
      [process.env.DB_NAME, 'categories'],
    );
    if (rows[0].n === 0) {
      console.log('テーブルとお試しデータを作ります');
      await runFiles(conn, createFiles);
    } else {
      console.log('テーブルはもうあるので、作りませんでした（データはそのまま）');
    }
  }
  console.log('終わりました');
} finally {
  await conn.end();
}
