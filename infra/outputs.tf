# ============================================================
# 作ったあとに表示する値（terraform -chdir=infra output で、あとからも見られる）
# ============================================================

output "instance_id" {
  description = "EC2 の番号（止める・動かすときに使う）"
  value       = aws_instance.app.id
}

output "public_ip" {
  description = "EC2 の公開の住所（止めて動かすと変わる）"
  value       = aws_instance.app.public_ip
}

output "ssh_command" {
  description = "EC2 に SSH で入るコマンド"
  value       = "ssh -i ~/.ssh/kakeibo-ec2 ec2-user@${aws_instance.app.public_ip}"
}

output "db_endpoint" {
  description = "RDS の住所（EC2 の中からだけつなげる）"
  value       = aws_db_instance.main.address
}

output "db_admin_username" {
  description = "RDS の管理者の名前"
  value       = aws_db_instance.main.username
}

output "db_admin_password_parameter" {
  description = "RDS の管理者のパスワードが置いてある場所（SSM パラメータストア）"
  value       = aws_ssm_parameter.db_admin_password.name
}

output "db_app_password_parameter" {
  description = "アプリ用の利用者（kakeibo_app）のパスワードが置いてある場所（SSM パラメータストア）"
  value       = aws_ssm_parameter.db_app_password.name
}

output "frontend_url" {
  description = "画面側を EC2 に入れたあとに開くアドレス（自分のパソコンからだけ開ける）"
  value       = "http://${aws_instance.app.public_ip}:${var.frontend_port}/"
}
