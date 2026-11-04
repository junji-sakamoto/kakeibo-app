# ============================================================
# 外から渡す値
# 本物の値は terraform.tfvars に書く（GitHub に上げない）。見本は terraform.tfvars.example
# ============================================================

variable "region" {
  description = "使うリージョン（東京）"
  type        = string
  default     = "ap-northeast-1"
}

variable "my_ip" {
  description = "SSH（22番）で EC2 に入ってよい、自分のパソコンの IP アドレス（例：203.0.113.10）"
  type        = string

  validation {
    condition     = can(regex("^\\d{1,3}(\\.\\d{1,3}){3}$", var.my_ip))
    error_message = "my_ip には、203.0.113.10 のような IP アドレスを1つだけ書いてください（/32 は付けない）。"
  }
}

variable "alert_email" {
  description = "予算をこえそうなときに知らせるメールアドレス"
  type        = string

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.alert_email))
    error_message = "alert_email には、メールアドレスを書いてください。"
  }
}

variable "ssh_public_key_path" {
  description = "SSH の公開鍵のファイル（秘密鍵ではなく、.pub のほう）"
  type        = string
  default     = "~/.ssh/kakeibo-ec2.pub"
}

variable "instance_type" {
  description = "EC2 の大きさ。t4g.small は 2026年12月31日まで無料トライアルの対象"
  type        = string
  default     = "t4g.small"
}

variable "db_instance_class" {
  description = "RDS の大きさ"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  description = "RDS の MySQL の版（RDS で使える一番新しい 8.4 系）"
  type        = string
  default     = "8.4.11"
}

variable "db_backup_retention_days" {
  description = "RDS の自動バックアップを残す日数（非機能要件では7日）"
  type        = number
  default     = 7
}

variable "node_version" {
  description = "EC2 に入れる Node.js の版（自分のパソコンと同じ）"
  type        = string
  default     = "26.13.0"
}

variable "monthly_budget_usd" {
  description = "1か月の予算（ドル）。5,000円 ÷ 150円"
  type        = number
  default     = 33
}

variable "alert_threshold_usd" {
  description = "この金額（ドル）をこえたらメールで知らせる。4,000円 ÷ 150円"
  type        = number
  default     = 27
}
