<!--
  画面3 カテゴリ一覧画面
  docs/01_要件定義/05-3_カテゴリ一覧画面.md
-->
<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../api.js';
import { MSG, Q02, textOf } from '../messages.js';
import { showToast, askConfirm } from '../store.js';

const loading = ref(true);
const loadError = ref(''); // 読み込めなかったときのメッセージの番号（S01 など）
const categories = ref([]);

// 支出用・収入用の順に表示する（それぞれの並び順は、処理側から届いた順：「その他」は一番下）
const sections = computed(() => [
  { type: 'expense', title: '支出用', list: categories.value.filter((c) => c.type === 'expense') },
  { type: 'income', title: '収入用', list: categories.value.filter((c) => c.type === 'income') },
]);

// カテゴリの一覧を読み込む（API6）
async function load() {
  loadError.value = '';
  const r = await api.getCategories();
  loading.value = false;
  if (!r.ok) {
    // 「カテゴリがない」のではなく「読み込めなかった」ので、「カテゴリがありません。」とは表示しない
    showToast(textOf(r.message), 'error');
    loadError.value = r.message;
    return;
  }
  categories.value = r.data.categories;
}

async function reload() {
  loading.value = true;
  await load();
}
onMounted(load);

// 削除（確認の窓 Q02 → API10）
async function remove(c) {
  if (!(await askConfirm(Q02(c.name)))) return;
  const r = await api.deleteCategory(c.id);
  if (r.ok) {
    showToast(MSG.I06);
    await load();
    return;
  }
  // 記録で使われている（E12）は削除されないので、一覧はそのまま。すでに削除されていた（S02）ときは読み込み直す
  showToast(textOf(r.message), 'error');
  if (r.status === 404) await load();
}
</script>

<template>
  <div class="page-head">
    <h1 class="page-title">カテゴリ</h1>
    <RouterLink class="btn btn-primary" to="/categories/new">＋ 登録</RouterLink>
  </div>

  <div v-if="loading" class="list"><p class="empty">{{ MSG.N04 }}</p></div>

  <div v-else-if="loadError" class="list">
    <div class="empty">
      <p class="load-error">{{ textOf(loadError) }}</p>
      <button type="button" class="btn" @click="reload">読み込み直す</button>
    </div>
  </div>

  <template v-else>
    <section v-for="s in sections" :key="s.type" class="category-section">
      <h2>■ {{ s.title }}</h2>
      <div class="list">
        <p v-if="s.list.length === 0" class="empty">{{ MSG.N03 }}</p>
        <div v-for="c in s.list" :key="c.id" class="category-row">
          <span>{{ c.name }}</span>
          <span class="actions">
            <RouterLink class="btn btn-small" :to="`/categories/${c.id}/edit`">修正</RouterLink>
            <button type="button" class="btn btn-small btn-danger" @click="remove(c)">削除</button>
          </span>
        </div>
      </div>
    </section>
  </template>
</template>
