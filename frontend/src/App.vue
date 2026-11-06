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
// 今開いているのが「カテゴリの設定」「年間の集計」のまとまりか（メニューを目立たせるため）
const isCategory = computed(() => route.path.startsWith('/categories'));
const isYearly = computed(() => route.path.startsWith('/yearly'));
</script>

<template>
  <header class="header">
    <!-- 「家計簿」「月ごとの記録」は今月の記録一覧へ（遷移15・16）、「年間の集計」は今年の年間集計へ（遷移21） -->
    <!-- メニューの名前は、初めて見る人にも、押すと何ができるかが分かるようにする（2026年11月6日） -->
    <RouterLink class="header-title" to="/records">家計簿</RouterLink>
    <nav class="header-nav">
      <RouterLink to="/records" :class="{ 'is-active': !isCategory && !isYearly }">月ごとの記録</RouterLink>
      <RouterLink to="/yearly" :class="{ 'is-active': isYearly }">年間の集計</RouterLink>
      <RouterLink to="/categories" :class="{ 'is-active': isCategory }">カテゴリの設定</RouterLink>
    </nav>
  </header>

  <div v-if="toast.visible" class="toast" :class="toast.kind" role="status" aria-live="polite">{{ toast.text }}</div>

  <main class="main">
    <RouterView />
  </main>

  <ConfirmDialog />
</template>
