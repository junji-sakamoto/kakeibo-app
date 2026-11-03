# AWS の認証設定の手順書

自分のパソコンから、**コマンド（AWS CLI と Terraform）で AWS を操作できるようにする**手順です。
コマンドは、VS Code の画面下のターミナル（PowerShell）で入力します。

> 言葉や考え方（AWS・IaC・Terraform・一時的な鍵 など）は、先に [AWS と Terraform の基礎知識](05_AWSとTerraformの基礎知識.md) を読んでください。

## 0. この手順書でやること

| 章 | すること | AWS が変わるか | お金 |
|---|---|---|---|
| 1 | 道具（AWS CLI・Terraform）の版を確かめる | 変わらない | かからない |
| 2 | 古い鍵が環境変数に入っていないか確かめる | 変わらない | かからない |
| 2-2 | Norton を使っているときの証明書の一覧を用意する | 変わらない | かからない |
| 3 | `aws login` で、一時的な鍵を使うプロファイル `kakeibo` を作る | 変わらない | かからない |
| 4 | AWS CLI でつながったか確かめる | 変わらない | かからない |
| 5 | 毎回の使い方（ログイン・ログアウト） | 変わらない | かからない |
| 6 | Terraform からつながるか確かめる（読むだけ） | 変わらない | かからない |
| 7 | 長く使える鍵（アクセスキー）を止める | **変わる**（鍵が使えなくなる） | かからない |
| 8 | 困ったとき | — | — |

1〜6 章はどれも「確かめる・読む」だけで、**AWS に何かを作ることはなく、お金もかかりません**。

### 決めたこと

| 項目 | 決めたこと | 理由 |
|---|---|---|
| ログインのしかた | **`aws login`**（ブラウザでログインして、最長12時間使える一時的な鍵をもらう） | 長く使える鍵をパソコンに置かなくてよい。今ある IAM ユーザーと多要素認証（MFA）をそのまま使える |
| 使う IAM ユーザー | 今ある **`admin-user`** | すでに管理者の権限と多要素認証（MFA）が付いている |
| プロファイルの名前 | **`kakeibo`** | 別のプロジェクトが使っている `default` と混ざらないようにする |
| リージョン | **`ap-northeast-1`（東京）** | 日本から近い |
| 証明書の一覧 | **Norton の証明書を足した一覧**（`C:\Users\坂本　順治\.aws\kakeibo-ca-bundle.pem`）を、ユーザーの環境変数 `AWS_CA_BUNDLE` で AWS CLI と Terraform に渡す | Norton が AWS のログインの通信に割り込むため（2-2 章） |
| Norton の除外 | セーフ ウェブの除外に **`127.0.0.1`** を入れる | Norton が、Terraform とプロバイダーの間の通信（パソコンの中だけの通信）にも割り込むため（8章） |

### 始める前の状態（2026年11月3日に確かめた結果）

| 項目 | 状態 |
|---|---|
| AWS CLI | 2.38.6（入っている。`aws login` は 2.32.0 から使えるので大丈夫） |
| Terraform | 1.16.6（入っている。`aws login` の鍵を Terraform で使うには 1.15.0 以上が必要なので大丈夫） |
| `default` プロファイル | `admin-user` の**長く使える鍵**（アクセスキー、2026年10月27日に作成）が `C:\Users\坂本　順治\.aws\credentials` に保存されている |
| `admin-user` | 管理者の権限（`AdministratorAccess`）あり、多要素認証（MFA）あり |
| 別のプロジェクト | taskmanagement の EC2・RDS（停止中）と、ステート用の S3 バケットがある。**家計簿アプリとは関係ないので触らない** |

---

## 1. 道具の版を確かめる

```powershell
aws --version
terraform version
```

| 道具 | 必要な版 | 表示の例 |
|---|---|---|
| AWS CLI | **2.32.0 以上**（`aws login` を使うため） | `aws-cli/2.38.6 Python/3.14.8 Windows/11 exe/AMD64` |
| Terraform | **1.15.0 以上** | `Terraform v1.16.6` |

