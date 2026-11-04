# ============================================================
# 門番（セキュリティグループ）
# くわしくは docs/02_設計/07_構成設計書.md の 4-2
# ============================================================

# AWS が用意している「CloudFront から来る通信の住所の一覧」
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# ------------------------------------------------------------
# EC2 の門番
# ------------------------------------------------------------
resource "aws_security_group" "app" {
  name        = "kakeibo-app"
  description = "kakeibo EC2"
  vpc_id      = data.aws_vpc.default.id

  tags = {
    Name = "kakeibo-app"
  }
}

# 80番（http）は CloudFront からだけ通す（使う人は必ず CloudFront の https を通る）
resource "aws_vpc_security_group_ingress_rule" "http_from_cloudfront" {
  security_group_id = aws_security_group.app.id
  description       = "HTTP from CloudFront only"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
}

# 22番（SSH）は自分のパソコンの IP アドレスからだけ通す
resource "aws_vpc_security_group_ingress_rule" "ssh_from_my_ip" {
  security_group_id = aws_security_group.app.id
  description       = "SSH from my PC"
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
  cidr_ipv4         = "${var.my_ip}/32"
}

# EC2 から外への通信（部品のダウンロード、RDS・SSM への接続など）は許す
resource "aws_vpc_security_group_egress_rule" "app_all" {
  security_group_id = aws_security_group.app.id
  description       = "Outbound"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# ------------------------------------------------------------
# RDS の門番
# ------------------------------------------------------------
resource "aws_security_group" "db" {
  name        = "kakeibo-db"
  description = "kakeibo RDS"
  vpc_id      = data.aws_vpc.default.id

  tags = {
    Name = "kakeibo-db"
  }
}

# 3306番（MySQL）は EC2（kakeibo-app の門番が付いたもの）からだけ通す
resource "aws_vpc_security_group_ingress_rule" "mysql_from_app" {
  security_group_id            = aws_security_group.db.id
  description                  = "MySQL from EC2"
  ip_protocol                  = "tcp"
  from_port                    = 3306
  to_port                      = 3306
  referenced_security_group_id = aws_security_group.app.id
}
