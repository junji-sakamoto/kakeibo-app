<!--
  画面5 年間集計画面
  docs/01_要件定義/05-5_年間集計画面.md
  表示する年は、アドレスの ?year=2026 で決める（ないときは今年）
-->
<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { MSG, textOf } from '../messages.js';
import { showToast } from '../store.js';
import { thisYear, isValidYear, formatYen, formatMonthOnly, MIN_YEAR, MAX_YEAR } from '../format.js';

const route = useRoute();
const router = useRouter();

// 表示中の年（アドレスに正しい年がなければ今年）
const year = computed(() => (isValidYear(route.query.year) ? route.query.year : thisYear()));

const loading = ref(true);
const loadError = ref(''); // 読み込めなかったときのメッセージの番号（S01 など）
const totals = ref(null); // 読み込めなかったときは null（「0円」と表示しないため）
const months = ref([]);

// 年の合計と、月ごとの合計を読み込む（API12）
async function load() {
  loading.value = true;
  loadError.value = '';
  const r = await api.getYearSummary(year.value);
  loading.value = false;
  if (!r.ok) {
    // 「記録がない」のではなく「読み込めなかった」ので、0円とは表示しない
    showToast(textOf(r.message), 'error');
    loadError.value = r.message;
    totals.value = null;
    months.value = [];
    return;
  }
  totals.value = r.data.totals;
  months.value = r.data.months;
}

// 合計の表示（読み込めなかったときは「－」）
const show = (n) => (totals.value === null ? '－' : formatYen(n));

// 表示する年が変わったら、読み込み直す（最初に開いたときも）
watch(year, load, { immediate: true });

// 年の切り替え（2000年より前・2099年より後には進めない）
const goYear = (y) => router.push({ path: '/yearly', query: { year: String(y) } });
const canPrev = computed(() => Number(year.value) > MIN_YEAR);
const canNext = computed(() => Number(year.value) < MAX_YEAR);
</script>

<template>
  <div class="month-nav">
    <button type="button" class="btn" :disabled="!canPrev" @click="goYear(Number(year) - 1)">◀ 前の年</button>
    <span class="month-label">{{ year }}年</span>
    <button type="button" class="btn" :disabled="!canNext" @click="goYear(Number(year) + 1)">次の年 ▶</button>
    <button type="button" class="btn" @click="goYear(thisYear())">今年</button>
  </div>

  <div class="summary">
    <div class="summary-card income"><div class="label">収入</div><div class="value">{{ show(totals?.income) }}</div></div>
    <div class="summary-card expense"><div class="label">支出</div><div class="value">{{ show(totals?.expense) }}</div></div>
    <div class="summary-card"><div class="label">差額</div><div class="value" :class="{ 'is-minus': totals?.balance < 0 }">{{ show(totals?.balance) }}</div></div>
  </div>

  <div class="page-head">
    <h1 class="page-title">年間</h1>
  </div>

  <div class="list">
    <p v-if="loading" class="empty">{{ MSG.N04 }}</p>
    <div v-else-if="loadError" class="empty">
      <p class="load-error">{{ textOf(loadError) }}</p>
      <button type="button" class="btn" @click="load">読み込み直す</button>
    </div>
    <template v-else>
      <div class="year-row list-head"><span>月</span><span class="amount">収入</span><span class="amount">支出</span><span class="amount">差額</span></div>
      <div v-for="m in months" :key="m.month" class="year-row">
        <!-- 月を押すと、その月の記録一覧へ（遷移22） -->
        <span class="month"><RouterLink :to="{ path: '/records', query: { month: m.month } }">{{ formatMonthOnly(m.month) }}</RouterLink></span>
        <span class="amount income"><span class="cell-label">収入</span>{{ formatYen(m.income) }}</span>
        <span class="amount expense"><span class="cell-label">支出</span>{{ formatYen(m.expense) }}</span>
        <span class="amount balance" :class="{ 'is-minus': m.balance < 0 }"><span class="cell-label">差額</span>{{ formatYen(m.balance) }}</span>
      </div>
    </template>
  </div>
</template>
