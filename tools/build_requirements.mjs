// ============================================================
// 分けた要件定義の資料を、1冊の要件定義書にまとめる
// できあがったものは、プロジェクトの一番上（README.md と同じ場所）の「要件定義書.md」
//
// 使い方（プロジェクトの一番上のフォルダで実行する）
//   node tools/build_requirements.mjs           … 1冊を作り直す
//   node tools/build_requirements.mjs --check   … 1冊が最新かどうかだけを調べる（作り直さない）
//
// まとめ方
//   ・docs/01_要件定義 の「番号_名前.md」の資料を、番号の順につなげる
//   ・それぞれの資料の一番大きい見出し（# 〜）を、「## 番号 見出し」の章にする
//   ・ほかの見出しは、1段小さくする（## → ###）
//   ・「〜に戻る」の行は省く
//   ・<!-- 表紙 --> 〜 <!-- /表紙 --> の部分は、1冊の一番上（表紙）に置く
//   ・<!-- まとめ版では省く --> 〜 <!-- /まとめ版では省く --> の部分は省く
//   ・分けた資料へのリンクは、1冊の中の章へのリンクに置き換える
//   ・そのほかのリンク（設計の資料など）は、一番上から見た場所に付け直す
// ============================================================

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'docs', '01_要件定義'); // 分けた資料の場所
const OUTPUT_PATH = path.join(ROOT, '要件定義書.md'); // できあがった1冊を置く場所
const OUTPUT_DIR = path.dirname(OUTPUT_PATH);
const checkOnly = process.argv.includes('--check');

// 分けた資料から見たリンク先を、1冊の置き場所から見たリンク先に付け直す
// 例：「../02_設計/01_技術スタック.md」→「docs/02_設計/01_技術スタック.md」
function relink(target) {
  const [file, hash] = target.split('#');
  const moved = path.relative(OUTPUT_DIR, path.resolve(DIR, file)).split(path.sep).join('/');
  return hash === undefined ? moved : `${moved}#${hash}`;
}

