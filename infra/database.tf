# ============================================================
# データベース：RDS for MySQL 8.4
# くわしくは docs/02_設計/07_構成設計書.md の 6章
# ============================================================

# RDS を置くサブネットのまとまり（外から入れないサブネット2つ）
resource "aws_db_subnet_group" "main" {
  name       = "kakeibo-db"
  subnet_ids = [for s in aws_subnet.private : s.id]
}

# RDS の設定（パラメータグループ）
resource "aws_db_parameter_group" "main" {
  name   = "kakeibo-mysql84"
  family = "mysql8.4"

  # 日時を日本時間にする（自分のパソコンのデータベースの TZ: Asia/Tokyo とそろえる）
  parameter {
    name  = "time_zone"
    value = "Asia/Tokyo"
  }
}

resource "aws_db_instance" "main" {
  identifier     = "kakeibo-db"
  engine         = "mysql"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  # 版を勝手に上げないようにする（版を上げるときは、手順書のとおりに自分で上げる）
  auto_minor_version_upgrade = false

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  # 最初に作るデータベースの名前と、管理者の名前
  db_name  = "kakeibo"
  username = "kakeibo_admin"
  # 管理者のパスワードは RDS が作って Secrets Manager に置く（Terraform の記録には残らない）
  manage_master_user_password = true

  parameter_group_name   = aws_db_parameter_group.main.name
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  # インターネットからはつなげない
  publicly_accessible = false
  # 1台だけで動かす（2台にすると料金が2倍になる）
  multi_az = false

  # 自動バックアップ（非機能要件：7日分）。時刻は世界標準時（UTC）で書く
  backup_retention_period = var.db_backup_retention_days
  backup_window           = "17:00-17:30"         # 日本時間の 2:00〜2:30
  maintenance_window      = "sun:18:00-sun:18:30" # 日本時間の 月曜 3:00〜3:30
  copy_tags_to_snapshot   = true

  # 講師の確認が終わったら全部消す決まりなので、消すときの控えは取らず、消すことの禁止も付けない。
  # terraform destroy すると、データも一緒に消える
  skip_final_snapshot = true
  deletion_protection = false

  # 設定を変えたとき、次のメンテナンスの時間を待たずにすぐ変える
  apply_immediately = true
}

# ------------------------------------------------------------
# アプリ用の利用者（kakeibo_app）のパスワード
# ------------------------------------------------------------

# パスワードをその場で作る（ephemeral：Terraform の記録に残らない）
ephemeral "aws_secretsmanager_random_password" "db_app" {
  password_length = 32
  # 記号を使わない（SQL やコマンドに書いたときに、記号の意味で困らないようにする）
  exclude_punctuation = true
}

# 作ったパスワードを、SSM パラメータストアに暗号化して置く。
# value_wo（書き込むだけ）を使うので、Terraform の記録には残らない。
# value_wo_version の数字を変えたときだけ、新しいパスワードに入れかわる
resource "aws_ssm_parameter" "db_app_password" {
  name             = "/kakeibo/db/app-password"
  description      = "kakeibo_app (MySQL) password"
  type             = "SecureString"
  value_wo         = ephemeral.aws_secretsmanager_random_password.db_app.random_password
  value_wo_version = 1
}
