# AWS への公開の手順書

このアプリを、**AWS CLI と Terraform** で AWS に作り、アプリを載せて公開し、終わったら消す手順です。マネジメントコンソールは使いません。
コマンドは、VS Code の画面下のターミナル（PowerShell）で、**プロジェクトの一番上のフォルダ**（`syokyu-kadai`）で入力します。

> - どんな形で AWS に置くか（インフラ構成図・主な設定）は [構成設計書](../02_設計/07_構成設計書.md) を参照してください
> - AWS へのログインのしかたは [AWS の認証設定の手順書](06_AWSの認証設定の手順書.md)、言葉や考え方は [AWS と Terraform の基礎知識](05_AWSとTerraformの基礎知識.md) を参照してください

## 0. この手順書でやること

| 章 | すること | AWS が変わるか | お金 |
|---|---|---|---|
| 1 | 毎回、最初にすること（ログイン） | 変わらない | — |
| 2 | はじめの1回だけの準備 | S3 バケットを1つ作る | ほぼ 0 円 |
| 3 | 作って、アプリを載せて、公開する（3行） | **作る** | **1日約 0.85 ドル**（クレジットから） |
| 4 | 確かめる | 変わらない | — |
| 5 | 直したアプリを載せ替える | EC2 の中が変わる | — |
| 6 | 自分の IP アドレスが変わったとき | 門番を変える | — |
| 7 | 片付け | **消える** | 止まる |
| 8 | 困ったとき | — | — |

---

## 1. 毎回、最初にすること

```powershell
$env:AWS_PROFILE = "kakeibo"
aws sts get-caller-identity --query Arn --output text
```

`…:user/admin-user` と出れば大丈夫です。`ExpiredToken` などのエラーが出たら、ブラウザで AWS のコンソールに **admin-user** でログインしてから、`aws login --profile kakeibo` でログインし直します。

## 2. はじめの1回だけの準備

一度済ませれば、作り直すときにはもう要りません。

1. **SSH の鍵を作る**（秘密鍵はパソコンにだけ置き、誰にも渡さない）

   ```powershell
   ssh-keygen -t ed25519 -f "$HOME\.ssh\kakeibo-ec2" -C "kakeibo-ec2"
   ```

   パスフレーズを聞かれたら、何も入れずに Enter を2回押します。

2. **Terraform の記録（ステート）を置く S3 バケットを作る**（Terraform の外で作るので、`destroy` では消えない）

   ```powershell
   $account = aws sts get-caller-identity --query Account --output text
   $bucket = "kakeibo-tfstate-$account"
   aws s3api create-bucket --bucket $bucket --region ap-northeast-1 --create-bucket-configuration LocationConstraint=ap-northeast-1
   aws s3api put-bucket-versioning --bucket $bucket --versioning-configuration Status=Enabled
   aws s3api put-public-access-block --bucket $bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   aws s3api put-bucket-tagging --bucket $bucket --tagging 'TagSet=[{Key=Project,Value=kakeibo},{Key=ManagedBy,Value=aws-cli}]'
   ```

3. **外から渡す値を書く**：`infra/terraform.tfvars.example` を `infra/terraform.tfvars` にコピーし、2つの値を書きかえます（`terraform.tfvars` は GitHub に上がりません）

   ```powershell
   Copy-Item infra\terraform.tfvars.example infra\terraform.tfvars
   (Invoke-RestMethod https://checkip.amazonaws.com).Trim()   # 自分のパソコンの IP アドレス
   ```

   | 項目 | 書くもの |
   |---|---|
   | `my_ip` | 自分のパソコンの IP アドレス（SSH で EC2 に入ってよい場所。`/32` は付けない） |
   | `alert_email` | 予算をこえそうなときに知らせるメールアドレス |

4. **Terraform の準備（init）**

   ```powershell
   $account = aws sts get-caller-identity --query Account --output text
   terraform -chdir=infra init -backend-config="bucket=kakeibo-tfstate-$account"
   ```

5. **予算が家計簿のものだけを数えるための準備**（3章で一度作ったあと。2026年11月6日に済ませた）

   ```powershell
   aws ce update-cost-allocation-tags-status --region us-east-1 --cost-allocation-tags-status TagKey=Project,Status=Active
   ```

   札 `Project` の付いたものを作ってから、この命令が通るようになるまで最大1日かかります。一度有効にすれば、作り直しても有効のままです。

