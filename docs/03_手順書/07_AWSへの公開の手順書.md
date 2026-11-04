# AWS への公開の手順書

このアプリを、**AWS CLI と Terraform** で AWS に公開する手順です。マネジメントコンソールは使いません。
コマンドは、VS Code の画面下のターミナル（PowerShell）で、**プロジェクトの一番上のフォルダ**（`syokyu-kadai`）で入力します。

> - どんな形で AWS に置くかは [構成設計書](../02_設計/07_構成設計書.md) を参照してください
> - 言葉や考え方は [AWS と Terraform の基礎知識](05_AWSとTerraformの基礎知識.md)、ログインのしかたは [AWS の認証設定の手順書](06_AWSの認証設定の手順書.md) を参照してください

## 0. この手順書でやること

| 章 | すること | AWS が変わるか | お金 |
|---|---|---|---|
| 1 | はじめの1回だけの準備（SSH の鍵・記録の置き場所・設定の値） | S3 バケットを1つ作る | ほぼ 0 円 |
| 2 | Terraform で作る（`plan` → `apply`） | **変わる** | **かかり始める**（1日約0.85ドル。クレジットから引かれる） |
| 3 | EC2 の準備が終わったか確かめる | 変わらない | — |
| 4 | 初めてアプリを載せる（データベースの準備も） | EC2 と RDS の中が変わる | — |
| 5 | 公開のアドレスで確かめる | 変わらない | — |
| 6 | 修正版を載せる | EC2 の中が変わる | — |
| 7 | お試しデータを最初の状態に戻す | RDS の中が変わる | — |
| 8 | 費用を見張る | 札の設定を変える | — |
| 9 | 自分の IP アドレスが変わったとき | 門番を変える | — |
| 10 | 片付け（講師の確認が終わったら） | **全部消える** | 止まる |
| 11 | 困ったとき | — | — |

### 関係するファイル

```
infra/
├── versions.tf                ← Terraform と AWS プロバイダーの版、記録の置き場所（S3）、札
├── variables.tf               ← 外から渡す値
├── network.tf                 ← デフォルト VPC とサブネットを読む（作らない）
├── security.tf                ← 門番（セキュリティグループ）
├── compute.tf                 ← EC2・固定の住所（Elastic IP）・SSH の公開鍵
├── user_data.sh.tftpl         ← EC2 が初めて起動したときの準備（nginx・Node.js・処理側のサービス）
├── iam.tf                     ← EC2 に渡す権限
├── database.tf                ← RDS・管理者とアプリ用のパスワード（SSM パラメータストア）
├── cdn.tf                     ← CloudFront（https の入口）
├── budget.tf                  ← 予算の見張り
├── outputs.tf                 ← 作ったあとに表示する値
├── deploy.ps1                 ← アプリを載せるスクリプト
├── terraform.tfvars.example   ← 外から渡す値の見本（GitHub に上げる）
├── terraform.tfvars           ← 外から渡す本物の値（GitHub に上げない）
└── .terraform.lock.hcl        ← プロバイダーの版の記録（Terraform が作る。GitHub に上げる）
backend/scripts/setup-db.mjs   ← 本番のデータベースの準備（deploy.ps1 が EC2 の中で動かす）
```

### 毎回、最初にすること

```powershell
$env:AWS_PROFILE = "kakeibo"
aws sts get-caller-identity --query Arn --output text
```

`…:user/admin-user` と出れば大丈夫です。`ExpiredToken` などのエラーが出たら、ブラウザで AWS のコンソールに admin-user でログインしてから、`aws login --profile kakeibo` でログインし直します（[AWS の認証設定の手順書](06_AWSの認証設定の手順書.md) の 3章）。

---

## 1. はじめの1回だけの準備

### 1-1. SSH の鍵を作る

EC2 に入るための鍵です。**秘密鍵はパソコンにだけ置き、誰にも渡しません**（GitHub にも上げません）。

```powershell
ssh-keygen -t ed25519 -f "$HOME\.ssh\kakeibo-ec2" -C "kakeibo-ec2"
```

パスフレーズを聞かれたら、何も入れずに Enter を2回押します。次の2つのファイルができます。

