<!--
  画面4 カテゴリ入力画面（登録・修正）
  docs/01_要件定義/05-4_カテゴリ入力画面.md
  ・登録：/categories/new
  ・修正：/categories/{番号}/edit（種類は変えられない。使われている件数を知らせる：N05）
-->
<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api.js';
import { MSG, N05, textOf } from '../messages.js';
import { showToast } from '../store.js';
import { charLength } from '../format.js';

const props = defineProps({ id: { type: String, default: null } });
const router = useRouter();

const isEdit = computed(() => props.id !== null);
const loading = ref(isEdit.value);
const saving = ref(false);
const recordCount = ref(0);

const form = reactive({ type: 'expense', name: '' });
const errors = reactive({ type: '', name: '' });

onMounted(async () => {
  if (!isEdit.value) return;
  const r = await api.getCategory(props.id); // API7
  if (!r.ok) {
    showToast(textOf(r.message), 'error'); // すでに削除されていた（S02）など
    router.push('/categories');
    return;
  }
  Object.assign(form, { type: r.data.type, name: r.data.name });
  recordCount.value = r.data.recordCount;
  loading.value = false;
});

function check() {
  Object.assign(errors, { type: '', name: '' });
  const name = form.name.trim();
  if (!['income', 'expense'].includes(form.type)) errors.type = 'E03';
  if (name === '') errors.name = 'E09';
  else if (charLength(name) > 20) errors.name = 'E10';
  return !errors.type && !errors.name;
}

async function save() {
  if (!check()) return;
  saving.value = true;
  const r = isEdit.value
    ? await api.updateCategory(props.id, { name: form.name }) // API9（送るのは名前だけ）
    : await api.createCategory({ type: form.type, name: form.name }); // API8
  saving.value = false;

  if (r.ok) {
    showToast(isEdit.value ? MSG.I05 : MSG.I04);
    router.push('/categories');
    return;
  }
  if ((r.status === 400 || r.status === 409) && r.data?.errors) {
    // 入力の間違い（E03・E09・E10）や、同じ名前のカテゴリがある（E11）
    Object.assign(errors, { type: r.data.errors.type || '', name: r.data.errors.name || '' });
    return;
  }
  showToast(textOf(r.message), 'error');
  if (r.status === 404) router.push('/categories');
}
</script>

<template>
  <h1 class="page-title">{{ isEdit ? 'カテゴリの修正' : 'カテゴリの登録' }}</h1>

  <div v-if="loading" class="list"><p class="empty">{{ MSG.N04 }}</p></div>

  <form v-else class="form" novalidate @submit.prevent="save">
    <div class="field" :class="{ 'has-error': errors.type }">
      <span class="field-label">種類<span class="required">＊</span></span>
      <div class="radio-group">
        <label><input v-model="form.type" type="radio" name="type" value="expense" :disabled="isEdit"> 支出用</label>
        <label><input v-model="form.type" type="radio" name="type" value="income" :disabled="isEdit"> 収入用</label>
      </div>
      <span v-if="isEdit" class="hint">種類は、登録したあとは変えられません</span>
      <p class="field-error">{{ errors.type && textOf(errors.type) }}</p>
    </div>

    <div class="field" :class="{ 'has-error': errors.name }">
      <label class="field-label" for="f-name">名前<span class="required">＊</span></label>
      <input id="f-name" v-model="form.name" type="text">
      <span class="hint">（20文字まで）</span>
      <p class="field-error">{{ errors.name && textOf(errors.name) }}</p>
      <!-- 影響のお知らせ（N05）：修正のときで、記録で使われているときだけ -->
      <p v-if="isEdit && recordCount > 0" class="info">{{ N05(recordCount) }}</p>
    </div>

    <div class="form-buttons">
      <button type="submit" class="btn btn-primary" :disabled="saving">{{ isEdit ? '更新する' : '保存する' }}</button>
      <RouterLink class="btn" to="/categories">戻る</RouterLink>
    </div>
    <p class="form-note">＊は必須の項目です</p>
  </form>
</template>
