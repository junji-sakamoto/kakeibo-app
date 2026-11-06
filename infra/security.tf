# ============================================================
# 門番（セキュリティグループ）
# くわしくは docs/02_設計/07_構成設計書.md の 4-2
#
# EC2 に入ってよいのは、次の2つだけ。どこからでも入れる設定（0.0.0.0/0）にはしない
#   - 22番：SSH（EC2 の管理）。自分のパソコン（my_ip）からだけ
#   - 80番：画面（nginx）。第6段階から CloudFront からだけ（第5段階までは自分のパソコンからだけ、
#           第4段階までは Vite の 5173番だった）。画面側と処理側は同じ EC2 に入れ、
#           処理側（3000番）へは nginx が EC2 の中で中継するので、3000番は開けない
# ============================================================

resource "aws_security_group" "app" {
  name        = "kakeibo-app"
  description = "kakeibo EC2"
  vpc_id      = data.aws_vpc.default.id

  tags = {
    Name = "kakeibo-app"
  }
}

# 22番（SSH）：自分のパソコンからだけ
resource "aws_vpc_security_group_ingress_rule" "ssh_from_my_ip" {
  security_group_id = aws_security_group.app.id
  description       = "SSH from my PC"
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
  cidr_ipv4         = "${var.my_ip}/32"
}

# AWS が用意している「CloudFront から来る通信の住所の一覧」（第6段階）
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# 80番（画面。nginx）：CloudFront からだけ（第6段階。第5段階までは自分のパソコンからだけだった）。
# 使う人は必ず CloudFront の https を通る。EC2 に直接 http では来られない
resource "aws_vpc_security_group_ingress_rule" "web_from_cloudfront" {
  security_group_id = aws_security_group.app.id
  description       = "Web (nginx) from CloudFront only"
  ip_protocol       = "tcp"
  from_port         = var.web_port
  to_port           = var.web_port
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
}

# EC2 から外への通信（OS の更新や、Node.js・部品のダウンロード、RDS への接続）は許す
resource "aws_vpc_security_group_egress_rule" "app_all" {
  security_group_id = aws_security_group.app.id
  description       = "Outbound"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# ------------------------------------------------------------
# RDS の門番（第3段階）
# 入ってよいのは、EC2（kakeibo-app の門番が付いたもの）からの 3306番（MySQL）だけ。
# 自分のパソコンからも、インターネットからも、直接はつなげない
# ------------------------------------------------------------
resource "aws_security_group" "db" {
  name        = "kakeibo-db"
  description = "kakeibo RDS"
  vpc_id      = data.aws_vpc.default.id

  tags = {
    Name = "kakeibo-db"
  }
}

resource "aws_vpc_security_group_ingress_rule" "mysql_from_app" {
  security_group_id            = aws_security_group.db.id
  description                  = "MySQL from EC2 only"
  ip_protocol                  = "tcp"
  from_port                    = 3306
  to_port                      = 3306
  referenced_security_group_id = aws_security_group.app.id
}
