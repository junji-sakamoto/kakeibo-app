// 動画を自動で撮るための道具（字幕・章の見出し・今のアドレス・押す場所の印・ゆっくり入力）
// ・字幕などは popover（いちばん上の層）にして、確認の窓（dialog）が開いていても見えるようにする
// ・録画にはブラウザのアドレスバーが映らないので、左下に今のアドレスを出す

// 撮る画面のアドレス（本番で撮るときは APP_URL に CloudFront のアドレスを入れる）
export const BASE = (process.env.APP_URL || 'http://localhost:5173/').replace(/\/?$/, '/');
// GitHub の資料を見せるときのブランチ
export const GITHUB = `https://github.com/junji-sakamoto/kakeibo-app/blob/${process.env.GH_REF || 'develop'}/`;
export const GITHUB_TREE = `https://github.com/junji-sakamoto/kakeibo-app/tree/${process.env.GH_REF || 'develop'}/`;

const OVERLAY_SCRIPT = () => {
  if (window.top !== window) return; // 画面の中の枠（iframe）には出さない
  const install = () => {
    if (document.getElementById('__cap')) return;
    const style = document.createElement('style');
    style.textContent = `
      body { padding-bottom: 130px !important; }
      #__cap { position: fixed; inset: auto 0 44px 0; margin: 0 auto; width: fit-content; max-width: 88vw;
        padding: 12px 22px; border: none; border-radius: 10px; background: rgba(20, 24, 32, .86); color: #fff;
        font: 600 24px/1.6 "Yu Gothic UI", "Meiryo", sans-serif; text-align: center; white-space: pre-line;
        box-shadow: 0 4px 18px rgba(0,0,0,.25); }
      #__cap:empty { display: none; }
      #__url { position: fixed; inset: auto auto 8px 12px; margin: 0; padding: 3px 10px; border: 1px solid #c9ced6;
        border-radius: 14px; background: rgba(255,255,255,.95); color: #333; font: 13px/1.5 "Segoe UI", "Meiryo", sans-serif; }
      #__url:empty { display: none; }
      #__title { position: fixed; inset: 0; margin: 0; width: 100vw; height: 100vh; max-width: none; max-height: none;
        border: none; background: #1f2a44; color: #fff; display: none; align-items: center; justify-content: center;
        flex-direction: column; gap: 18px; font-family: "Yu Gothic UI", "Meiryo", sans-serif; }
      #__title:popover-open { display: flex; }
      #__title .t1 { font-size: 22px; opacity: .75; } #__title .t2 { font-size: 44px; font-weight: 700; }
      .__mark { outline: 4px solid #ff9f1a !important; outline-offset: 3px !important; border-radius: 6px;
        box-shadow: 0 0 0 10px rgba(255,159,26,.25) !important; }`;
    document.head.appendChild(style);
    for (const id of ['__url', '__title', '__cap']) {
      const el = document.createElement('div');
      el.id = id;
      el.setAttribute('popover', 'manual');
      document.body.appendChild(el);
    }
    // 今のアドレスを、左下に出し続ける（https のときは鍵の印を付ける）
    setInterval(() => {
      const href = window.__urlOverride ? window.__urlOverride() : location.href;
      const el = document.getElementById('__url');
      const text = href.startsWith('about:') ? '' : `${href.startsWith('https:') ? '🔒 ' : ''}${decodeURI(href)}`;
      if (el && el.textContent !== text) {
        el.textContent = text;
        try { el.hidePopover(); } catch {}
        if (text) el.showPopover();
        const cap = document.getElementById('__cap');
        if (cap && cap.innerHTML) { cap.hidePopover(); cap.showPopover(); } // 字幕をいちばん上に
      }
    }, 300);
  };
  window.__show = (id, html) => {
    install();
    const el = document.getElementById(id);
    el.innerHTML = html;
    try { el.hidePopover(); } catch {}
    if (html) el.showPopover(); // いちばん上に出し直す
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
};

export async function setup(page) {
  await page.addInitScript(OVERLAY_SCRIPT);
}

// setContent などで作った画面では、字幕の道具をあとから入れる
async function ensure(page) {
  if (!(await page.evaluate(() => typeof window.__show === 'function'))) await page.evaluate(OVERLAY_SCRIPT);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// 字幕を出して、読み終わるまで待つ（1文字 0.14秒、最短 2.5秒）
export async function say(page, text, ms) {
  await ensure(page);
  await page.evaluate(([h]) => window.__show('__cap', h), [esc(text)]);
  await page.waitForTimeout(ms ?? Math.max(2500, text.length * 140));
}

export async function clearCaption(page) {
  await ensure(page);
  await page.evaluate(() => window.__show('__cap', ''));
}

// 章の見出し（全画面）
export async function title(page, sub, main, ms = 2500) {
  await ensure(page);
  await page.evaluate(([a, b]) => window.__show('__title', `<div class="t1">${a}</div><div class="t2">${b}</div>`), [esc(sub), esc(main)]);
  await page.waitForTimeout(ms);
  await page.evaluate(() => window.__show('__title', ''));
}

// 押す場所に印を付けてから押す
export async function press(locator, { wait = 700 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((el) => el.classList.add('__mark'));
  await locator.page().waitForTimeout(wait);
  await locator.evaluate((el) => el.classList.remove('__mark'));
  await locator.click();
  await locator.page().waitForTimeout(400);
}

// 印を付けて見せるだけ（押さない）
export async function point(locator, ms = 1500) {
  await locator.first().scrollIntoViewIfNeeded();
  await locator.evaluateAll((els) => els.forEach((el) => el.classList.add('__mark')));
  await locator.page().waitForTimeout(ms);
  await locator.evaluateAll((els) => els.forEach((el) => el.classList.remove('__mark')));
}

// ゆっくり入力する
export async function type(locator, text) {
  await locator.evaluate((el) => el.classList.add('__mark'));
  await locator.fill('');
  await locator.pressSequentially(text, { delay: 90 });
  await locator.page().waitForTimeout(300);
  await locator.evaluate((el) => el.classList.remove('__mark'));
}

// 選択肢を選ぶ
export async function choose(locator, label) {
  await locator.evaluate((el) => el.classList.add('__mark'));
  await locator.page().waitForTimeout(500);
  await locator.selectOption({ label });
  await locator.page().waitForTimeout(500);
  await locator.evaluate((el) => el.classList.remove('__mark'));
}

// 日付の入力（YYYY-MM-DD）
export async function setDate(locator, ymd) {
  await locator.evaluate((el) => el.classList.add('__mark'));
  await locator.fill(ymd);
  await locator.page().waitForTimeout(700);
  await locator.evaluate((el) => el.classList.remove('__mark'));
}

// ゆっくり動かして、その場所を画面の上のほうに出す
export async function scrollTo(locator, ms = 1500) {
  await locator.first().evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  await locator.page().waitForTimeout(ms);
}

// ページを少しずつ下に動かす（読んでいるように見せる）
export async function scrollDown(page, px = 600, ms = 1500) {
  await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), px);
  await page.waitForTimeout(ms);
}

// 撮影で作ったものを、処理側の API で消す（途中で止まったときの後片付け）
export async function cleanUp(request) {
  const api = `${BASE}api`;
  const months = [];
  const d = new Date();
  for (let i = 0; i < 3; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  for (const month of months) {
    const r = await (await request.get(`${api}/records?month=${month}`)).json();
    for (const rec of r.records.filter((x) => x.memo.startsWith('動画の確認'))) await request.delete(`${api}/records/${rec.id}`);
  }
  const c = await (await request.get(`${api}/categories`)).json();
  for (const cat of c.categories.filter((x) => x.name === 'ペット')) await request.delete(`${api}/categories/${cat.id}`);
}
