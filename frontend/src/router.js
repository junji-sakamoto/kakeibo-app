// ============================================================
// 画面の切り替え（どのアドレスで、どの画面を出すか）
// 画面のつながりは docs/02_設計/02_画面遷移図.md を参照
// ============================================================

import { createRouter, createWebHistory } from 'vue-router';
import RecordList from './views/RecordList.vue';
import RecordForm from './views/RecordForm.vue';
import CategoryList from './views/CategoryList.vue';
import CategoryForm from './views/CategoryForm.vue';
import YearSummary from './views/YearSummary.vue';
import NotFound from './views/NotFound.vue';
import { clearOldToast } from './store.js';

// 番号（:id）は、1以上の整数だけを受け付ける。それ以外は「ページが見つかりません」
const ID = ':id(\\d+)';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/records' },
    { path: '/records', component: RecordList }, // 画面1（?month=2026-11 で月を選ぶ）
    { path: '/records/new', component: RecordForm }, // 画面2（登録）
    { path: `/records/${ID}/edit`, component: RecordForm, props: true }, // 画面2（修正）
    { path: '/categories', component: CategoryList }, // 画面3
    { path: '/categories/new', component: CategoryForm }, // 画面4（登録）
    { path: `/categories/${ID}/edit`, component: CategoryForm, props: true }, // 画面4（修正）
    { path: '/yearly', component: YearSummary }, // 画面5（?year=2026 で年を選ぶ）
    { path: '/:pathMatch(.*)*', component: NotFound }, // 存在しないページ（S03）
  ],
  // 画面を切り替えたら、一番上から表示する
  scrollBehavior: () => ({ top: 0 }),
});

router.afterEach(() => clearOldToast());
