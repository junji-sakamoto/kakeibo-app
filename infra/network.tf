# ============================================================
# ネットワーク：アカウントに最初からある VPC（デフォルト VPC）を使う
# くわしくは docs/02_設計/07_構成設計書.md の 4章
#
# 専用の VPC は作らない（作るものを減らし、軽くするため）。
# RDS は「インターネットからつなげない」設定（publicly_accessible = false）と、
# 門番（security.tf）で EC2 からだけつなげるようにして守る
# ============================================================

data "aws_vpc" "default" {
  default = true
}

# デフォルト VPC のサブネット（場所ごとに1つずつある）。RDS は2つ以上の場所にまたがるサブネットの指定が必要
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

# EC2 を置くサブネット（東京の 1a）
data "aws_subnet" "app" {
  vpc_id            = data.aws_vpc.default.id
  availability_zone = "${var.region}a"
  default_for_az    = true
}