| ファイル | 中身 |
|---|---|
| `C:\Users\坂本　順治\.ssh\kakeibo-ec2` | 秘密鍵（誰にも渡さない） |
| `C:\Users\坂本　順治\.ssh\kakeibo-ec2.pub` | 公開鍵（Terraform が AWS に登録する） |

### 1-2. Terraform の記録（ステート）の置き場所を作る

Terraform 自身の記録を入れる S3 バケットです。Terraform より先に、AWS CLI で作ります。

```powershell
$account = aws sts get-caller-identity --query Account --output text
$bucket = "kakeibo-tfstate-$account"
# バケットを作る（東京）
aws s3api create-bucket --bucket $bucket --region ap-northeast-1 --create-bucket-configuration LocationConstraint=ap-northeast-1
# 上書きしても前の版に戻せるようにする
aws s3api put-bucket-versioning --bucket $bucket --versioning-configuration Status=Enabled
# インターネットに公開されないようにする
aws s3api put-public-access-block --bucket $bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
# 札を付ける（家計簿のものだと分かるように）
aws s3api put-bucket-tagging --bucket $bucket --tagging 'TagSet=[{Key=Project,Value=kakeibo},{Key=ManagedBy,Value=aws-cli}]'
```

- このバケットは Terraform の外で作るので、`terraform destroy` では消えません（10章で、最後に手で消します）
- バケットの名前にアカウント ID が入るので、名前はコードに書かず、次の 1-4 で渡します

### 1-3. 外から渡す値を書く

1. `infra/terraform.tfvars.example` をコピーして、同じ場所に `infra/terraform.tfvars` という名前で置きます

   ```powershell
   Copy-Item infra\terraform.tfvars.example infra\terraform.tfvars
   ```

2. 自分のパソコンの IP アドレスを調べます

   ```powershell
   (Invoke-RestMethod https://checkip.amazonaws.com).Trim()
   ```

3. `infra/terraform.tfvars` を開き、2つの値を書きかえて保存します

   | 項目 | 書くもの |
   |---|---|
   | `my_ip` | 2. で調べた IP アドレス（SSH で入ってよい場所） |
   | `alert_email` | 予算をこえそうなときに知らせるメールアドレス |

`terraform.tfvars` は `.gitignore` に入っているので、GitHub には上がりません。

### 1-4. Terraform の準備をする（init）

```powershell
$account = aws sts get-caller-identity --query Account --output text
terraform -chdir=infra init -backend-config="bucket=kakeibo-tfstate-$account"
```

`Terraform has been successfully initialized!` と出れば準備できています。AWS プロバイダーの版の記録（`infra/.terraform.lock.hcl`）ができるので、これは GitHub に上げます。

---

## 2. Terraform で作る

### 2-1. 何が作られるか確かめる（plan）

```powershell
terraform -chdir=infra plan -out=kakeibo.tfplan
```

- **AWS には何も作られません**。作るものの一覧が表示されるだけです
- 最後の行が `Plan: 19 to add, 0 to change, 0 to destroy.` になっていることを確かめます（初めてのときは「作る」だけで、「変える」「消す」は 0）
- `-out=kakeibo.tfplan` で、確かめた内容をファイルに残します。次の `apply` で、**確かめたとおりのもの**だけが作られます

### 2-2. 本当に作る（apply）

> **ここからお金がかかり始めます**（1日約0.85ドル、1か月つけっぱなしなら約25ドル。無料プランのクレジットから引かれます）。
> 必要なときだけ作り、確かめが終わったら 10章の `terraform destroy` ですぐ消します（[構成設計書](../02_設計/07_構成設計書.md) 2章の「置いておく期間」）。

```powershell
terraform -chdir=infra apply kakeibo.tfplan
```

- RDS は10分ほど、CloudFront は5〜10分ほどかかります。全部で15〜20分ほど待ちます
- 終わると、次のような値が表示されます（あとからでも `terraform -chdir=infra output` で見られます）

  | 値 | 意味 |
  |---|---|
  | `app_url` | **公開のアドレス**（`https://（ランダムな文字）.cloudfront.net/`）。講師に伝えるもの |
  | `ssh_command` | EC2 に SSH で入るコマンド |
  | `public_ip` | EC2 の固定の住所 |
  | `db_endpoint` | RDS の住所（EC2 の中からだけつなげる） |

