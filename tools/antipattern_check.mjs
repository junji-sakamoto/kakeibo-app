// ============================================================
// アンチパターンチェック
// 「動くけれど、やってはいけない書き方」（アンチパターン）を探す
// ESLint の一般的な決まりでは見つけにくい、このアプリで決めた約束ごと（レビューポイント RP-xx）を確かめる
//
// 使い方（プロジェクトの一番上のフォルダで実行する）
//   node tools/antipattern_check.mjs frontend   … 画面側
//   node tools/antipattern_check.mjs backend    … 処理側
//   node tools/antipattern_check.mjs infra      … インフラ（Terraform の .tf ファイル）
//   最後に --json を付けると、結果を JSON で出す（tools/quality_check.mjs が使う）
//
// 見つかったら終わりの番号は 1。くわしくは docs/03_手順書/04_品質チェックの手順書.md
// ============================================================

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
const asJson = process.argv.includes('--json');

// フォルダの中の、決まった拡張子のファイルを全部集める
const collect = (dir, exts) => readdirSync(dir).flatMap((name) => {
  const p = path.join(dir, name);
  return statSync(p).isDirectory() ? collect(p, exts) : exts.some((e) => name.endsWith(e)) ? [p] : [];
});

// 説明（コメント）の行は調べない（説明の中に例として書いた言葉に反応しないため）
const isComment = (line) => /^\s*(\/\/|\*|\/\*|<!--)/.test(line);

