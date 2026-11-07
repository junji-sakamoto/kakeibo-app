<!--
  画面2 記録入力画面（登録・修正）
  docs/01_要件定義/05-2_記録入力画面.md
  ・登録：/records/new
  ・修正：/records/{番号}/edit
  ・アドレスの ?month= は、「戻る」で戻る月
-->
<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import { MSG, textOf } from '../messages.js';
import { showToast } from '../store.js';
import { today, thisMonth, isValidDate, isValidMonth, charLength } from '../format.js';

const props = defineProps({ id: { type: String, default: null } });
const route = useRoute();
const router = useRouter();

const isEdit = computed(() => props.id !== null);
const backMonth = computed(() => (isValidMonth(route.query.month) ? route.query.month : thisMonth()));
const backTo = computed(() => ({ path: '/records', query: { month: backMonth.value } }));

const loading = ref(true);
const saving = ref(false); // 保存の途中は、ボタンを押せなくする（二重の登録を防ぐ）
const loadError = ref(''); // カテゴリを読み込めなかったときのメッセージの番号（S01 など）
const categories = ref([]);

// 入力の値（登録のときの最初の値：今日・支出・未選択）
const form = reactive({ date: today(), type: 'expense', categoryId: '', amount: '', memo: '' });
// 項目ごとのエラーの番号
const errors = reactive({ date: '', category: '', amount: '', memo: '' });

// 選んだ種類のカテゴリだけ（並び順は処理側から届いた順：「その他」は一番下）
const options = computed(() => categories.value.filter((c) => c.type === form.type));

// 収入用の「繰越金」を選んでいるか（選んでいるときは N06 の注意書きを出す。毎月入れて二重に数えないため）
const isCarryoverCategory = computed(() => options.value.some((c) => String(c.id) === form.categoryId && c.type === 'income' && c.name === '繰越金'));

// 種類を切り替えたら、カテゴリは「未選択」に戻す
const onTypeChange = () => { form.categoryId = ''; };

onMounted(async () => {
  const c = await api.getCategories(); // API6
  if (!c.ok) {
    // 「カテゴリがない（N02）」のではなく「読み込めなかった」ので、入力欄は出さずに知らせる
    showToast(textOf(c.message), 'error');
    loadError.value = c.message;
    loading.value = false;
    return;
  }
  categories.value = c.data.categories;

  if (isEdit.value) {
    const r = await api.getRecord(props.id); // API2
    if (!r.ok) {
      // 修正しようとした記録が、すでに削除されていた（S02）など
      showToast(textOf(r.message), 'error');
      router.push(backTo.value);
      return;
    }
    Object.assign(form, {
      date: r.data.date, type: r.data.type, categoryId: String(r.data.categoryId),
      amount: String(r.data.amount), memo: r.data.memo,
    });
  }
  loading.value = false;
});

// 入力をチェックする（処理側でも、もう一度チェックする）
function check() {
  Object.assign(errors, { date: '', category: '', amount: '', memo: '' });
  const amount = String(form.amount).trim();
  if (form.date === '') errors.date = 'E01';
  else if (!isValidDate(form.date)) errors.date = 'E02';
  if (form.categoryId === '') errors.category = 'E04';
  if (amount === '') errors.amount = 'E05';
  else if (!/^\d+$/.test(amount) || Number(amount) < 1) errors.amount = 'E06';
  else if (Number(amount) > 9999999) errors.amount = 'E07';
  if (charLength(form.memo.trim()) > 100) errors.memo = 'E08';
  return Object.values(errors).every((e) => e === '');
}

