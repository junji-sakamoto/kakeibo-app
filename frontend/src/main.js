// ============================================================
// 画面側（フロントエンド）の入口
// ============================================================

import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router.js';
import './style.css';

createApp(App).use(router).mount('#app');