どちらも足りていれば、次の章へ進みます。新しい版にしたいときは、次のコマンドで更新できます（どちらも winget で入っています）。

```powershell
winget upgrade --id Amazon.AWSCLI --source winget
winget upgrade --id Hashicorp.Terraform --source winget
```

> 版を変えたら、[開発環境と版の一覧](00_開発環境と版の一覧.md) の表と「変更の記録」も直します。

## 2. 古い鍵が環境変数に入っていないか確かめる

環境変数（パソコン全体の設定）に鍵が入っていると、**プロファイルの設定より優先されて**しまいます。入っていないことを確かめます。

```powershell
Get-ChildItem env:AWS*
```

- **何も表示されなければ大丈夫**です
- `AWS_ACCESS_KEY_ID` や `AWS_SECRET_ACCESS_KEY` が表示されたら、そのターミナルでは次のコマンドで消してから進みます（パソコン全体の設定に入っている場合は、Windows の［システムの詳細設定］→［環境変数］から消します）

  ```powershell
  $env:AWS_ACCESS_KEY_ID = $null
  $env:AWS_SECRET_ACCESS_KEY = $null
  $env:AWS_SESSION_TOKEN = $null
  ```

## 2-2. Norton を使っているとき（証明書の一覧を用意する）

このパソコンには Norton（ウイルス対策ソフト）が入っています。Norton は、暗号化された通信の中身を確かめるために、**通信の途中で証明書（相手が本物だと示す身分証）を Norton のものに差しかえる**ことがあります。

2026年11月3日に確かめたところ、`aws login` が使う `signin.aws.amazon.com` への通信の証明書が、**Norton Web/Mail Shield Root** のものに差しかえられていました。Windows は Norton の証明書を信頼していますが、AWS CLI は自分専用の証明書の一覧を使うので、Norton の証明書を知りません。そのため、次のエラーで止まります。

```
aws: [ERROR]: SSL validation failed for https://ap-northeast-1.signin.aws.amazon.com/v1/token [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate
```

そこで、**AWS CLI の証明書の一覧に Norton の証明書を足したファイル**を作り、環境変数 `AWS_CA_BUNDLE` で「この一覧を使ってね」と伝えます。

```powershell
# ① AWS CLI の証明書の一覧と、Norton の証明書をつなげて、1つのファイルにする
$bundle = "$HOME\.aws\kakeibo-ca-bundle.pem"
Get-Content "C:\Program Files\Amazon\AWSCLIV2\awscli\botocore\cacert.pem","C:\ProgramData\Norton\Antivirus\wscert.pem" | Set-Content -Encoding ascii $bundle

# ② ①のファイルの場所を、ユーザーの環境変数として Windows に覚えさせる（1回だけ）
[Environment]::SetEnvironmentVariable("AWS_CA_BUNDLE", $bundle, "User")

# ③ kakeibo プロファイルのリージョンを設定する
aws configure set region ap-northeast-1 --profile kakeibo
```

- ②の設定は、**このあと開いたターミナルから**有効になります。いま開いているターミナルでも使うときは、`$env:AWS_CA_BUNDLE = $bundle` も打ちます
- **プロファイルの設定（`aws configure set ca_bundle`）では渡しません**。AWS CLI は設定ファイルを Shift_JIS という文字コードで書き、Terraform は UTF-8 として読むので、場所の日本語（坂本　順治）が文字化けして、Terraform が `open C:\Users\���{...\kakeibo-ca-bundle.pem: The system cannot find the path specified.` というエラーで止まります（2026年11月3日に実際に起きました）。環境変数なら文字化けしません
- 別のプロジェクト（taskmanagement）の AWS CLI・Terraform も、この一覧を使うようになります。中身はふつうの証明書の一覧に Norton の証明書を足しただけなので、困ることはありません
- **AWS CLI を更新したら**、①をもう一度実行して、証明書の一覧を新しくします
- 元に戻すとき：`[Environment]::SetEnvironmentVariable("AWS_CA_BUNDLE", $null, "User")`
- Norton を使っていないパソコンでは、この章は要りません

