<#
============================================================
アプリを AWS の EC2 に載せる（デプロイする）スクリプト
くわしくは docs/03_手順書/07_AWSへの公開の手順書.md

使い方（プロジェクトの一番上のフォルダで、PowerShell で実行する）：
  .\infra\deploy.ps1              … 品質チェック → 画面を組み立てる → EC2 に送る → 処理側を起動し直す → 確かめる
  .\infra\deploy.ps1 -SetupDb     … 上に加えて、データベースの準備（アプリ用の利用者・テーブル・お試しデータ）もする（初めてのとき）
  .\infra\deploy.ps1 -ResetData   … お試しデータを最初の状態に戻すだけ（アプリは載せ直さない）
  -SkipCheck を付けると、品質チェックを飛ばす（急いで載せ直すときだけ）

前もって必要なこと：
  - aws login --profile kakeibo でログインし、$env:AWS_PROFILE = "kakeibo" を指定している
  - terraform -chdir=infra apply が終わっている
  - SSH の秘密鍵が ~/.ssh/kakeibo-ec2 にある
パスワードは、パソコンの画面やファイルに残さず、SSH の中だけで EC2 に渡す
============================================================
#>
param(
  [switch]$SetupDb,
  [switch]$ResetData,
  [switch]$SkipCheck
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Step($text) { Write-Host "`n=== $text" -ForegroundColor Cyan }

# 外のコマンド（node・npm・ssh など）が失敗したら、そこで止める
function Invoke-Checked([scriptblock]$block, [string]$what) {
  & $block
  if ($LASTEXITCODE -ne 0) { throw "$what に失敗しました（終了コード $LASTEXITCODE）" }
}

# ------------------------------------------------------------
# 0. Terraform の記録から、つなぎ先を読む
# ------------------------------------------------------------
Step 'つなぎ先を読みます（terraform output）'
$ip = terraform -chdir=infra output -raw public_ip
$url = terraform -chdir=infra output -raw app_url
$adminSecretArn = terraform -chdir=infra output -raw db_admin_secret_arn
$appPasswordParam = terraform -chdir=infra output -raw db_app_password_parameter
if (-not $ip) { throw 'EC2 の住所が読めませんでした。terraform -chdir=infra apply が終わっているか確かめてください' }
$key = Join-Path $HOME '.ssh\kakeibo-ec2'
$target = "ec2-user@$ip"
# 初めてつなぐときは、EC2 の鍵を自動で覚える（2回目からは、すりかえられていないか確かめる）
$sshOpts = @('-i', $key, '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=15')
Write-Host "EC2：$target"
Write-Host "公開のアドレス：$url"

# EC2 の中で bash の手順を動かす（Windows の改行 CRLF を LF に直してから渡す）
function Invoke-Remote([string]$script, [string]$what) {
  Invoke-Checked { $script | ssh @sshOpts $target "tr -d '\r' | bash -s" } $what
}

# パスワードを、記号の意味で困らないように base64 にして EC2 に渡す
function ToBase64([string]$text) { [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text)) }

# データベースの準備・お試しデータの戻し（backend/scripts/setup-db.mjs を EC2 の中で動かす）
function Invoke-DbSetup([switch]$Reset) {
  $admin = aws secretsmanager get-secret-value --secret-id $adminSecretArn --query SecretString --output text | ConvertFrom-Json
  $appPassword = aws ssm get-parameter --name $appPasswordParam --with-decryption --query Parameter.Value --output text
  if (-not $admin.password -or -not $appPassword) { throw 'パスワードが読めませんでした。aws login --profile kakeibo でログインしているか確かめてください' }
  $arg = if ($Reset) { '--reset' } else { '' }
  $remote = @"
set -euo pipefail
set -a; . /etc/kakeibo/backend.env; set +a
export DB_ADMIN_USER="`$(echo '$(ToBase64 $admin.username)' | base64 -d)"
export DB_ADMIN_PASSWORD="`$(echo '$(ToBase64 $admin.password)' | base64 -d)"
export DB_APP_PASSWORD="`$(echo '$(ToBase64 $appPassword)' | base64 -d)"
cd /opt/kakeibo/backend
node scripts/setup-db.mjs $arg
"@
  Invoke-Remote $remote 'データベースの準備'
}

if ($ResetData) {
  Step 'お試しデータを最初の状態に戻します'
  Invoke-DbSetup -Reset
  Write-Host "`n終わりました：$url" -ForegroundColor Green
  exit 0
}

