<!--
  すべての画面に共通する部分
  ・画面の上の部分（ヘッダー）
  ・完了・エラーのお知らせ
  ・削除の確認の窓
  真ん中の <RouterView> に、アドレスに合った画面が入る
-->
<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { toast } from './store.js';
import ConfirmDialog from './components/ConfirmDialog.vue';

const route = useRoute();
// 今開いているのが「カテゴリ」のまとまりか（メニューを目立たせるため）
const isCategory = computed(() => route.path.startsWith('/categories'));
</script>

<template>
  <header class="header">
    <!-- 「家計簿」「記録」は今月の記録一覧へ（遷移15・16） -->
    <RouterLink class="header-title" to="/records">家計簿</RouterLink>
    <nav class="header-nav">
      <RouterLink to="/records" :class="{ 'is-active': !isCategory }">記録</RouterLink>
      <RouterLink to="/categories" :class="{ 'is-active': isCategory }">カテゴリ</RouterLink>
    </nav>
  </header>

  <div v-if="toast.visible" class="toast" :class="toast.kind" role="status" aria-live="polite">{{ toast.text }}</div>

  <main class="main">
    <RouterView />
  </main>

  <ConfirmDialog />
</template>
