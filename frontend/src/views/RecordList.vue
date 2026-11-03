<!--
  画面1 記録一覧画面
  docs/01_要件定義/05-1_記録一覧画面.md
  表示する月は、アドレスの ?month=2026-11 で決める（ないときは今月）
-->
<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { MSG, Q01, textOf } from '../messages.js';
import { showToast, askConfirm } from '../store.js';
import { thisMonth, addMonth, formatMonth, formatListDate, formatShortDate, formatYen, isValidMonth } from '../format.js';

const route = useRoute();
const router = useRouter();

const TYPE_LABEL = { income: '収入', expense: '支出' };

// 表示中の月（アドレスに正しい年月がなければ今月）
const month = computed(() => (isValidMonth(route.query.month) ? route.query.month : thisMonth()));

const loading = ref(true);
const records = ref([]);
const totals = ref({ income: 0, expense: 0, balance: 0 });

// 記録の一覧と合計を読み込む（API1）
async function load() {
  loading.value = true;
  const r = await api.getRecords(month.value);
  loading.value = false;
  if (!r.ok) {
    showToast(textOf(r.message), 'error');
    records.value = [];
    totals.value = { income: 0, expense: 0, balance: 0 };
    return;
  }
  records.value = r.data.records;
  totals.value = r.data.totals;
}

// 表示する月が変わったら、読み込み直す（最初に開いたときも）
watch(month, load, { immediate: true });

// 月の切り替え
const goMonth = (m) => router.push({ path: '/records', query: { month: m } });

// 削除（確認の窓 Q01 → API5）
async function remove(r) {
  const detail = `${formatShortDate(r.date)}　${TYPE_LABEL[r.type]}　${r.categoryName}　${formatYen(r.amount)}`;
  if (!(await askConfirm(Q01(detail)))) return;
  const res = await api.deleteRecord(r.id);
  if (res.ok) showToast(MSG.I03);
  else showToast(textOf(res.message), 'error'); // すでに削除されていた（S02）など
  await load();
}
</script>

<template>
  <div class="month-nav">
    <button type="button" class="btn" @click="goMonth(addMonth(month, -1))">◀ 前の月</button>
    <span class="month-label">{{ formatMonth(month) }}</span>
    <button type="button" class="btn" @click="goMonth(addMonth(month, 1))">次の月 ▶</button>
    <button type="button" class="btn" @click="goMonth(thisMonth())">今月</button>
  </div>

  <div class="summary">
    <div class="summary-card income"><div class="label">収入</div><div class="value">{{ formatYen(totals.income) }}</div></div>
    <div class="summary-card expense"><div class="label">支出</div><div class="value">{{ formatYen(totals.expense) }}</div></div>
    <div class="summary-card"><div class="label">差額</div><div class="value" :class="{ 'is-minus': totals.balance < 0 }">{{ formatYen(totals.balance) }}</div></div>
  </div>

  <div class="page-head">
    <h1 class="page-title">記録</h1>
    <RouterLink class="btn btn-primary" :to="{ path: '/records/new', query: { month } }">＋ 登録</RouterLink>
  </div>

  <div class="list">
    <p v-if="loading" class="empty">{{ MSG.N04 }}</p>
    <p v-else-if="records.length === 0" class="empty">{{ MSG.N01 }}</p>
    <template v-else>
      <div class="list-row list-head"><span>日付</span><span>種類</span><span>カテゴリ</span><span class="amount">金額</span><span>メモ</span><span></span></div>
      <div v-for="r in records" :key="r.id" class="list-row">
        <span class="date">{{ formatListDate(r.date) }}</span>
        <span class="type"><span class="badge" :class="r.type">{{ TYPE_LABEL[r.type] }}</span></span>
        <span class="category">{{ r.categoryName }}</span>
        <span class="amount">{{ formatYen(r.amount) }}</span>
        <span class="memo" :title="r.memo">{{ r.memo }}</span>
        <span class="actions">
          <RouterLink class="btn btn-small" :to="{ path: `/records/${r.id}/edit`, query: { month } }">修正</RouterLink>
          <button type="button" class="btn btn-small btn-danger" @click="remove(r)">削除</button>
        </span>
      </div>
    </template>
  </div>
</template>
