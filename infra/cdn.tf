# ============================================================
# CloudFront：https の入口
# くわしくは docs/02_設計/07_構成設計書.md の 7章
# ============================================================

# AWS が用意している、ためておき方（キャッシュ）の決まり
data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

# 使う人からのお願いの中身（月の指定などの ? のあと、ヘッダー）を、EC2 にそのまま送る決まり
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "main" {
  enabled         = true
  comment         = "kakeibo"
  is_ipv6_enabled = true
  # 日本を含む範囲だけで配る（料金を少しおさえる）
  price_class = "PriceClass_200"

  # 送り先（オリジン）：EC2 の固定の住所に付く名前の 80番
  origin {
    origin_id   = "kakeibo-ec2"
    domain_name = aws_eip.app.public_dns

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # /api/*：ためておかず、毎回 EC2 に送る（記録はいつも最新を見せる）
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "kakeibo-ec2"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    compress                 = true
  }

  # /assets/*：Vite が作るファイル（中身が変わると名前も変わる）はためておく
  ordered_cache_behavior {
    path_pattern           = "/assets/*"
    target_origin_id       = "kakeibo-ec2"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
    compress               = true
  }

  # それ以外（index.html など）：ためておかない（新しい版をすぐに反映する）
  default_cache_behavior {
    target_origin_id       = "kakeibo-ec2"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.disabled.id
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # CloudFront が初めから持っている *.cloudfront.net の証明書を使う（無料）
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "kakeibo"
  }
}