async function save() {
  if (!check()) return;
  saving.value = true;
  const body = { date: form.date, categoryId: Number(form.categoryId), amount: Number(String(form.amount).trim()), memo: form.memo };
  const r = isEdit.value ? await api.updateRecord(props.id, body) : await api.createRecord(body); // API4 / API3
  saving.value = false;

  if (r.ok) {
    showToast(isEdit.value ? MSG.I02 : MSG.I01);
    router.push({ path: '/records', query: { month: form.date.slice(0, 7) } }); // 保存した記録の月を表示する
    return;
  }
  if (r.status === 400 && r.data?.errors) {
    // 処理側で見つかった間違い（項目の名前を、この画面の項目に合わせる）
    const e = r.data.errors;
    Object.assign(errors, { date: e.date || '', category: e.categoryId || '', amount: e.amount || '', memo: e.memo || '' });
    return;
  }
  showToast(textOf(r.message), 'error');
  if (r.status === 404) router.push(backTo.value); // 修正しようとした記録が、すでに削除されていた（S02）
}
</script>

<template>
  <h1 class="page-title">{{ isEdit ? '記録の修正' : '記録の登録' }}</h1>

  <div v-if="loading" class="list"><p class="empty">{{ MSG.N04 }}</p></div>

  <div v-else-if="loadError" class="list">
    <div class="empty">
      <p class="load-error">{{ textOf(loadError) }}</p>
      <RouterLink class="btn" :to="backTo">戻る</RouterLink>
    </div>
  </div>

  <form v-else class="form" novalidate @submit.prevent="save">
    <div class="field" :class="{ 'has-error': errors.date }">
      <label class="field-label" for="f-date">日付<span class="required">＊</span></label>
      <input id="f-date" v-model="form.date" type="date" :aria-invalid="errors.date ? 'true' : null" aria-describedby="err-date">
      <p id="err-date" class="field-error">{{ errors.date && textOf(errors.date) }}</p>
    </div>

    <div class="field">
      <span class="field-label">種類<span class="required">＊</span></span>
      <div class="radio-group">
        <label><input v-model="form.type" type="radio" name="type" value="expense" @change="onTypeChange"> 支出</label>
        <label><input v-model="form.type" type="radio" name="type" value="income" @change="onTypeChange"> 収入</label>
      </div>
    </div>

    <div class="field" :class="{ 'has-error': errors.category }">
      <label class="field-label" for="f-category">カテゴリ<span class="required">＊</span></label>
      <template v-if="options.length > 0">
        <select id="f-category" v-model="form.categoryId" :aria-invalid="errors.category ? 'true' : null" aria-describedby="err-category">
          <option value="">選んでください</option>
          <option v-for="c in options" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
        </select>
        <!-- 間違いではなく案内なので、N05 と同じ「お知らせ」の見た目にする -->
        <p v-if="isCarryoverCategory" class="info">{{ MSG.N06 }}</p>
      </template>
      <template v-else>
        <!-- 選んだ種類のカテゴリが1つもない（N02）→ 保存できないようにする -->
        <select id="f-category" disabled><option>－</option></select>
        <p class="notice">{{ MSG.N02 }}</p>
      </template>
      <p id="err-category" class="field-error">{{ errors.category && textOf(errors.category) }}</p>
    </div>

    <div class="field" :class="{ 'has-error': errors.amount }">
      <label class="field-label" for="f-amount">金額<span class="required">＊</span></label>
      <div class="amount-input"><input id="f-amount" v-model="form.amount" type="text" inputmode="numeric" :aria-invalid="errors.amount ? 'true' : null" aria-describedby="err-amount"> 円</div>
      <p id="err-amount" class="field-error">{{ errors.amount && textOf(errors.amount) }}</p>
    </div>

    <div class="field" :class="{ 'has-error': errors.memo }">
      <label class="field-label" for="f-memo">メモ</label>
      <input id="f-memo" v-model="form.memo" type="text" :aria-invalid="errors.memo ? 'true' : null" aria-describedby="err-memo">
      <span class="hint">（100文字まで）</span>
      <p id="err-memo" class="field-error">{{ errors.memo && textOf(errors.memo) }}</p>
    </div>

    <div class="form-buttons">
      <button type="submit" class="btn btn-primary" :disabled="saving || options.length === 0">{{ isEdit ? '更新する' : '保存する' }}</button>
      <RouterLink class="btn" :to="backTo">戻る</RouterLink>
    </div>
    <p class="form-note">＊は必須の項目です</p>
  </form>
</template>
