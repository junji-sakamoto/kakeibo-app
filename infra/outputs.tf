# ============================================================
# 作ったあとに表示する値（terraform -chdir=infra output で、あとからも見られる）
# ============================================================

output "app_url" {
  description = "公開のアドレス（講師に伝えるもの）"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}/"
}

output "public_ip" {
  description = "EC2 の固定の住所（Elastic IP）"
  value       = aws_eip.app.public_ip
}

output "ssh_command" {
  description = "EC2 に SSH で入るコマンド"
  value       = "ssh -i ~/.ssh/kakeibo-ec2 ec2-user@${aws_eip.app.public_ip}"
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
  description = "アプリ用のパスワードが置いてある場所（SSM パラメータストア）"
  value       = aws_ssm_parameter.db_app_password.name
}

output "cloudfront_distribution_id" {
  description = "CloudFront の番号（ためておいたファイルを消すときに使う）"
  value       = aws_cloudfront_distribution.main.id
}
