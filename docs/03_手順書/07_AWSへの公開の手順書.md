# AWS への公開の手順書

このアプリを、**AWS CLI と Terraform** で AWS に置く手順です。マネジメントコンソールは使いません。
コマンドは、VS Code の画面下のターミナル（PowerShell）で、**プロジェクトの一番上のフォルダ**（`syokyu-kadai`）で入力します。

> - どんな形で AWS に置くかは [構成設計書](../02_設計/07_構成設計書.md) を参照してください
> - 言葉や考え方は [AWS と Terraform の基礎知識](05_AWSとTerraformの基礎知識.md)、ログインのしかたは [AWS の認証設定の手順書](06_AWSの認証設定の手順書.md) を参照してください

## 0. この手順書でやること

一気に全部を作らず、**段階ごとに作って確かめます**（[構成設計書](../02_設計/07_構成設計書.md) の 1章）。この手順書には、今の段階までの手順を書き、段階が進むごとに書き足します。

| 段階 | 内容 | この手順書 |
|---|---|---|
| **第1段階** | **EC2 を作り、SSH で入れることを確かめる** | **1〜6章** |
| 第2段階 | EC2 に Node.js を入れる | これから書き足す |
| 第3段階 | RDS を作り、EC2 からつなぐ | これから書き足す |
| 第4段階 | アプリを載せて、自分のパソコンのブラウザで確かめる | これから書き足す |

| 章 | すること | AWS が変わるか | お金 |
|---|---|---|---|
| 1 | はじめの1回だけの準備（SSH の鍵・記録の置き場所・設定の値） | S3 バケットを1つ作る | ほぼ 0 円 |
| 2 | Terraform で EC2 を作る（`plan` → `apply`） | **変わる** | **かかり始める**（1日約 0.15 ドル。クレジットから引かれる） |
| 3 | EC2 に SSH で入って確かめる | 変わらない | — |
| 4 | 自分の IP アドレスが変わったとき | 門番を変える | — |
| 5 | 片付け（確かめが終わったら） | **消える** | 止まる |
| 6 | 困ったとき | — | — |

### 関係するファイル（第1段階）