- 終わったら、使ったファイルを消します

  ```powershell
  Remove-Item infra\kakeibo.tfplan
  ```

## 3. EC2 の準備が終わったか確かめる

EC2 は、起動したあとに5分ほどかけて、nginx と Node.js を入れます（`infra/user_data.sh.tftpl`）。

```powershell
$ip = terraform -chdir=infra output -raw public_ip
ssh -i "$HOME\.ssh\kakeibo-ec2" ec2-user@$ip
```

- 初めてつなぐときは `Are you sure you want to continue connecting (yes/no/[fingerprint])?` と聞かれるので、半角で `yes` と打ちます
- 入れたら、次のコマンドで進み具合を確かめます

  ```bash
  sudo tail -n 5 /var/log/cloud-init-output.log
  ```

  最後に **`準備が終わりました`** と出ていれば終わっています。まだのときは、少し待ってもう一度見ます

- ついでに、Node.js の版と、nginx が動いているかを確かめます

  ```bash
  node -v                      # v26.13.0 と出ればよい
  systemctl is-active nginx    # active と出ればよい
  exit
  ```

## 4. 初めてアプリを載せる

```powershell
.\infra\deploy.ps1 -SetupDb
```

`deploy.ps1` は、次のことを順番に行います（[構成設計書](../02_設計/07_構成設計書.md) の 9章）。

| 順番 | すること |
|---|---|
| 1 | 品質チェック（`node tools/quality_check.mjs`）。**不合格なら、そこで止まります**（自分のパソコンのデータベースを起動しておく） |
| 2 | 画面を組み立てる（`frontend` で `npm run build`） |
| 3 | 処理側・SQL・画面のファイルを1つにまとめる（部品 `node_modules` と `.env` は入れない） |
| 4 | EC2 に送って置きかえ、処理側の部品を入れる（`npm ci --omit=dev`） |
| 5 | （`-SetupDb` のときだけ）データベースの準備：アプリ用の利用者 `kakeibo_app` を作り、テーブルとお試しデータを作る |
| 6 | 処理側を起動し直す |
| 7 | 公開のアドレスの `/api/health` が 200 を返すか確かめる |

- パスワードは、パソコンの画面やファイルには出さず、AWS から読んで SSH の中だけで EC2 に渡します
- 最後に **`載せ終わりました：https://….cloudfront.net/`** と出れば成功です
- `-SetupDb` を2回目以降に付けても、テーブルがあれば作り直しません（データはそのまま）

## 5. 公開のアドレスで確かめる

```powershell
terraform -chdir=infra output -raw app_url
```

表示されたアドレスをブラウザで開き、次のことを確かめます。

| 確かめること | よい状態 |
|---|---|
| アドレス | `https://` で始まり、鍵のマークが出る |
| 記録一覧 | お試しデータの記録と、月の合計が出る |
| 記録の登録・修正・削除、カテゴリの登録・修正・削除 | できる |
| `…/categories` を開いて再読み込み（F5） | カテゴリ一覧の画面が出る（「見つかりません」にならない） |
| `http://` で開く | `https://` に移る |
| スマートフォン | 崩れずに操作できる |

くわしい試験は、[試験計画書](../04_試験/00_試験計画書.md) の「公開後」の項目で行います。

## 6. 修正版を載せる

プログラムを直したら、コミットしてから、次のコマンドで載せ直します。

```powershell
.\infra\deploy.ps1
```

- データベースの中身はそのままです
- 載せ直しのあいだ（数秒）は、画面が使えないことがあります（非機能要件で、止まってもよいことにしています）

## 7. お試しデータを最初の状態に戻す

講師に確認をお願いする前と、データがおかしくなったときに行います（[非機能要件](../01_要件定義/07_非機能要件.md) 3-2）。

```powershell
.\infra\deploy.ps1 -ResetData
```

