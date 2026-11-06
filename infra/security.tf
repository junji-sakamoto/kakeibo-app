# ============================================================
# 門番（セキュリティグループ）
# くわしくは docs/02_設計/07_構成設計書.md の 4-2
#
# 入ってよいのは、自分のパソコン（my_ip）からの次の2つだけ。どこからでも入れる設定（0.0.0.0/0）にはしない
#   - 22番：SSH（EC2 の管理）
#   - 80番：画面（nginx。第5段階から。第4段階までは Vite の 5173番だった）。画面側と処理側は同じ EC2 に入れ、
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

# 80番（画面。nginx）：自分のパソコンからだけ
resource "aws_vpc_security_group_ingress_rule" "web_from_my_ip" {
  security_group_id = aws_security_group.app.id
  description       = "Web (nginx) from my PC"
  ip_protocol       = "tcp"
  from_port         = var.web_port
  to_port           = var.web_port
  cidr_ipv4         = "${var.my_ip}/32"
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
