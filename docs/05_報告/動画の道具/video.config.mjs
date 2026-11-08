// ============================================================
// 講師に見せる動画を、自動で撮るための設定（Playwright）
//
// 撮り方（frontend フォルダで実行する。先にデータベースを起動し、お試しデータを最初の状態に戻しておく）：
//   npx playwright test --config ../docs/05_報告/動画の道具/video.config.mjs
//   本番のアドレスで撮るとき：$env:APP_URL = "https://（CloudFront のアドレス）/" を指定してから実行する
//
//   1つの章だけ撮るとき：最後に ch2 のように章の番号を付ける
//   第6章を撮る前に、品質チェックの結果を保存しておく（ch6.spec.mjs の先頭を参照）
//
// ・撮った動画は、このフォルダの out/ に WebM でできる（GitHub には上げない）
// ・MP4 にするとき（ffmpeg を winget で入れておく）：このフォルダの make-mp4.ps1 を実行する
//   （章ごとに「第2章_月ごとの記録.mp4」のような名前で、ビデオのフォルダの「家計簿の動画」に置く）
// ・画面は 1280×900。下に字幕の場所をとるため、ふつうより縦に長くしている
// ============================================================

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from './pw.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export default defineConfig({
  testDir: '.', testMatch: /ch\d+\.spec\.mjs/, outputDir: './out', workers: 1, retries: 0, reporter: 'list',
  timeout: 8 * 60 * 1000,
  use: {
    ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1,
    video: { mode: 'on', size: { width: 1280, height: 900 } }, locale: 'ja-JP', timezoneId: 'Asia/Tokyo',
    actionTimeout: 15000,
    bypassCSP: true, // GitHub の画面にも字幕を出すため（GitHub は、ページにあとから見た目を足すことを止めている）
  },
  expect: { timeout: 10000 },
  // 自分のパソコンで撮るときは、処理側と画面側を起動する（本番のアドレスで撮るときは使わない）
  webServer: process.env.APP_URL ? undefined : [
    { command: 'npm start', cwd: path.join(ROOT, 'backend'), url: 'http://127.0.0.1:3000/api/health', reuseExistingServer: true, timeout: 30000 },
    { command: 'npm run dev', cwd: path.join(ROOT, 'frontend'), url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 30000 },
  ],
});
