// ============================================================
// データベース（MySQL）とのつなぎ方
// 設定は .env ファイルから読み込む（パスワードをプログラムに書かないため）
// ============================================================

import mysql from 'mysql2/promise';

// 必要な設定がそろっているかを、起動するときに確かめる
const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`.env に次の設定がありません：${missing.join('、')}（backend/.env.example を見本にしてください）`);
}

// つなぎ口をいくつか用意しておき、使い回す仕組み（コネクションプール）
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4', // 日本語や絵文字を正しくやりとりする
  dateStrings: true, // 日付を「2026-11-02」の文字のまま受け取る（時差で日付がずれないようにする）
  connectionLimit: 10, // 同時に使うつなぎ口の数の上限
  waitForConnections: true, // つなぎ口が全部使われているときは、空くまで待つ
});
