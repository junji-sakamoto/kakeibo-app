# ============================================================
# ネットワーク：家計簿アプリ専用の VPC とサブネット
# くわしくは docs/02_設計/07_構成設計書.md の 4-1
# ============================================================

resource "aws_vpc" "main" {
  cidr_block = "10.20.0.0/16"

  # CloudFront から EC2 を名前（ec2-…amazonaws.com）で呼べるようにする
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "kakeibo"
  }
}

# インターネットとの出入口
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "kakeibo"
  }
}

# 公開用のサブネット（EC2 を置く）
resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.20.1.0/24"
  availability_zone = "${var.region}a"

  tags = {
    Name = "kakeibo-public-1a"
  }
}

# 外から入れないサブネット（RDS を置く）。RDS の決まりで、2つの場所に1つずつ作る
resource "aws_subnet" "private" {
  for_each = {
    a = "10.20.11.0/24"
    c = "10.20.12.0/24"
  }

  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value
  availability_zone = "${var.region}${each.key}"

  tags = {
    Name = "kakeibo-private-1${each.key}"
  }
}

# 公開用のサブネットの道案内：インターネット行きは出入口へ
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "kakeibo-public"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# 外から入れないサブネットの道案内：インターネット行きの道を作らない
# （NAT ゲートウェイは月45ドルほどかかり、RDS はインターネットに出る必要がないため作らない）
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "kakeibo-private"
  }
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private.id
}