## 3. `aws login` でプロファイル `kakeibo` を作る

> **始める前に**：ブラウザで AWS のコンソールを開き、**IAM ユーザー `admin-user` でログインしておきます**（右上に `admin-user @ （アカウントID）` のように出ている状態）。`aws login` は、ブラウザでログイン中の人をそのまま使います。**ルートユーザーでログインしたままだと、ルートユーザーの鍵になってしまいます**（2026年11月3日に実際に起きました）。右上の名前を押して、ルートユーザーのログインが残っていたら［サインアウト］しておきます。
>
> コマンドを打つときは、**日本語入力をオフ（半角）**にしておきます。全角の「ｙ」では、`y/n` の質問に答えられません。

1. ターミナルで次のコマンドを打ちます

   ```powershell
   aws login --profile kakeibo
   ```

2. リージョンを聞かれたら、**`ap-northeast-1`** と打って Enter を押します（2-2 章で設定ずみなら聞かれません）

   ```
   AWS Region [us-east-1]: ap-northeast-1
   ```

3. ターミナルに表示された **`https://...signin...` で始まる URL をコピー**し、admin-user でログインしているブラウザの新しいタブに貼り付けて開きます
   - 別のブラウザが自動で開いたときは、そちらは閉じてかまいません（パスキーがそのブラウザにないと、「一致するパスキーは存在しません」と出ます）

4. 「AWS セッションを選択」の一覧で、**`admin-user`** を選びます
   - **root やメールアドレスのものは選びません**

5. ブラウザに「資格情報は正常に共有されており…このタブを閉じてください」と出たら、タブを閉じてターミナルに戻ります

6. 前にほかの人（例：ルートユーザー）でログインしていたときは、次のように聞かれるので、半角の **`y`** と打って Enter を押します

   ```
   Profile kakeibo is already configured to use session arn:aws:iam::（アカウントID）:root.
   Do you want to overwrite it to use arn:aws:iam::（アカウントID）:user/admin-user instead? (y/n):
   ```

7. ターミナルに次のように出れば完了です

   ```
   Updated profile kakeibo to use arn:aws:iam::（アカウントID）:user/admin-user credentials.
   ```

8. 設定ファイルに次のように書き足されます（`C:\Users\坂本　順治\.aws\config`）

   ```ini
   [profile kakeibo]
   region = ap-northeast-1
   login_session = arn:aws:iam::（アカウントID）:user/admin-user
   ```

   - **鍵そのものはこのファイルには書かれません**。一時的な鍵は `C:\Users\坂本　順治\.aws\login\cache` に保存され、最長12時間で使えなくなります

> ブラウザでは成功と出たのに、ターミナルが待ったままのときは、`Ctrl` ＋ `C` で止めて `aws login --profile kakeibo --remote` でやり直します。ブラウザに出るコード（文字の並び）を、ターミナルに貼り付ける方法です。

## 4. AWS CLI でつながったか確かめる

```powershell
aws sts get-caller-identity --profile kakeibo
```

次のように表示されれば成功です（`sts get-caller-identity` は「今の鍵は誰のものか」を聞くだけの命令で、何も変えません）。

```json
{
    "UserId": "AIDA...",
    "Account": "（12けたのアカウントID）",
    "Arn": "arn:aws:iam::（アカウントID）:user/admin-user"
}
```

| 確かめるところ | 正しい値 |
|---|---|
| `Arn` の最後 | `user/admin-user`（`root` になっていたら、ルートユーザーでログインしてしまっている → 3章をやり直す） |

