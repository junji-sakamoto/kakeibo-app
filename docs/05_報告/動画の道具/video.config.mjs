// ============================================================
// 講師に見せる動画を、自動で撮るための設定（Playwright）
//
// 撮り方（frontend フォルダで実行する。先にデータベースを起動し、お試しデータを最初の状態に戻しておく）：
//   npx playwright test --config ../docs/05_報告/動画の道具/video.config.mjs
//   本番のアドレスで撮るとき：$env:APP_URL = "https://（CloudFront のアドレス）/" を指定してから実行する
//
// ・撮った動画は、このフォルダの out/ に WebM でできる（GitHub には上げない）
// ・MP4 にするとき（ffmpeg を winget で入れておく）：
//   ffmpeg -i video.webm -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart -an 名前.mp4
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
  },
  expect: { timeout: 10000 },
  // 自分のパソコンで撮るときは、処理側と画面側を起動する（本番のアドレスで撮るときは使わない）
  webServer: process.env.APP_URL ? undefined : [
    { command: 'npm start', cwd: path.join(ROOT, 'backend'), url: 'http://127.0.0.1:3000/api/health', reuseExistingServer: true, timeout: 30000 },
    { command: 'npm run dev', cwd: path.join(ROOT, 'frontend'), url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 30000 },
  ],
});
