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
  description = "EC2 に入ってよい、自分のパソコンの IP アドレス（例：203.0.113.10）"
  type        = string

  validation {
    condition     = can(regex("^\\d{1,3}(\\.\\d{1,3}){3}$", var.my_ip))
    error_message = "my_ip には、203.0.113.10 のような IP アドレスを1つだけ書いてください（/32 は付けない）。"
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

variable "node_version" {
  description = "EC2 に入れる Node.js の版（自分のパソコンと同じ。docs/03_手順書/00_開発環境と版の一覧.md）"
  type        = string
  default     = "26.13.0"
}

variable "frontend_port" {
  description = "画面側（Vite）のポート番号。自分のパソコンで動かしているときと同じ 5173 番"
  type        = number
  default     = 5173
}