## 3. 作って、アプリを載せて、公開する

```powershell
terraform -chdir=infra plan '-out=kakeibo.tfplan'
terraform -chdir=infra apply kakeibo.tfplan
.\infra\deploy.ps1
```

| 行 | すること | かかる時間 |
|---|---|---|
| 1 | 何が作られるかを確かめる（**AWS には何も作られない**）。最後が `Plan: 15 to add, 0 to change, 0 to destroy.` であること、門番の入口が「22番は自分の IP/32」「80番は CloudFront の住所の一覧（`pl-…`）」「3306番は EC2 の門番」だけであることを確かめる | 1分ほど |
| 2 | 本当に作る（**ここからお金がかかる**） | 15分ほど（RDS が10分ほど） |
| 3 | アプリを載せる（GitHub の `develop` を取ってくる → 部品を入れる → RDS に利用者・テーブル・お試しデータ（ないときだけ）→ 処理側を systemd で起動 → 画面を組み立てて nginx に置く → 自分のパソコンから確かめる） | 2〜3分 |

- `'-out=kakeibo.tfplan'` は、**引用符（`'`）で囲みます**（囲まないと、PowerShell が `.` で2つに分けてエラーになる）
- 最後に `載せ終わりました：https://（ランダムな文字）.cloudfront.net/` と出れば成功です。**このアドレスが公開のアドレス**です（あとからでも `terraform -chdir=infra output -raw app_url` で見られる）
- **CloudFront のアドレスは、作り直すたびに変わります。** 講師に伝えたら、講師の確認が終わるまで消しません
- 終わったら `Remove-Item infra\kakeibo.tfplan` で、使った plan のファイルを消します

## 4. 確かめる

```powershell
$url = terraform -chdir=infra output -raw app_url
$ip = terraform -chdir=infra output -raw public_ip
foreach ($p in '', 'categories', 'yearly?year=2026') { "/$p : $((Invoke-WebRequest "$url$p" -UseBasicParsing).StatusCode)" }   # どれも 200
Invoke-RestMethod "${url}api/health"                                                                                         # status ok
$c = New-Object Net.Sockets.TcpClient; "EC2 の 80番に直接: $($c.ConnectAsync($ip, 80).Wait(4000))"; $c.Close()              # False（CloudFront からだけ）
```

そのあと、ブラウザで公開のアドレスを開き、記録一覧（お試しデータ）・年間の集計・カテゴリの設定の画面が出ること、登録・修正・削除ができることを確かめます。スマートフォンで Wi-Fi を切って（携帯の回線で）開くと、自分のパソコン以外からも開けることを確かめられます。

EC2 の中を見るとき（SSH）：

```powershell
ssh -i "$HOME\.ssh\kakeibo-ec2" "ec2-user@$(terraform -chdir=infra output -raw public_ip)"
```

```bash
systemctl is-active nginx kakeibo-backend            # active が2つ
sudo journalctl -u kakeibo-backend -n 20 --no-pager  # 処理側の記録
exit
```

## 5. 直したアプリを載せ替える

1. 直したら、PR を作って `develop` にマージします（EC2 は GitHub の `develop` から取ってくるため、**GitHub に入ったものしか載らない**）
2. `deploy.ps1` をもう一度動かします（データベースの中身はそのまま残ります）

   ```powershell
   .\infra\deploy.ps1
   ```

   - ほかのブランチを確かめたいときは `.\infra\deploy.ps1 -Branch ブランチの名前`
   - 組み立てたファイル以外（`index.html` など）は CloudFront にためないので、載せ替えたらすぐ反映されます

### お試しデータを最初の状態に戻す

講師に確認をお願いする前と、データがおかしくなったときに行います。**今の記録とカテゴリは消えます。**

```powershell
.\infra\deploy.ps1 -ResetData
```

- 途中で `yes` と入力すると、記録とカテゴリを全部消してから、お試しデータ（カテゴリ17件・記録28件、**実行した日から見て**最近3か月分）を入れ直します。`yes` 以外なら何も変えずに止まります
- 手順4の最後に `カテゴリ 17件・記録 28件` と出れば戻っています

## 6. 自分の IP アドレスが変わったとき

IP アドレスが変わると、SSH でつながらなくなります（`Connection timed out`）。公開のアドレス（CloudFront）は、そのまま使えます。

