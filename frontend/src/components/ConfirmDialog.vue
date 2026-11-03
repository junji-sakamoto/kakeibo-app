<!--
  削除の確認の窓（画面の中に表示するダイアログ）
  store.js の askConfirm(文章) で開き、「削除する」なら true、「キャンセル」や Esc キーなら false を返す
-->
<script setup>
import { ref, watch, nextTick } from 'vue';
import { confirmState } from '../store.js';

const dialog = ref(null);

// askConfirm が呼ばれたら、窓を開く
watch(() => confirmState.open, async (open) => {
  if (open) {
    await nextTick();
    dialog.value.showModal();
  }
});

// 窓が閉じたら（ボタン・Esc キーのどちらでも）、結果を返す
function onClose() {
  const ok = dialog.value.returnValue === 'ok';
  dialog.value.returnValue = '';
  confirmState.open = false;
  confirmState.resolve?.(ok);
  confirmState.resolve = null;
}
</script>

<template>
  <dialog ref="dialog" class="dialog" @close="onClose">
    <form method="dialog">
      <h2 class="dialog-title">確認</h2>
      <p class="dialog-message">{{ confirmState.message }}</p>
      <div class="dialog-buttons">
        <button type="submit" value="cancel" class="btn" autofocus>キャンセル</button>
        <button type="submit" value="ok" class="btn btn-danger-fill">削除する</button>
      </div>
    </form>
  </dialog>
</template>