あわせて、鍵の種類が「一時的な鍵」になっていることも確かめます。

```powershell
aws configure list --profile kakeibo
```

`access_key` の行の `TYPE` が **`login`** になっていれば、`aws login` の一時的な鍵が使われています（2026年11月3日に確認）。`shared-credentials-file` になっていたら、長く使える鍵が使われています（→ 8章）。

## 5. 毎回の使い方

### 5-1. 作業を始めるとき

ターミナルを開くたびに、**このターミナルでは `kakeibo` プロファイルを使う**と指定します。

```powershell
$env:AWS_PROFILE = "kakeibo"
aws sts get-caller-identity
```

- `$env:AWS_PROFILE` を指定すると、`--profile kakeibo` を毎回付けなくてよくなります。**Terraform もこの指定を読みます**
- この指定は、**そのターミナルを閉じると消えます**（別のプロジェクトのターミナルに影響しないので安全）
- `ExpiredToken`（期限切れ）などのエラーが出たら、12時間が過ぎています。もう一度ログインします

  ```powershell
  aws login --profile kakeibo
  ```

### 5-2. 作業を終えるとき

```powershell
aws logout --profile kakeibo
```

一時的な鍵がパソコンから消えます（何もしなくても、最長12時間で使えなくなります）。

## 6. Terraform からつながるか確かめる（読むだけ）

Terraform が `aws login` の一時的な鍵を使えるかを、**何も作らない小さな設定**で確かめます。
本番用の Terraform のファイルとは別に、プロジェクトの外に一時的なフォルダを作って試します。

1. フォルダを作って移動します

   ```powershell
   New-Item -ItemType Directory -Force "$HOME\tf-login-check"
   Set-Location "$HOME\tf-login-check"
   ```

2. そのフォルダに `main.tf` という名前のファイルを作り、次の内容を書いて保存します

   ```hcl
   # 何も作らず、「今の鍵は誰のものか」を読むだけの設定
   terraform {
     required_version = ">= 1.15.0"

     required_providers {
       aws = {
         source  = "hashicorp/aws"
         version = ">= 6.23.0" # aws login の鍵を使えるのは 6.23.0 から
       }
     }
   }

   provider "aws" {
     region = "ap-northeast-1"
   }

   # データソース：AWS にあるものの情報を読むだけ（作らない）
   data "aws_caller_identity" "me" {}

   output "arn" {
     value = data.aws_caller_identity.me.arn
   }
   ```

3. プロファイルを指定して、準備（init）と確認（plan）をします

   ```powershell
   $env:AWS_PROFILE = "kakeibo"
   terraform init
   terraform plan
   ```

4. 次のように、`user/admin-user` が表示されれば成功です

   ```
   Changes to Outputs:
     + arn = "arn:aws:iam::（アカウントID）:user/admin-user"
   ```

   - `plan` は表示するだけなので、AWS には何も作られません（`apply` はしません）

5. 確かめ終わったら、元のフォルダに戻って、試したフォルダ `C:\Users\坂本　順治\tf-login-check` をエクスプローラーで削除します

   ```powershell
   Set-Location "$HOME\syokyu-kadai"
   ```

## 7. 長く使える鍵（アクセスキー）を止める

`aws login` で作業できるようになったら、`default` プロファイルに保存されている**長く使える鍵は、もう要りません**。漏れたときの危険をなくすため、止めて、消します。

> **注意**：この鍵は、別のプロジェクト（taskmanagement）でも使っているかもしれません。止めると、そちらのコマンドも動かなくなります。**そちらも `aws login` に切りかえてから**行ってください。この章は、AWS の設定を変える操作なので、**急がず、自分で判断してから**行います。

1. 鍵の ID（`AKIA` で始まる）を確かめます

   ```powershell
   aws iam list-access-keys --user-name admin-user --profile kakeibo
   ```