# ------------------------------------------------------------
# 1. 品質チェック（docs/03_手順書/04_品質チェックの手順書.md）
# ------------------------------------------------------------
if ($SkipCheck) {
  Write-Host "`n品質チェックは飛ばしました（-SkipCheck）" -ForegroundColor Yellow
} else {
  Step '品質チェックをします（node tools/quality_check.mjs）'
  Invoke-Checked { node tools/quality_check.mjs } '品質チェック'
}

# ------------------------------------------------------------
# 2. 画面を組み立てる（frontend/dist ができる）
# ------------------------------------------------------------
Step '画面を組み立てます（npm run build）'
Invoke-Checked { npm --prefix frontend run build } '画面の組み立て'

# ------------------------------------------------------------
# 3. 送るファイルを1つにまとめる（tar.gz）
#    処理側は、部品（node_modules）と .env を送らない。EC2 で部品を入れ直す
# ------------------------------------------------------------
Step '送るファイルをまとめます'
$stage = Join-Path ([IO.Path]::GetTempPath()) 'kakeibo-release'
if (Test-Path $stage) { Get-ChildItem $stage | ForEach-Object { $_ | Remove-Item -Recurse -Force } } else { New-Item -ItemType Directory $stage | Out-Null }
New-Item -ItemType Directory "$stage\backend", "$stage\database", "$stage\www" | Out-Null
Copy-Item backend\src, backend\scripts -Destination "$stage\backend" -Recurse
Copy-Item backend\package.json, backend\package-lock.json, backend\.npmrc -Destination "$stage\backend"
Copy-Item database\sql, database\reset -Destination "$stage\database" -Recurse
Copy-Item frontend\dist\* -Destination "$stage\www" -Recurse
$archive = Join-Path ([IO.Path]::GetTempPath()) 'kakeibo-release.tar.gz'
Invoke-Checked { tar -czf $archive -C $stage backend database www } 'ファイルのまとめ'
Write-Host ("まとめたファイル：{0:N0} KB" -f ((Get-Item $archive).Length / 1KB))

# ------------------------------------------------------------
# 4. EC2 に送って、置きかえる
# ------------------------------------------------------------
Step 'EC2 に送ります（scp）'
Invoke-Checked { scp @sshOpts $archive "${target}:/tmp/kakeibo-release.tar.gz" } 'ファイルの送信'

Step 'EC2 の中で置きかえて、処理側の部品を入れます'
Invoke-Remote @'
set -euo pipefail
rm -rf /tmp/kakeibo-release && mkdir /tmp/kakeibo-release
tar -xzf /tmp/kakeibo-release.tar.gz -C /tmp/kakeibo-release
for pair in backend:/opt/kakeibo/backend database:/opt/kakeibo/database www:/var/www/kakeibo; do
  src="/tmp/kakeibo-release/${pair%%:*}"; dst="${pair#*:}"
  find "$dst" -mindepth 1 -delete
  cp -r "$src/." "$dst/"
done
cd /opt/kakeibo/backend
npm ci --omit=dev --no-audit --no-fund
rm -rf /tmp/kakeibo-release /tmp/kakeibo-release.tar.gz
'@ 'EC2 での置きかえ'

# ------------------------------------------------------------
# 5. データベースの準備（-SetupDb のときだけ）
# ------------------------------------------------------------
if ($SetupDb) {
  Step 'データベースの準備をします（アプリ用の利用者・テーブル・お試しデータ）'
  Invoke-DbSetup
}

# ------------------------------------------------------------
# 6. 処理側を起動し直す
# ------------------------------------------------------------
Step '処理側を起動し直します'
Invoke-Remote @'
set -euo pipefail
sudo /usr/bin/systemctl restart kakeibo-backend
sleep 2
sudo /usr/bin/systemctl status kakeibo-backend --no-pager | head -n 5
'@ '処理側の起動'

# ------------------------------------------------------------
# 7. 公開のアドレスから確かめる（API11：動いているかの確認）
# ------------------------------------------------------------
Step '公開のアドレスから確かめます'
$healthUrl = "${url}api/health"
$ok = $false
for ($i = 1; $i -le 10; $i++) {
  try {
    $res = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10
    if ($res.StatusCode -eq 200) { $ok = $true; break }
  } catch {
    Write-Host "  まだ確かめられません（$i 回目）：$($_.Exception.Message)"
  }
  Start-Sleep -Seconds 5
}
if (-not $ok) { throw "$healthUrl が 200 を返しませんでした。EC2 に SSH で入って sudo journalctl -u kakeibo-backend -n 50 を見てください" }

Write-Host "`n載せ終わりました：$url" -ForegroundColor Green
