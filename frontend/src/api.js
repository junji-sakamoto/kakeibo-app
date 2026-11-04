// ============================================================
// 処理側（バックエンド）とのやりとり
// 決まりごとは docs/02_設計/06_API設計書.md を参照
// ブラウザに初めから入っている fetch を使う
// ============================================================

// お願いを送って、結果を { ok, status, data, message } の形で返す
//   ok      … 成功したか
//   status  … 結果の番号（200・404 など。処理側につながらなかったときは 0）
//   data    … 返ってきた本文（JSON）
//   message … 失敗したときに表示するメッセージの番号（S01・S02・E12 など）
export async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // 処理側につながらなかった（S01）
    return { ok: false, status: 0, data: null, message: 'S01' };
  }

  let data = null;
  if (res.status !== 204) {
    try {
      data = await res.json();
    } catch {
      data = null; // JSON でない結果（中継がうまくいかなかったときなど）
    }
  }
  // 処理側につながらず、中継の道具がエラーを返したとき（開発中）も S01 として扱う
  if (!res.ok && data === null && res.status >= 500) {
    return { ok: false, status: res.status, data, message: 'S01' };
  }
  return { ok: res.ok, status: res.status, data, message: data?.message || (res.ok ? null : 'S04') };
}

export const api = {
  // 記録
  getRecords: (month) => request('GET', `/records?month=${encodeURIComponent(month)}`), // API1
  getRecord: (id) => request('GET', `/records/${id}`), // API2
  createRecord: (body) => request('POST', '/records', body), // API3
  updateRecord: (id, body) => request('PUT', `/records/${id}`, body), // API4
  deleteRecord: (id) => request('DELETE', `/records/${id}`), // API5
  // カテゴリ
  getCategories: () => request('GET', '/categories'), // API6
  getCategory: (id) => request('GET', `/categories/${id}`), // API7
  createCategory: (body) => request('POST', '/categories', body), // API8
  updateCategory: (id, body) => request('PUT', `/categories/${id}`, body), // API9
  deleteCategory: (id) => request('DELETE', `/categories/${id}`), // API10
  // 集計
  getYearSummary: (year) => request('GET', `/summary?year=${encodeURIComponent(year)}`), // API12
};
