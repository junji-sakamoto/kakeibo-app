# ============================================================
# Terraform と AWS プロバイダーの版、記録（ステート）の置き場所、全部に付ける札
# くわしくは docs/02_設計/07_構成設計書.md の 8章
# ============================================================

terraform {
  # Terraform 本体の版（1.16 系の 1.16.6 以上）。版を変えたら docs/03_手順書/00_開発環境と版の一覧.md も直す
  required_version = "~> 1.16.6"

  required_providers {
    aws = {
      source = "hashicorp/aws"
      # AWS とやり取りする部品の版。細かい版まで固定する（.terraform.lock.hcl にも記録される）
      version = "6.71.0"
    }
  }

  # 記録（ステート）は S3 に置く。
  # バケットの名前はリポジトリが公開なのでここには書かず、terraform init のときに渡す
  # （docs/03_手順書/07_AWSへの公開の手順書.md）
  backend "s3" {
    key          = "kakeibo/terraform.tfstate"
    region       = "ap-northeast-1"
    encrypt      = true
    use_lockfile = true # 同時に2つの作業をしないための札（ロック）
  }
}

provider "aws" {
  region = var.region

  # 作ったものすべてに、家計簿アプリのものだと分かる札（タグ）を付ける
  default_tags {
    tags = {
      Project   = "kakeibo"
      ManagedBy = "terraform"
    }
  }
}
