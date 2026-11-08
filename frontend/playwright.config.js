// ============================================================
// Playwright（画面を操作する E2E 試験の道具）の設定
// 実行のしかた：frontend フォルダで「npm run test:e2e」（先にデータベースを起動しておく）
// 処理側（3000番）と画面側（5173番）は、動いていなければ自動で起動し、終わったら止める
// ============================================================

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // 試験は1つずつ順番に行う（同じデータを使うので、同時に行うと結果が混ざるため）
  workers: 1,
  fullyParallel: false,
  // 結果の表示：画面には一覧、くわしい結果は e2e-report フォルダに HTML で残す
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure', // 失敗したときは、操作の記録を残す
    screenshot: 'only-on-failure', // 失敗したときは、画面の写真を残す
  },
  // 非機能要件「使える環境」：パソコンの Microsoft Edge と Google Chrome の両方で、同じ試験を行う
  projects: [
    { name: 'Edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'Chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
  webServer: [
    { command: 'npm start', cwd: '../backend', url: 'http://127.0.0.1:3000/api/health', reuseExistingServer: true, timeout: 30000 },
    { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 30000 },
  ],
});