// ------------------------------------------------------------
// アンチパターンの一覧
//   id：番号、rp：もとになったレビューポイント、files：調べるファイル、test：1行ずつ調べる決まり
// ------------------------------------------------------------
const FRONTEND = [
  { id: 'AP-F01', rp: 'RP-12', title: 'v-html を使っている（XSS の危険）', test: (l) => /\bv-html\b/.test(l) },
  { id: 'AP-F02', rp: 'RP-12', title: 'innerHTML・document.write で画面を書き換えている（XSS の危険）', test: (l) => /\.innerHTML\s*=|document\.write\(/.test(l) },
  { id: 'AP-F03', rp: '2026-11-02', title: 'ブラウザの小窓（alert・confirm・prompt）を使っている（ブラウザの設定で出ないことがある。画面の中の確認の窓を使う）', test: (l) => /(^|[^.\w])(alert|confirm|prompt)\s*\(/.test(l) },
  { id: 'AP-F04', rp: 'RP-17', title: 'api.js の外で fetch を使っている（処理側とのやりとりは api.js に集める）', test: (l, f) => /\bfetch\s*\(/.test(l) && !f.endsWith('api.js') },
  { id: 'AP-F05', rp: '構成', title: '処理側のアドレス（127.0.0.1:3000 など）を直接書いている（/api に送る）', test: (l, f) => /https?:\/\/(127\.0\.0\.1|localhost)/.test(l) && !f.endsWith('vite.config.js') },
  { id: 'AP-F06', rp: '品質', title: 'console.log が残っている', test: (l) => /\bconsole\.log\(/.test(l) },
  { id: 'AP-F07', rp: '品質', title: 'debugger が残っている', test: (l) => /\bdebugger\b/.test(l) },
];

const BACKEND = [
  // SQL の中に ${ } で値を埋め込んでいる。ただし、大文字だけの名前（SELECT_RECORD などの決まった文）は許す
  { id: 'AP-B01', rp: 'RP-01', title: 'SQL の文に ${ } で値を埋め込んでいる（SQL インジェクションの危険。? を使う）',
    test: (l) => /\b(SELECT|INSERT|UPDATE|DELETE|WHERE|VALUES|SET)\b/.test(l) && [...l.matchAll(/\$\{([^}]*)\}/g)].some((m) => !/^\s*[A-Z_]+\s*$/.test(m[1])) },
  { id: 'AP-B02', rp: 'RP-01', title: 'SQL の文を + でつなげて作っている（SQL インジェクションの危険。? を使う）', test: (l) => /['"`]\s*\+\s*\w+.*\b(WHERE|VALUES|SET)\b|\b(WHERE|VALUES|SET)\b[^'"`]*['"`]\s*\+/.test(l) },
  { id: 'AP-B03', rp: '品質', title: 'SELECT * を使っている（必要な項目だけを取り出す）', test: (l) => /SELECT\s+\*/i.test(l) },
  { id: 'AP-B04', rp: 'RP-03', title: 'エラーのくわしい内容（err.message・err.stack）を使う人に返している（番号だけを返す）', test: (l) => /res\.(status\([^)]*\)\.)?(json|send)\([^)]*err\.(message|stack|sqlMessage)/.test(l) },
  { id: 'AP-B05', rp: 'RP-05', title: 'パスワードなどの秘密の情報をプログラムに直接書いている（.env に書く）', test: (l) => /(password|passwd|secret|token)\s*[:=]\s*['"][^'"]+['"]/i.test(l) },
  { id: 'AP-B06', rp: 'RP-08', title: 'server.js・scripts 以外で process.exit を使っている（受け付け中のお願いが途中で切れる）', test: (l, f) => /process\.exit\(/.test(l) && !/server\.js$|[\\/]scripts[\\/]/.test(f) },
  { id: 'AP-B07', rp: '品質', title: 'API の中で同期の読み書き（readFileSync など）を使っている（ほかのお願いを待たせてしまう）', test: (l, f) => /\b\w+Sync\(/.test(l) && /[\\/]routes[\\/]/.test(f) },
  { id: 'AP-B08', rp: 'RP-03', title: 'catch で受けたエラーを何もせずに捨てている（原因が分からなくなる）', test: (l) => /catch\s*(\([^)]*\))?\s*\{\s*\}/.test(l) },
  { id: 'AP-B09', rp: '品質', title: 'routes の中で console.log を使っている（記録は共通のエラー処理で残す）', test: (l, f) => /\bconsole\.log\(/.test(l) && /[\\/]routes[\\/]/.test(f) },
  { id: 'AP-B10', rp: 'RP-07', title: '結果の番号を書かずに返している（res.json だけ。API 設計書の番号を必ず書く）', test: (l) => /\bres\.json\(/.test(l) && !/res\.status\(/.test(l) },
];

// インフラ（Terraform の .tf ファイル）
//   block：その行が入っている、いちばん外側のまとまりの種類（resource "aws_db_instance" なら aws_db_instance）
const INFRA = [
  { id: 'AP-I01', rp: 'RP-30', title: '入ってくる通信を、どこからでも（0.0.0.0/0・::/0）許している（自分の IP・CloudFront・EC2 の門番に限る）',
    test: (l, f, block) => /ingress|aws_security_group$/.test(block) && /"0\.0\.0\.0\/0"|"::\/0"/.test(l) },
  { id: 'AP-I02', rp: 'RP-31', title: 'パスワードなどの秘密の情報を .tf に直接書いている（ephemeral で作り、password_wo・value_wo で書き込む）',
    test: (l) => /^\s*(\w*_)?(password|secret|token)(_\w+)?\s*=\s*"/i.test(l) },
  { id: 'AP-I03', rp: 'RP-31', title: '秘密の情報を password・value・secret_string で渡している（Terraform の記録（ステート）に残る。_wo のほうを使う）',
    test: (l, f, block) => /aws_db_instance|aws_ssm_parameter|aws_secretsmanager_secret_version/.test(block) && /^\s*(password|value|secret_string)\s*=/.test(l) },
  { id: 'AP-I04', rp: 'RP-31', title: '自分の IP アドレス・アクセスキー・メールアドレスを .tf に直接書いている（terraform.tfvars に書く。GitHub に上げない）',
    test: (l) => /"(?!0\.0\.0\.0\/0")\d{1,3}(\.\d{1,3}){3}(\/\d+)?"|AKIA[0-9A-Z]{16}|[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(l) },
  { id: 'AP-I05', rp: 'RP-32', title: 'RDS をインターネットに公開している（publicly_accessible = true）', test: (l) => /publicly_accessible\s*=\s*true/.test(l) },
  { id: 'AP-I06', rp: 'RP-32', title: '保存する場所を暗号化していない（encrypted・storage_encrypted・encrypt = false）', test: (l) => /^\s*(encrypted|storage_encrypted|encrypt)\s*=\s*false/.test(l) },
  { id: 'AP-I07', rp: 'RP-32', title: 'EC2 の古い情報の取り出し方（IMDSv1）を許している（http_tokens = "required" にする）', test: (l) => /http_tokens\s*=\s*"optional"/.test(l) },
  { id: 'AP-I08', rp: 'RP-32', title: 'CloudFront で http のままの通信を許している（redirect-to-https にする）', test: (l) => /viewer_protocol_policy\s*=\s*"allow-all"/.test(l) },
  { id: 'AP-I09', rp: 'RP-33', title: 'AWS プロバイダーの版を細かく固定していない（6.71.0 のように書く）', test: (l, f, block) => block === 'terraform' && /^\s*version\s*=\s*"\s*(>|<|~|!)/.test(l) },
  { id: 'AP-I10', rp: 'RP-33', title: 'EC2 のイメージ（AMI）の番号を直接書いている（地域や時期で変わる。SSM の公開の値から取る）', test: (l) => /^\s*ami\s*=\s*"ami-/.test(l) },
];

const TARGETS = {
  frontend: { rules: FRONTEND, files: () => [...collect(path.join(ROOT, 'frontend', 'src'), ['.js', '.vue'])] },
  backend: { rules: BACKEND, files: () => collect(path.join(ROOT, 'backend', 'src'), ['.js']) },
  infra: { rules: INFRA, files: () => collect(path.join(ROOT, 'infra'), ['.tf']).filter((f) => !f.includes(`${path.sep}.terraform${path.sep}`)) },
};
if (!TARGETS[target]) {
  console.error('使い方：node tools/antipattern_check.mjs frontend|backend|infra [--json]');
  process.exit(2);
}

// ------------------------------------------------------------
// 1行ずつ調べる
// ------------------------------------------------------------
const { rules, files } = TARGETS[target];
const findings = [];
const fileList = files();
for (const file of fileList) {
  const tf = file.endsWith('.tf');
  let block = '';
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (isComment(line) || (tf && /^\s*#/.test(line))) return;
    // .tf では、行の頭から始まるまとまり（resource "種類" "名前" {、terraform { など）の種類を覚えておく
    if (tf) {
      const m = /^(resource|data|ephemeral)\s+"([^"]+)"|^(terraform|provider|variable|output|locals|module)\b/.exec(line);
      if (m) block = m[2] || m[3];
    }
    for (const rule of rules) {
      if (rule.test(line, file, block)) findings.push({ ...rule, file: path.relative(ROOT, file), line: i + 1, code: line.trim() });
    }
  });
}

if (asJson) {
  process.stdout.write(JSON.stringify({ target, files: fileList.length, rules: rules.length, findings }));
} else {
  console.log(`アンチパターンチェック（${target}）：${fileList.length} 個のファイル、${rules.length} 個のアンチパターンを調べました`);
  for (const f of findings) console.log(`✖ ${f.id}（${f.rp}）${f.title}\n    ${f.file}:${f.line}  ${f.code}`);
  console.log(findings.length === 0 ? '見つかりませんでした（合格）' : `${findings.length} 個見つかりました（不合格）`);
}
process.exit(findings.length === 0 ? 0 : 1);
