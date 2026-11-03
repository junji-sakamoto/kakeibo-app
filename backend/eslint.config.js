// ============================================================
// ESLint（LINT：プログラムの書き方のチェック）の設定　処理側（バックエンド）
// 実行のしかた：backend フォルダで「npm run lint」
// ============================================================

import js from '@eslint/js';
import globals from 'globals';

export default [
  // チェックしないもの（部品の置き場所）
  { ignores: ['node_modules/'] },

  // ESLint がすすめる基本の決まり（間違いになりやすい書き方を見つける）
  js.configs.recommended,

  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node }, // Node.js で使える名前（process など）
    },
    rules: {
      // 使っていない変数は間違いのもと。ただし「_」で始まる名前は、わざと使っていないものとして許す
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // 「==」ではなく「===」を使う（思わぬ型の変換で、間違った比べ方になるのを防ぐ）
      eqeqeq: ['error', 'always'],
      // 書き換えない変数は const にする
      'prefer-const': 'error',
      // 古い書き方 var を使わない
      'no-var': 'error',
      // if などの { } を省かない（あとから行を足したときの間違いを防ぐ）
      curly: ['error', 'multi-line'],
      // 文字の中に変数を入れるときは、+ でつなげず `${ }` を使う
      'prefer-template': 'error',
      // 全角の空白は、日本語の文章（文字の中・説明の中）では正しい使い方なので許す。プログラムの中に紛れ込んだものだけを見つける
      'no-irregular-whitespace': ['error', { skipStrings: true, skipComments: true, skipTemplates: true, skipRegExps: true }],
    },
  },
];
