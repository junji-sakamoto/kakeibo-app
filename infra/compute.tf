# ============================================================
# サーバー：EC2（Amazon Linux 2023、Arm）
# くわしくは docs/02_設計/07_構成設計書.md の 5章
#
# 第1段階では、EC2 を作って SSH で入れることを確かめるだけ。
# Node.js などを入れるのは、次の段階で行う（一気に作らず、1つずつ確かめるため）
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

  lifecycle {
    # 新しいイメージが出るたびに、作り直されないようにする
    ignore_changes = [ami]
  }

  tags = {
    Name = "kakeibo-app"
  }
}