- 記録とカテゴリを全部消してから、最初のお試しデータ（カテゴリ17件・記録28件）を入れ直します
- **使う人が登録したデータも消えます**
- 自分のパソコンと同じ SQL（`database/reset/reset_data.sql`・`database/sql/02_…`・`03_…`）を使います

## 8. 費用を見張る

### 8-1. 札（タグ）で数えられるようにする（作った次の日に1回だけ）

予算の見張り（`kakeibo-monthly`）は、札 `Project = kakeibo` の付いたものだけを数えます。札で数えるには、請求の仕組みで札を有効にする必要があります。札の付いたものを作ってから、札が請求の仕組みに出てくるまで、最大で1日かかります。

```powershell
# 札が出てきているか確かめる（Project が表示されればよい）
aws ce list-cost-allocation-tags --region us-east-1 --query "CostAllocationTags[?TagKey=='Project']"
# 有効にする
aws ce update-cost-allocation-tags-status --region us-east-1 --cost-allocation-tags-status TagKey=Project,Status=Active
```

有効にしてから、予算の数え方に反映されるまで、さらに最大で1日かかります。

### 8-2. 今の金額とクレジットを確かめる

```powershell
# 予算と、今月の実際の金額・見込み
aws budgets describe-budget --account-id (aws sts get-caller-identity --query Account --output text) --budget-name kakeibo-monthly --query "Budget.CalculatedSpend"
# 無料プランのクレジットの残り
aws freetier get-account-plan-state --region us-east-1 --query "accountPlanRemainingCredits"
```

- 予算をこえそうになると、`alert_email` に書いたアドレスにメールが届きます（27ドル・33ドル）
- **2026年12月31日で EC2 の無料トライアルが終わり**、2027年1月からは月約43ドル（約6,400円）になります。その前に講師の確認を終えるか、構成を見直します（[構成設計書](../02_設計/07_構成設計書.md) 10-2）

## 9. 自分の IP アドレスが変わったとき

家のネットの契約によっては、IP アドレスが変わることがあります。変わると、SSH（と `deploy.ps1`）でつながらなくなります（`Connection timed out`）。

1. 1-3 の 2. で、今の IP アドレスを調べます
2. `infra/terraform.tfvars` の `my_ip` を書きかえます
3. 門番だけが変わることを確かめてから、変えます

   ```powershell
   terraform -chdir=infra plan -out=kakeibo.tfplan
   terraform -chdir=infra apply kakeibo.tfplan
   Remove-Item infra\kakeibo.tfplan
   ```

   plan に `aws_vpc_security_group_ingress_rule.ssh_from_my_ip` だけが出ることを確かめます

## 10. 片付け（確かめが終わったとき・講師の確認が終わったとき）

> **全部消えます。RDS のデータも戻せません。** 本番環境は必要なときだけ作るので、確かめが終わったときも、講師の確認が終わったときも、この手順で消します。

| いつ | 行う手順 |
|---|---|
| 確かめのために作って、公開後の試験が終わったとき（また作り直す） | 1・2 だけ（S3 バケットと SSH の鍵は残す。次に作るときは 2章の `plan` から） |
| 講師の確認が終わって、もう作り直さないとき | 1〜5 すべて |

1. Terraform で作ったものを全部消します。消すものの一覧が出るので、確かめてから `yes` と打ちます（CloudFront を消すのに15分ほどかかります）。デフォルト VPC は Terraform で作ったものではないので消えません

   ```powershell
   terraform -chdir=infra destroy
   ```

2. 家計簿のものが残っていないか確かめます（S3 バケットだけが出れば大丈夫です。S3 バケットは、もう作り直さないときに次の 3. で消します）

   ```powershell
   aws resourcegroupstaggingapi get-resources --tag-filters Key=Project,Values=kakeibo --query "ResourceTagMappingList[].ResourceARN"
   ```

