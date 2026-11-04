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

output "frontend_url" {
  description = "画面側を EC2 に入れたあとに開くアドレス（自分のパソコンからだけ開ける）"
  value       = "http://${aws_instance.app.public_ip}:${var.frontend_port}/"
}
