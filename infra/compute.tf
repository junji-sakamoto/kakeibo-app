# ============================================================
# サーバー：EC2（Amazon Linux 2023、Arm）
# くわしくは docs/02_設計/07_構成設計書.md の 5章
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
  iam_instance_profile   = aws_iam_instance_profile.app.name

  # 公開の住所は、下の固定の住所（Elastic IP）を付ける
  associate_public_ip_address = false

  # 負荷が続いても、追加料金がかからないようにする
  credit_specification {
    cpu_credits = "standard"
  }

  # ディスクは、OS のイメージと同じ一番小さい 8GB（OS・Node.js・アプリには十分）
  root_block_device {
    volume_type = "gp3"
    volume_size = 8
    encrypted   = true
  }

  # EC2 の中の情報を読むときに、トークンを必須にする（IMDSv2）
  metadata_options {
    http_tokens = "required"
  }

  # 初めて起動したときに、nginx・Node.js・MySQL の道具を入れて、処理側を動かす準備をする。
  # パスワードは入れない（処理側が起動するときに SSM パラメータストアから読む）
  # Windows で取り出すと改行が CRLF になることがあるので、LF にそろえて渡す
  user_data = replace(templatefile("${path.module}/user_data.sh.tftpl", {
    node_version          = var.node_version
    region                = var.region
    db_host               = aws_db_instance.main.address
    db_name               = aws_db_instance.main.db_name
    db_password_parameter = aws_ssm_parameter.db_app_password.name
  }), "\r\n", "\n")

  # user_data は初めて起動したときにしか動かないので、中身を変えたら EC2 を作り直す。
  # EC2 の中のアプリも消えるので、作り直したら deploy.ps1 でもう一度載せる（データは RDS にあるので消えない）
  user_data_replace_on_change = true

  lifecycle {
    # 新しいイメージが出るたびに、作り直されないようにする
    ignore_changes = [ami]
  }

  tags = {
    Name = "kakeibo-app"
  }
}

# 固定の住所（Elastic IP）。EC2 を止めて動かしても住所が変わらない
resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id

  tags = {
    Name = "kakeibo-app"
  }
}