// 見出しから、リンク先の名前（アンカー）を作る（GitHub と同じ作り方）
// 例：「04 機能要件（機能に関する決まりごと）」→「04-機能要件機能に関する決まりごと」
function anchorOf(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

// 番号の付いた資料を、名前の順に集める
const files = readdirSync(DIR)
  .filter((f) => /^\d{2}(-\d+)?_.+\.md$/.test(f))
  .sort();

// それぞれの資料の番号・見出し・章のアンカーを先に調べておく
// （自動で作ったファイルがまぎれていても、まとめる資料には入れない）
const AUTO_MARK = 'このファイルは自動で作っています';
const chapters = files
  .map((file) => ({ file, text: readFileSync(path.join(DIR, file), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n') }))
  .filter(({ text }) => !text.includes(AUTO_MARK))
  .map(({ file, text }) => {
    const title = (/^# (.+)$/m.exec(text) || [null, file])[1].trim();
    const no = /^(\d{2}(?:-\d+)?)_/.exec(file)[1];
    const heading = `${no} ${title}`;
    return { file, text, heading, anchor: anchorOf(heading) };
  });
const anchorOfFile = new Map(chapters.map((c) => [c.file, c.anchor]));

// リンクを置き換える
//   ・分けた資料そのものへのリンク → 1冊の中の章へのリンク
//   ・それ以外のファイルへのリンク → 一番上から見た場所に付け直す
//   ・「#〜」だけのリンクやインターネットのアドレスは、そのまま
function replaceLinks(line) {
  return line.replace(/\]\(([^)\s]+)\)/g, (all, target) => {
    if (target.startsWith('#') || /^[a-z]+:/i.test(target)) return all;
    if (anchorOfFile.has(target)) return `](#${anchorOfFile.get(target)})`;
    return `](${relink(target)})`;
  });
}

const cover = [];
const bodies = [];

for (const ch of chapters) {
  const out = [];
  let inFence = false; // ``` で囲まれた部分（コードや図）の中かどうか
  let skip = false;
  let inCover = false;
  let seenTitle = false;

  for (const line of ch.text.split('\n')) {
    const t = line.trim();
    if (t === '<!-- まとめ版では省く -->') { skip = true; continue; }
    if (t === '<!-- /まとめ版では省く -->') { skip = false; continue; }
    if (t === '<!-- 表紙 -->') { inCover = true; continue; }
    if (t === '<!-- /表紙 -->') { inCover = false; continue; }
    if (skip) continue;

    if (inCover) {
      // 表紙の見出しは、1冊の中では1段大きくする（### → ##）
      cover.push(replaceLinks(/^###\s/.test(line) ? line.slice(1) : line));
      continue;
    }

    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) { out.push(line); continue; }

    // 「〜に戻る」の行は、1冊の中では要らないので省く
    if (/^\[[^\]]+\]\([^)]+\) に戻る$/.test(t)) continue;

    const h = /^(#{1,5}) (.*)$/.exec(line);
    if (h) {
      if (h[1] === '#' && !seenTitle) {
        seenTitle = true;
        out.push(`## ${ch.heading}`);
      } else {
        out.push(`#${line}`);
      }
      continue;
    }
    out.push(replaceLinks(line));
  }
  bodies.push(out.join('\n').trim());
}

const first = chapters[0].file;
const last = chapters[chapters.length - 1].file;
const toc = chapters.map((c) => `- [${c.heading}](#${c.anchor})`).join('\n');

let result = [
  '# 家計簿アプリ 要件定義書',
  '',
  '> **このファイルは自動で作っています。直接書き換えないでください。**',
  `> 分けた資料（[${first}](${relink(first)}) 〜 [${last}](${relink(last)})）を、\`node tools/build_requirements.mjs\` で1冊にまとめています。`,
  '> 直すときは、分けた資料を直してから、このコマンドを実行してください。',
  '',
  cover.join('\n').trim(),
  '',
  '## 目次',
  '',
  toc,
  '',
  ...bodies.flatMap((b) => ['---', '', b, '']),
].join('\n');
// 空の行が3つ以上続くところは、1つにまとめる
result = result.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';

// 1冊の中のリンク（#〜）の行き先が、すべてあるかを確かめる
const headingAnchors = new Set();
let fence = false;
for (const line of result.split('\n')) {
  if (/^\s*```/.test(line)) fence = !fence;
  const h = !fence && /^#{1,6} (.*)$/.exec(line);
  if (h) headingAnchors.add(anchorOf(h[1]));
}
const broken = [...result.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]).filter((a) => !headingAnchors.has(a));
// ファイルへのリンクの行き先が、すべてあるかも確かめる
fence = false;
const missing = [];
for (const line of result.split('\n')) {
  if (/^\s*```/.test(line)) { fence = !fence; continue; }
  if (fence) continue;
  for (const m of line.matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)) {
    if (!/^[a-z]+:/i.test(m[1]) && !existsSync(path.resolve(OUTPUT_DIR, m[1]))) missing.push(m[1]);
  }
}
broken.push(...missing);
if (broken.length) {
  console.error('1冊の中に、行き先のないリンクがあります：' + [...new Set(broken)].join('、'));
  process.exit(1);
}

const outName = path.relative(ROOT, OUTPUT_PATH);
const current = existsSync(OUTPUT_PATH) ? readFileSync(OUTPUT_PATH, 'utf8').replace(/\r\n/g, '\n') : '';

if (checkOnly) {
  if (current === result) {
    console.log(`${outName} は最新です。`);
  } else {
    console.error(`${outName} が最新ではありません。node tools/build_requirements.mjs を実行してください。`);
    process.exit(1);
  }
} else {
  writeFileSync(OUTPUT_PATH, result);
  console.log(`${outName} を作りました（${chapters.length} 個の資料をまとめました）。`);
  chapters.forEach((c) => console.log(`  ${c.file}`));
}
