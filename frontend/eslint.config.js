// ============================================================
// ESLint（LINT：プログラムの書き方のチェック）の設定　画面側（フロントエンド）
// 実行のしかた：frontend フォルダで「npm run lint」
// ============================================================

import js from '@eslint/js';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';

export default [
  // チェックしないもの（部品の置き場所・公開用に組み立てたファイル）
  { ignores: ['node_modules/', 'dist/'] },

  // ESLint がすすめる基本の決まり
  js.configs.recommended,

  // Vue.js の公式がすすめる決まり（.vue ファイルの書き方）
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.js', '**/*.vue'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser }, // ブラウザで使える名前（fetch・document など）
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
      curly: ['error', 'multi-line'],
      'prefer-template': 'error',
      // 全角の空白は、日本語の文章（文字の中・説明の中）では正しい使い方なので許す。プログラムの中に紛れ込んだものだけを見つける
      'no-irregular-whitespace': ['error', { skipStrings: true, skipComments: true, skipTemplates: true, skipRegExps: true }],
      // 1行に1つの要素を書く決まりは、短い要素が読みにくくなるので使わない
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': ['error', { html: { void: 'any', normal: 'never' } }],
    },
  },

  // 設定のファイル（vite.config.js など）は Node.js で動くので、Node.js の名前も使える
  {
    files: ['*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