2. まず**止めるだけ**にします（あとで元に戻せます）。`<鍵のID>` は 1. で確かめた ID に置きかえます

   ```powershell
   aws iam update-access-key --user-name admin-user --access-key-id <鍵のID> --status Inactive --profile kakeibo
   ```

3. 数日、ふだんどおり作業して困らないことを確かめます（困ったら `--status Active` で元に戻せます）

4. 困らなければ、**消します**（消すと元に戻せません）

   ```powershell
   aws iam delete-access-key --user-name admin-user --access-key-id <鍵のID> --profile kakeibo
   ```

5. `C:\Users\坂本　順治\.aws\credentials` をメモ帳などで開き、`[default]` の `aws_access_key_id` と `aws_secret_access_key` の行を消して保存します

## 8. 困ったとき

| 起きたこと | 考えられる原因 | どうするか |
|---|---|---|
| `aws: error: argument command: Invalid choice` と出て `login` が使えない | AWS CLI が古い（2.32.0 より前） | 1章のコマンドで AWS CLI を更新する |
| `SSL validation failed ... CERTIFICATE_VERIFY_FAILED` | Norton が証明書を差しかえている | 2-2 章の証明書の一覧を用意する（AWS CLI を更新したあとは作り直す）。`AWS_CA_BUNDLE` を登録する前から開いていたターミナルなら、ターミナルを開き直す |
| Terraform で `open C:\Users\���{...\kakeibo-ca-bundle.pem` | プロファイルに `ca_bundle` を書いていて、日本語が文字化けしている | `ca_bundle` の行を消して、2-2 章のとおり環境変数 `AWS_CA_BUNDLE` で渡す |
| ブラウザで「一致するパスキーは存在しません」 | パスキーが、開いたブラウザやパソコンの中にない | パスキーの画面で「iPhone、iPad、または Android デバイス」を選び、QR コードを iPhone で読み取る。ふだん AWS に入るブラウザで URL を開く |
| パスキーで、どうしても admin-user に入れない | パスキーが iPhone にきちんと保存されていない | ルートユーザーでコンソールに入り、IAM → ユーザー → admin-user → ［セキュリティ認証情報］で、パスキーを登録し直す（2026年11月3日に実際に行った） |
| `aws sts get-caller-identity` の最後が `:root` | ブラウザでルートユーザーでログインしていて、その鍵をもらってしまった | `aws logout --profile kakeibo` で消し、ブラウザで admin-user でログインし直してから、3章をやり直す |
| `y/n` に答えても進まない | 全角の「ｙ」を打っている | ［半角/全角］キーで日本語入力をオフにして、半角の `y` を打つ |
| ブラウザでは成功したのに、ターミナルが待ったまま | ブラウザからターミナルへの受け渡しが届いていない | `Ctrl` ＋ `C` で止めて、`aws login --profile kakeibo --remote` でやり直す |
| ブラウザで `AccessDenied` などと出てログインできない | `admin-user` に `aws login` の権限がない | 今の `admin-user` は管理者の権限があるので起きないはず。起きたら、`SignInLocalDevelopmentAccess` というポリシーを付ける |
| `aws sts get-caller-identity` で `user/admin-user` ではない名前が出る | 環境変数の鍵や、別のプロファイルが使われている | 2章で環境変数を確かめる。`--profile kakeibo` を付け忘れていないか確かめる |
| `aws configure list` の `TYPE` が `shared-credentials-file` | `kakeibo` ではなく `default` の長く使える鍵が使われている | `--profile kakeibo`（または `$env:AWS_PROFILE = "kakeibo"`）を付けて、もう一度確かめる |
| `ExpiredToken`・`The security token included in the request is expired` | 一時的な鍵の期限（最長12時間）が切れた | `aws login --profile kakeibo` でログインし直す |
| Terraform で `No valid credential sources found` | Terraform が `kakeibo` プロファイルを見ていない、またはプロバイダーが古い | `$env:AWS_PROFILE = "kakeibo"` を指定したか確かめる。`main.tf` のプロバイダーの版が `>= 6.23.0` か確かめ、`terraform init -upgrade` する |
| Terraform で `Failed to load plugin schemas`（ログに `x509: certificate signed by unknown authority`） | Norton が、Terraform とプロバイダーの間のやり取り（パソコンの中だけの通信）に割り込んでいる | 下の「Norton と Terraform」のとおり、セーフ ウェブの除外に `127.0.0.1` を入れる |

