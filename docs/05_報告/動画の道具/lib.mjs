// 動画を自動で撮るための道具（字幕・押す場所の印・ゆっくり入力）
// 字幕は popover（いちばん上の層）にして、確認の窓（dialog）が開いていても見えるようにする

const CAPTION_SCRIPT = () => {
  const install = () => {
    if (document.getElementById('__cap')) return;
    const style = document.createElement('style');
    style.textContent = `
      body { padding-bottom: 130px; }
      #__cap { position: fixed; inset: auto 0 28px 0; margin: 0 auto; width: fit-content; max-width: 88vw;
        padding: 12px 22px; border: none; border-radius: 10px; background: rgba(20, 24, 32, .86); color: #fff;
        font: 600 24px/1.6 "Yu Gothic UI", "Meiryo", sans-serif; text-align: center; white-space: pre-line;
        box-shadow: 0 4px 18px rgba(0,0,0,.25); }
      #__cap:empty { display: none; }
      #__title { position: fixed; inset: 0; margin: 0; width: 100vw; height: 100vh; max-width: none; max-height: none;
        border: none; background: #1f2a44; color: #fff; display: none; align-items: center; justify-content: center;
        flex-direction: column; gap: 18px; font-family: "Yu Gothic UI", "Meiryo", sans-serif; }
      #__title:popover-open { display: flex; }
      #__title .t1 { font-size: 22px; opacity: .75; } #__title .t2 { font-size: 44px; font-weight: 700; }
      .__mark { outline: 4px solid #ff9f1a !important; outline-offset: 3px !important; border-radius: 6px;
        box-shadow: 0 0 0 10px rgba(255,159,26,.25) !important; transition: outline-offset .2s; }`;
    document.head.appendChild(style);
    for (const id of ['__title', '__cap']) {
      const el = document.createElement('div');
      el.id = id;
      el.setAttribute('popover', 'manual');
      document.body.appendChild(el);
    }
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
  await page.addInitScript(CAPTION_SCRIPT);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// 字幕を出して、読み終わるまで待つ（1文字 0.14秒、最短 2.5秒）
export async function say(page, text, ms) {
  await page.evaluate(([h]) => window.__show('__cap', h), [esc(text)]);
  await page.waitForTimeout(ms ?? Math.max(2500, text.length * 140));
}

export async function clearCaption(page) {
  await page.evaluate(() => window.__show('__cap', ''));
}

// 章の見出し（全画面）
export async function title(page, sub, main, ms = 2500) {
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