3. （もう作り直さないときだけ）記録の置き場所（S3 バケット）を消します。前の版も残しているので、版ごと全部消してから、バケットを消します

   ```powershell
   $account = aws sts get-caller-identity --query Account --output text
   $bucket = "kakeibo-tfstate-$account"
   $v = aws s3api list-object-versions --bucket $bucket --output json | ConvertFrom-Json
   $objects = @(@($v.Versions) + @($v.DeleteMarkers) | Where-Object { $_ } | ForEach-Object { @{ Key = $_.Key; VersionId = $_.VersionId } })
   if ($objects.Count -gt 0) {
     $file = Join-Path ([IO.Path]::GetTempPath()) 'kakeibo-delete.json'
     @{ Objects = $objects } | ConvertTo-Json -Depth 3 | Set-Content -Encoding ascii $file
     aws s3api delete-objects --bucket $bucket --delete "file://$file"
   }
   aws s3api delete-bucket --bucket $bucket
   ```

4. （もう作り直さないときだけ）次の月の請求で、家計簿の料金が 0 になったことを確かめます
5. （もう作り直さないときだけ）パソコンの中の、もう使わないものを消します（任意）
   - SSH の鍵：`C:\Users\坂本　順治\.ssh\kakeibo-ec2`・`kakeibo-ec2.pub`
   - `infra/terraform.tfvars`・`infra/.terraform` フォルダ

プログラムと資料は GitHub に残します。

## 11. 困ったとき

| 起きたこと | 考えられる原因 | どうするか |
|---|---|---|
| `terraform` で `No valid credential sources found`・`ExpiredToken` | ログインの期限切れ、または `$env:AWS_PROFILE` の指定忘れ | 「毎回、最初にすること」を行う |
| `terraform` で `Failed to load plugin schemas` | Norton が割り込んでいる | [AWS の認証設定の手順書](06_AWSの認証設定の手順書.md) の 8章 |
| `apply` で RDS の `backup retention period` のエラー | 無料プランのアカウントで、控えを7日分にできない | `infra/terraform.tfvars` に `db_backup_retention_days = 1` を書いてやり直し、非機能要件を直す |
| `ssh` で `Connection timed out` | 自分の IP アドレスが変わった | 9章 |
| `ssh` で `REMOTE HOST IDENTIFICATION HAS CHANGED` | EC2 が作り直されて、EC2 の鍵が変わった | `ssh-keygen -R （public_ip）` で古い鍵を忘れさせてから、つなぎ直す |
| `deploy.ps1` が品質チェックで止まる | 自分のパソコンのデータベースが止まっている、または不合格の項目がある | データベースを起動する（[データベースの手順書](01_データベースの手順書.md) の 2章）。不合格の項目を直す |
| `deploy.ps1` の最後に `/api/health が 200 を返しませんでした` | 処理側が起動できていない | EC2 に SSH で入って `sudo journalctl -u kakeibo-backend -n 50` を見る |
| 公開のアドレスで `502 Bad Gateway` | 処理側が止まっている | 同上 |
| 公開のアドレスで「準備中です」と出る | まだアプリを載せていない | 4章 |
| 画面は出るが、記録が読み込めない（S01） | 処理側がデータベースにつながっていない | 同上。`-SetupDb` を付けて載せたか確かめる |
| `user_data.sh.tftpl` を直して `apply` したら、EC2 が作り直された | 初めて起動したときの準備は、作り直さないと反映されないため | 3章で準備が終わるのを待ってから、`.\infra\deploy.ps1` で載せ直す（データは RDS にあるので消えない） |

## 12. 確かめた記録

| 日付 | 確かめたこと | 結果 |
|---|---|---|
| 2026年11月4日 | `terraform -chdir=infra init -backend=false`・`fmt -check`・`validate` | 合格（AWS には何もしていない） |
| 2026年11月4日 | `user_data.sh.tftpl` に値を入れたものを `bash -n` | 文法の間違いなし（169行） |
| 2026年11月4日 | `backend/scripts/setup-db.mjs` を、自分のパソコンの試験用のデータベースで | 1回目でテーブルとお試しデータ（17・28件）ができる、2回目は作り直さない、アプリ用の利用者はテーブルを消せない、`--reset` で戻る。試験用のデータベースと利用者は後片付けした |
| 2026年11月4日 | `deploy.ps1` の文法と、送るファイルのまとめ（3番目まで） | 文法の間違いなし。`.env`・`node_modules` が入らないことを確認 |
| （これから） | 1章〜7章を実際に行う | |