```
infra/
├── versions.tf                ← Terraform と AWS プロバイダーの版、記録の置き場所（S3）、札
├── variables.tf               ← 外から渡す値（自分の IP アドレス、SSH の公開鍵、EC2 の大きさ、画面側のポート）
├── network.tf                 ← デフォルト VPC とサブネットを読む（作らない）
├── security.tf                ← 門番（22番・5173番を、自分の IP からだけ）
├── compute.tf                 ← EC2・SSH の公開鍵
├── outputs.tf                 ← 作ったあとに表示する値
├── terraform.tfvars.example   ← 外から渡す値の見本（GitHub に上げる）
├── terraform.tfvars           ← 外から渡す本物の値（GitHub に上げない）
└── .terraform.lock.hcl        ← プロバイダーの版の記録（Terraform が作る。GitHub に上げる）
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

- このバケットは Terraform の外で作るので、`terraform destroy` では消えません。次の段階でも使うので、残しておきます
- バケットの名前にアカウント ID が入るので、名前はコードに書かず、1-4 で渡します

### 1-3. 外から渡す値を書く

1. `infra/terraform.tfvars.example` をコピーして、同じ場所に `infra/terraform.tfvars` という名前で置きます

   ```powershell
   Copy-Item infra\terraform.tfvars.example infra\terraform.tfvars
   ```

2. 自分のパソコンの IP アドレスを調べます

   ```powershell
   (Invoke-RestMethod https://checkip.amazonaws.com).Trim()
   ```

3. `infra/terraform.tfvars` を開き、`my_ip` を 2. で調べた IP アドレスに書きかえて保存します

`terraform.tfvars` は `.gitignore` に入っているので、GitHub には上がりません。

### 1-4. Terraform の準備をする（init）

```powershell
$account = aws sts get-caller-identity --query Account --output text
terraform -chdir=infra init -backend-config="bucket=kakeibo-tfstate-$account"
```

`Terraform has been successfully initialized!` と出れば準備できています。

---

## 2. Terraform で EC2 を作る

### 2-1. 何が作られるか確かめる（plan）

```powershell
terraform -chdir=infra plan '-out=kakeibo.tfplan'
```

- `'-out=kakeibo.tfplan'` は、**引用符（`'`）で囲みます**。囲まないと、PowerShell が `.` のところで2つに分けてしまい、`Error: Too many command line arguments` になります（2026年11月4日に実際に起きました）
- **AWS には何も作られません**。作るものの一覧が表示されるだけです
- 最後の行が `Plan: 6 to add, 0 to change, 0 to destroy.` になっていることを確かめます（SSH の鍵、門番、門番の入口2つ・出口1つ、EC2）
- 門番の入口（`aws_vpc_security_group_ingress_rule`）の `cidr_ipv4` が、**自分の IP アドレス/32** になっていることを確かめます（`0.0.0.0/0` ではないこと）
- `-out=kakeibo.tfplan` で、確かめた内容をファイルに残します。次の `apply` で、**確かめたとおりのもの**だけが作られます

### 2-2. 本当に作る（apply）

> **ここからお金がかかり始めます**（1日約 0.15 ドル。無料プランのクレジットから引かれます）。確かめが終わったら、5章ですぐ消します。

```powershell
terraform -chdir=infra apply kakeibo.tfplan
Remove-Item infra\kakeibo.tfplan
```

- 1〜2分で終わります。終わると、次のような値が表示されます（あとからでも `terraform -chdir=infra output` で見られます）

  | 値 | 意味 |
  |---|---|
  | `public_ip` | EC2 の公開の住所（止めて動かすと変わる） |
  | `ssh_command` | EC2 に SSH で入るコマンド |
  | `frontend_url` | 第4段階で画面側を入れたあとに開くアドレス（今はまだ開けない） |
  | `instance_id` | EC2 の番号 |

## 3. EC2 に SSH で入って確かめる

EC2 は、作ってから起動するまで1分ほどかかります。

```powershell
$ip = terraform -chdir=infra output -raw public_ip
ssh -i "$HOME\.ssh\kakeibo-ec2" ec2-user@$ip
```

- 初めてつなぐときは `Are you sure you want to continue connecting (yes/no/[fingerprint])?` と聞かれるので、半角で `yes` と打ちます
- 入れたら、次のコマンドで確かめます

  ```bash
  cat /etc/os-release | head -n 2   # Amazon Linux 2023 と出ればよい
  uname -m                          # aarch64（Arm）と出ればよい
  df -h /                           # ディスクが 8GB ほど
  exit                              # EC2 から出る
  ```

- 自分のパソコン以外からは入れないことも確かめます（入口が自分の IP アドレスだけで、`0.0.0.0/0` がないこと）

  ```powershell
  aws ec2 describe-security-groups --filters Name=group-name,Values=kakeibo-app --query "SecurityGroups[].IpPermissions[].[FromPort,IpRanges[].CidrIp]" --output json
  ```

  `22` と `5173` の2つだけが、自分の IP アドレス（`…/32`）で出れば大丈夫です

## 4. 自分の IP アドレスが変わったとき

家のネットの契約によっては、IP アドレスが変わることがあります。変わると、SSH でつながらなくなります（`Connection timed out`）。

1. 1-3 の 2. で、今の IP アドレスを調べます
2. `infra/terraform.tfvars` の `my_ip` を書きかえます
3. 門番の入口だけが変わることを確かめてから、変えます

   ```powershell
   terraform -chdir=infra plan '-out=kakeibo.tfplan'
   terraform -chdir=infra apply kakeibo.tfplan
   Remove-Item infra\kakeibo.tfplan
   ```

   plan に出るのが `aws_vpc_security_group_ingress_rule` の2つだけであることを確かめます

## 5. 片付け（確かめが終わったら）

> EC2 が消えます。EC2 の中に入れたものも消えます。次の段階に進むときは、2章からもう一度作ります（Terraform なので、同じものがすぐできます）。

1. Terraform で作ったものを消します。消すものの一覧が出るので、確かめてから `yes` と打ちます。デフォルト VPC は Terraform で作ったものではないので消えません

   ```powershell
   terraform -chdir=infra destroy
   ```

2. 家計簿のものが残っていないか確かめます（S3 バケットだけが出れば大丈夫です）

   ```powershell
   aws resourcegroupstaggingapi get-resources --tag-filters Key=Project,Values=kakeibo --query "ResourceTagMappingList[].ResourceARN"
   ```

- S3 バケット（Terraform の記録）と SSH の鍵は、次の段階で使うので残します
- 講師の確認まで全部終わって、もう作り直さないときの片付け（S3 バケットを消すなど）は、最後の段階で書き足します

## 6. 困ったとき

| 起きたこと | 考えられる原因 | どうするか |
|---|---|---|
| `terraform` で `No valid credential sources found`・`ExpiredToken` | ログインの期限切れ、または `$env:AWS_PROFILE` の指定忘れ | 「毎回、最初にすること」を行う |
| `terraform` で `Failed to load plugin schemas` | Norton が割り込んでいる | [AWS の認証設定の手順書](06_AWSの認証設定の手順書.md) の 8章 |
| `terraform init` で、バケットが見つからない | 1-2 のバケットを作っていない、または名前が違う | 1-2 を行う。`-backend-config` のバケット名を確かめる |
| `plan` で `Error: Too many command line arguments` | `-out=kakeibo.tfplan` を引用符で囲んでいない（PowerShell が `.` で分けてしまう） | `'-out=kakeibo.tfplan'` のように `'` で囲む |
| `plan` で `my_ip` のエラー | `terraform.tfvars` に IP アドレスが書かれていない、または形が違う | 1-3 を行う（`/32` は付けない） |
| `ssh` で `Connection timed out` | 自分の IP アドレスが変わった、または EC2 がまだ起動していない | 1分ほど待つ。それでもだめなら 4章 |
| `ssh` で `Permission denied (publickey)` | 秘密鍵の場所が違う、または利用者の名前が違う | `-i "$HOME\.ssh\kakeibo-ec2"` と `ec2-user@` を確かめる |
| `ssh` で `REMOTE HOST IDENTIFICATION HAS CHANGED` | EC2 を作り直して、住所が前と同じになった | `ssh-keygen -R （public_ip）` で古い鍵を忘れさせてから、つなぎ直す |

## 7. 確かめた記録

| 日付 | 確かめたこと | 結果 |
|---|---|---|
| 2026年11月4日 | 第1段階の Terraform のファイルの `validate`・`fmt -check` | 合格（AWS には何もしていない） |
| 2026年11月4日 | 1章：SSH の鍵・S3 バケット（前の版に戻せる・公開しない・暗号化）・`terraform.tfvars`・`init` | できた |
| 2026年11月4日 | 2章：`plan` → `apply` | `Plan: 6 to add`。門番の入口は 22番・5173番とも `（自分の IP）/32` だけ。`apply` で6つとも作れた（EC2 は13秒）。途中で `-out=kakeibo.tfplan` を引用符で囲まずにエラーになった → 手順書を直した |
| 2026年11月4日 | 3章：SSH で入る | 入れた（`ec2-user`）。Amazon Linux 2023・`aarch64`（Arm）・ディスク 8.0G・メモリ 1.8Gi。Node.js はまだ入っていない（第2段階で入れる） |
| 2026年11月4日 | 3章：門番 | AWS から読み取って、入口が 22番・5173番の2つだけ・どちらも `（自分の IP）/32` であることを確認。3000番・80番には、自分のパソコンからもつながらない |
