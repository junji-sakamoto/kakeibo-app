# ============================================================
# サーバー：EC2（Amazon Linux 2023、Arm）
# くわしくは docs/02_設計/07_構成設計書.md の 5章
#
# 第1段階：EC2 を作って SSH で入れることを確かめた。
# 第2段階：EC2 が初めて起動したときに、Node.js を自動で入れる（user_data.sh.tftpl）。
# 第3段階：同じく、RDS につながるかを確かめるための mysql コマンドも入れる。
# ほかのもの（アプリなど）は、あとの段階で入れる（一気に作らず、1つずつ確かめるため）
# ============================================================

# Amazon Linux 2023（Arm 用）の最新のイメージ
data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

# パソコンで作った SSH の公開鍵を、AWS に登録する（秘密鍵はパソコンにだけ置く）
resource "aws_key_pair" "ssh" {
  key_name   = "kakeibo-ec2"
  public_key = file(pathexpand(var.ssh_public_key_path))
}

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.al2023_arm64.insecure_value
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnet.app.id
  vpc_security_group_ids = [aws_security_group.app.id]
  key_name               = aws_key_pair.ssh.key_name

  # 公開の住所（パソコンから入るため）。EC2 を止めて動かすと変わる
  associate_public_ip_address = true

  # 負荷が続いても、追加料金がかからないようにする
  credit_specification {
    cpu_credits = "standard"
  }

  # ディスクは、OS のイメージと同じ一番小さい 8GB
  root_block_device {
    volume_type = "gp3"
    volume_size = 8
    encrypted   = true
  }

  # EC2 の中の情報を読むときに、トークンを必須にする（IMDSv2）
  metadata_options {
    http_tokens = "required"
  }

  # 初めて起動したときに、Node.js を入れる（第2段階）。
  # Windows で取り出すと改行が CRLF になることがあるので、LF にそろえて渡す
  user_data = replace(templatefile("${path.module}/user_data.sh.tftpl", {
    node_version         = var.node_version
    mysql_client_version = var.mysql_client_version
  }), "\r\n", "\n")

  # user_data は初めて起動したときにしか動かないので、中身を変えたら EC2 を作り直す
  user_data_replace_on_change = true

  lifecycle {
    # 新しいイメージが出るたびに、作り直されないようにする
    ignore_changes = [ami]
  }

  tags = {
    Name = "kakeibo-app"
  }
}
