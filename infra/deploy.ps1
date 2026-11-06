<#
============================================================
アプリ（フロントエンド・バックエンド）を EC2 に載せる（デプロイする）スクリプト（第5段階から）
くわしくは docs/03_手順書/07_AWSへの公開の手順書.md の 3章、構成は docs/02_設計/07_構成設計書.md

使い方（プロジェクトの一番上のフォルダで、PowerShell で実行する）：
  .\infra\deploy.ps1                 … GitHub の develop を載せる
  .\infra\deploy.ps1 -Branch 名前    … ほかのブランチを載せる（確かめたいとき）
  .\infra\deploy.ps1 -ResetData      … 載せるのと一緒に、お試しデータを最初の状態に戻す
                                        （講師に確認をお願いする前と、データがおかしくなったとき。今のデータは消える）

前もって必要なこと：
  - aws login --profile kakeibo でログインし、$env:AWS_PROFILE = "kakeibo" を指定している
  - terraform -chdir=infra apply が終わっている（EC2・RDS がある）
  - SSH の秘密鍵が ~/.ssh/kakeibo-ec2 にある
  - 載せたい変更は、GitHub に上げてある（EC2 は GitHub から取ってくる）

すること（何度動かしてもよい。すでにあるものは作り直さない）：
  1. EC2 の起動の準備（Node.js・nginx など）が終わるのを待つ
  2. GitHub からアプリを取ってくる（初めては git clone、2回目からは git pull）
  3. 処理側の部品を入れる（npm ci --omit=dev）
  4. RDS に、アプリ用の利用者とテーブル・お試しデータを作る（ないときだけ。データはそのまま残す）
     -ResetData のときは、記録とカテゴリを全部消して、お試しデータ（カテゴリ17件・記録28件）を入れ直す
  5. 処理側の設定（backend/.env）を置き、systemd で起動し直す
  6. 画面側の部品を入れて組み立て（npm ci・npm run build）、nginx が配る場所（/var/www/kakeibo）に置く
  7. 自分のパソコンから、CloudFront の https のアドレスで、画面と /api/health を確かめる
パスワードは、パソコンの画面やファイルに出さず、SSH の中だけで EC2 に渡す
============================================================
#>
param(
  [string]$Branch = 'develop',
  [switch]$ResetData
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Step($text) { Write-Host "`n=== $text" -ForegroundColor Cyan }
function ToBase64([string]$text) { [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text)) }

# ------------------------------------------------------------
# 0. Terraform の記録から、つなぎ先を読む
# ------------------------------------------------------------
Step 'つなぎ先を読みます（terraform output）'
$ip = terraform -chdir=infra output -raw public_ip
$appUrl = terraform -chdir=infra output -raw app_url
$db = terraform -chdir=infra output -raw db_endpoint
$admin = terraform -chdir=infra output -raw db_admin_username
$adminParam = terraform -chdir=infra output -raw db_admin_password_parameter
$appParam = terraform -chdir=infra output -raw db_app_password_parameter
if ($LASTEXITCODE -ne 0 -or -not $ip) { throw 'つなぎ先が読めませんでした。terraform -chdir=infra apply が終わっているか確かめてください' }
Write-Host "EC2：ec2-user@$ip"
Write-Host "載せるブランチ：$Branch"
if ($ResetData) {
  Write-Host 'お試しデータを最初の状態に戻します（今の記録とカテゴリは消えます）' -ForegroundColor Yellow
  $answer = Read-Host '続けるときは yes と入力してください'
  if ($answer -ne 'yes') { throw '止めました（何も変えていません）' }
}
$reset = if ($ResetData) { '1' } else { '0' }

# パスワードを SSM パラメータストアから読む（記号の意味で困らないように base64 にして渡す）
$adminPw = aws ssm get-parameter --name $adminParam --with-decryption --query Parameter.Value --output text
$appPw = aws ssm get-parameter --name $appParam --with-decryption --query Parameter.Value --output text
if ($LASTEXITCODE -ne 0 -or -not $adminPw -or -not $appPw) { throw 'パスワードが読めませんでした。aws login --profile kakeibo でログインしているか確かめてください' }
$adminB64 = ToBase64 $adminPw
$appB64 = ToBase64 $appPw
$adminPw = $null
$appPw = $null

# ------------------------------------------------------------
# 1〜6. EC2 の中で行う手順（bash）
# ------------------------------------------------------------
$remote = @"
set -euo pipefail
step() { echo; echo "=== `$1"; }

step '1. 起動の準備が終わるのを待つ'
cloud-init status --wait > /dev/null || true
cloud-init status

step '2. GitHub からアプリを取ってくる（$Branch）'
cd ~
if [ -d kakeibo-app/.git ]; then
  git -C kakeibo-app fetch --quiet origin $Branch
  git -C kakeibo-app checkout --quiet -B $Branch origin/$Branch
