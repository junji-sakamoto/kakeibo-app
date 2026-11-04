# ============================================================
# EC2 に渡す権限（IAM ロール）
# アプリ用のパスワード（SSM パラメータストア）を読むことだけを許す
# ============================================================

# EC2 がこのロールを使ってよい、という決まり
data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "kakeibo-app"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

# できること：アプリ用のパスワードを1つ読むことだけ
data "aws_iam_policy_document" "app" {
  statement {
    sid       = "ReadAppDbPassword"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.db_app_password.arn]
  }

  # 暗号化されたパスワードを、SSM パラメータストアを通したときだけ元に戻してよい
  statement {
    sid       = "DecryptViaSsmOnly"
    actions   = ["kms:Decrypt"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "app" {
  name   = "kakeibo-app"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app.json
}

# EC2 にロールを付けるための入れ物
resource "aws_iam_instance_profile" "app" {
  name = "kakeibo-app"
  role = aws_iam_role.app.name
}