### Norton と Terraform

2026年11月3日、Claude Code の中から `terraform plan` を試したところ、AWS に問い合わせる前に、次のエラーで止まりました。

```
Error: Failed to load plugin schemas
```

くわしいログ（`$env:TF_LOG = "DEBUG"` を指定して実行）には、`tls: failed to verify certificate: x509: certificate signed by unknown authority` と出ていました。

- Terraform は、プロバイダー（AWS とやり取りする部品）を別のプログラムとして起動し、**パソコンの中だけ**で、暗号化した通信（`127.0.0.1`）でやり取りします
- このパソコンの Norton は、暗号化された通信の中身を確かめるために、**パソコンの中だけの通信（`127.0.0.1`）でも、証明書を「Norton Web/Mail Shield」のものに差しかえていました**（確認用のプログラムで、どのポートでも差しかえられることを確かめました）
- Terraform は差しかえられた証明書を見て「相手がにせもの」と判断し、プロバイダーとのやり取りを止めていました
- 自分のターミナルでも、別のプロジェクト（taskmanagement）でも、古い版のプロバイダー（6.40.0）でも、同じエラーになりました

**直し方**（2026年11月3日にこれで直りました）

1. Norton の画面を開き、**［詐欺対策］→［セーフ ウェブ］→［このデバイス］→［除外］** のタブを開きます
2. **［＋ 追加する］** を押して、**`127.0.0.1`** を追加します
   - `localhost` は追加できませんでしたが、Terraform は `127.0.0.1` でつなぐので要りません
   - この画面は「Web サイトの URL」を除外する場所です。`terraform.exe` のようなプログラムの名前を入れても効きません
3. 6章の `terraform plan` をもう一度試します

> 「ファイルのスキャン（ウイルス検査）の除外」に Terraform を入れても、この問題は直りません。通信の中身の検査（セーフ ウェブ）の除外が必要です。

---

## 9. 確かめた記録

| 日付 | 確かめたこと | 結果 |
|---|---|---|
| 2026年11月3日 | AWS CLI・Terraform の版（1章） | AWS CLI 2.38.6・Terraform 1.16.6。どちらも必要な版を満たしている |
| 2026年11月3日 | 今の鍵の持ち主（`aws sts get-caller-identity`） | `default` は `admin-user` の長く使える鍵 |
| 2026年11月3日 | Terraform のプロバイダーの起動（6章、Claude Code の中から） | Norton が原因と思われるエラーで止まった（8章）。自分のターミナルでの確認はこれから |
| 2026年11月3日 | `aws login --profile kakeibo`（3〜4章） | 最初は Norton の証明書のエラーで止まった → 2-2 章で解決。ルートユーザーの鍵をもらってしまった → ログアウトしてやり直した。admin-user のパスキーが使えなかった → 登録し直した（`iphone-passkey`）。最後に **`user/admin-user`・`TYPE` は `login`** になった |
| 2026年11月3日 | Terraform から `kakeibo` でつながるか（6章） | Claude Code の中・自分のターミナルとも、プロバイダーの起動で止まった → Norton のセーフ ウェブの除外に `127.0.0.1` を入れて解決（8章）。次に証明書の一覧の場所の文字化けで止まった → 環境変数 `AWS_CA_BUNDLE` で渡すように変えて解決（2-2 章）。最後に `terraform plan` で **`user/admin-user`** が表示された（AWS には何も作っていない） |