else
  git clone --quiet --branch $Branch --single-branch https://github.com/junji-sakamoto/kakeibo-app.git
fi
git -C kakeibo-app log --oneline -1

step '3. 処理側の部品を入れる'
cd ~/kakeibo-app/backend
npm ci --omit=dev --no-audit --no-fund --loglevel=error

step '4. RDS の準備（ないときだけ作る）'
export MYSQL_PWD="`$(echo '$adminB64' | base64 -d)"
APP_PW="`$(echo '$appB64' | base64 -d)"
M="mysql -h $db -u $admin --ssl-mode=REQUIRED --default-character-set=utf8mb4 kakeibo"
if [ "`$(`$M -N -e "SELECT COUNT(*) FROM mysql.user WHERE user = 'kakeibo_app'")" = "0" ]; then
  `$M -e "CREATE USER 'kakeibo_app'@'%' IDENTIFIED BY '`$APP_PW'; GRANT SELECT, INSERT, UPDATE, DELETE ON kakeibo.* TO 'kakeibo_app'@'%';"
  echo 'アプリ用の利用者 kakeibo_app を作りました'
else
  echo 'アプリ用の利用者 kakeibo_app はもうあります'
fi
if [ "`$(`$M -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'kakeibo' AND table_name = 'categories'")" = "0" ]; then
  for f in ~/kakeibo-app/database/sql/01_create_tables.sql ~/kakeibo-app/database/sql/02_insert_categories.sql ~/kakeibo-app/database/sql/03_insert_sample_records.sql; do
    `$M < "`$f"; echo "実行しました：`$(basename "`$f")"
  done
elif [ "$reset" = "1" ]; then
  # お試しデータを最初の状態に戻す（自分のパソコンの手順と同じ SQL を使う：docs/03_手順書/01_データベースの手順書.md の 6）
  for f in ~/kakeibo-app/database/reset/reset_data.sql ~/kakeibo-app/database/sql/02_insert_categories.sql ~/kakeibo-app/database/sql/03_insert_sample_records.sql; do
    `$M < "`$f"; echo "実行しました：`$(basename "`$f")"
  done
  echo 'お試しデータを最初の状態に戻しました'
else
  echo 'テーブルはもうあるので、作りませんでした（データはそのまま）'
fi
`$M -N -e "SELECT CONCAT('カテゴリ ', (SELECT COUNT(*) FROM categories), '件・記録 ', (SELECT COUNT(*) FROM records), '件')"
unset MYSQL_PWD

step '5. 処理側の設定を置いて、起動し直す（systemd）'
umask 077
cat > ~/kakeibo-app/backend/.env <<EOF
# EC2 の中だけに置く処理側の設定（GitHub には上げない。infra/deploy.ps1 が書く）
HOST=127.0.0.1
PORT=3000
DB_HOST=$db
DB_PORT=3306
DB_USER=kakeibo_app
DB_PASSWORD=`$APP_PW
DB_NAME=kakeibo
EOF
unset APP_PW
umask 022
sudo systemctl restart kakeibo-backend
sleep 3
echo "kakeibo-backend：`$(systemctl is-active kakeibo-backend)"
echo "/api/health：`$(curl -s http://127.0.0.1:3000/api/health)"

step '6. 画面を組み立てて、nginx が配る場所に置く'
cd ~/kakeibo-app/frontend
npm ci --no-audit --no-fund --loglevel=error
npm run build 2>&1 | tail -n 4
find /var/www/kakeibo -mindepth 1 -delete
cp -r dist/. /var/www/kakeibo/
echo "nginx：`$(systemctl is-active nginx)"
"@
$adminB64 = $null
$appB64 = $null

Step 'EC2 の中で、手順 1〜6 を行います（SSH）'
$sshOpts = @('-i', (Join-Path $HOME '.ssh\kakeibo-ec2'), '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=15', '-o', 'BatchMode=yes')
$remote | ssh @sshOpts "ec2-user@$ip" "tr -d '\r' | bash -s"
$sshExit = $LASTEXITCODE
$remote = $null
if ($sshExit -ne 0) { throw "EC2 の中の手順が失敗しました（終了コード $sshExit）。上の表示で、どこで止まったか確かめてください" }

# ------------------------------------------------------------
# 7. 自分のパソコンから確かめる
# ------------------------------------------------------------
Step '7. 自分のパソコンから確かめます（CloudFront の https）'
# 第6段階から、EC2 の 80番は CloudFront からだけ通すので、CloudFront のアドレスで確かめる
$url = $appUrl
$page = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 15
$health = Invoke-RestMethod "${url}api/health" -TimeoutSec 15
if ($page.StatusCode -ne 200 -or $health.status -ne 'ok') { throw "$url が正しく返りませんでした" }
Write-Host "画面：$($page.StatusCode)　/api/health：$($health.status)"
Write-Host "`n載せ終わりました：$url" -ForegroundColor Green
