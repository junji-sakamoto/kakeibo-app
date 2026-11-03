// ============================================================
// すべての画面で使う「お知らせ」と「確認の窓」
// ============================================================

import { reactive } from 'vue';

// ------------------------------------------------------------
// 完了・エラーのお知らせ（画面の上に数秒間表示する）
// ------------------------------------------------------------
export const toast = reactive({ text: '', kind: 'success', visible: false, shownAt: 0 });
let toastTimer = null;

export function showToast(text, kind = 'success') {
  Object.assign(toast, { text, kind, visible: true, shownAt: Date.now() });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.visible = false; }, 4000);
}

// 画面を切り替えたら、前の画面のお知らせを消す
// （保存した直後に一覧へ戻るときなど、今出したばかりのお知らせは残す）
export function clearOldToast() {
  if (Date.now() - toast.shownAt > 500) toast.visible = false;
}

// ------------------------------------------------------------
// 削除の確認の窓（ConfirmDialog.vue が表示する）
// 「削除する」を押したら true、「キャンセル」や Esc キーなら false
// ------------------------------------------------------------
export const confirmState = reactive({ message: '', open: false, resolve: null });

export function askConfirm(message) {
  return new Promise((resolve) => {
    Object.assign(confirmState, { message, open: true, resolve });
  });
}