1. 今の IP アドレスを調べ（2章の 3.）、`infra/terraform.tfvars` の `my_ip` を書きかえます
2. 門番の入口（22番）だけが変わることを `plan` で確かめてから、`apply` します

   ```powershell
   terraform -chdir=infra plan '-out=kakeibo.tfplan'
   terraform -chdir=infra apply kakeibo.tfplan
   ```

## 7. 片付け

> EC2・RDS・CloudFront・予算などが消えます。**RDS のデータも戻せません。** 講師にアドレスを伝えているときは、講師の確認が終わってから行います。

1. Terraform で作ったものを消します。消すものの一覧（`15 to destroy`）を確かめてから `yes` と打ちます（CloudFront を消すのに3分ほど）。デフォルト VPC は消えません

   ```powershell
   terraform -chdir=infra destroy
   ```

2. 残っていないかを確かめます（`state list` は何も出ない、RDS は `DBInstanceNotFound`）

   ```powershell
   terraform -chdir=infra state list
   aws rds describe-db-instances --db-instance-identifier kakeibo-db --query "DBInstances[].DBInstanceStatus" --output text
   ```

   札で探す `aws resourcegroupstaggingapi get-resources` は、消した直後もしばらく古いものが出てきます（反映に時間がかかるため）

3. **（講師の確認まで全部終わって、もう作り直さないときだけ）** S3 バケットを消します。前の版も残しているので、版ごと消してからバケットを消します

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

## 8. 困ったとき

| 起きたこと | 考えられる原因 | どうするか |
|---|---|---|
| `ExpiredToken`・`No valid credential sources found` | ログインの期限切れ（最長12時間）、または `$env:AWS_PROFILE` の指定忘れ | 1章を行う |
| `terraform` で `Failed to load plugin schemas` | Norton が、Terraform と部品のあいだの通信に割り込んでいる | Norton の［セーフ ウェブ］→［除外］に `127.0.0.1` を入れる（[AWS の認証設定の手順書](06_AWSの認証設定の手順書.md) の 8章） |
| `plan` で `Error: Too many command line arguments` | `-out=kakeibo.tfplan` を引用符で囲んでいない | `'-out=kakeibo.tfplan'` と書く |
| `plan` で `my_ip`・`alert_email` のエラー | `terraform.tfvars` の値がない、または形が違う | 2章の 3. を行う |
| `ssh` で `Connection timed out` | 自分の IP アドレスが変わった、または EC2 がまだ起動していない | 1分ほど待つ。それでもだめなら 6章 |
| `ssh` で `REMOTE HOST IDENTIFICATION HAS CHANGED` | 作り直した EC2 が、前と同じ住所になった | `ssh-keygen -R （EC2 の住所）` で古い鍵を忘れさせてから、つなぎ直す |
| `deploy.ps1` が「EC2 の中の手順が失敗しました」で止まる | 手順 1〜6 のどこかで失敗した | 表示された最後の「=== 〇. …」のところを見る。直したら、もう一度動かす（何度動かしてもよい） |
| 「準備中です。アプリの画面はまだ置かれていません。」と出る | まだ `deploy.ps1` を動かしていない | 3章の3行目を動かす |
| 公開のアドレスで 502・504 | CloudFront から EC2 に届いていない（nginx が止まっている など） | EC2 で `systemctl is-active nginx`。`plan` で差がないか確かめ、あれば `apply` |
| 画面は出るが「サーバーとの通信に失敗しました」 | 処理側が止まっている、または RDS につながっていない | EC2 で `sudo journalctl -u kakeibo-backend -n 30` を見る。`deploy.ps1` をもう一度動かす |
| `http://（EC2 の住所）/` が開けない | EC2 の 80番は CloudFront からだけ通す決まり | 公開のアドレス（`app_url`）で開く |
| EC2 の中で `pkill` を打ったら SSH が切れた | `pkill -f vite` のような書き方が、SSH で送ったコマンドの文字にも当たった | `pkill -f "[n]ode .*vite"` のように、最初の1文字を `[ ]` で囲む |

> EC2 の起動の準備（Node.js・mysql コマンド・nginx など）でつまずいたこと（Node.js が使う部品 libatomic がない、mysql コマンドの置き場所が見つからない）は、`infra/user_data.sh.tftpl` で直してあります。どの段階でどう作ったかは、[構成設計書](../02_設計/07_構成設計書.md) の 11章にあります。
