# ============================================================
# 予算の通知（AWS Budgets。無料）（第6段階）
# くわしくは docs/02_設計/07_構成設計書.md の 4-9
# ============================================================

resource "aws_budgets_budget" "monthly" {
  name         = "kakeibo-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # 家計簿のもの（札 Project = kakeibo）だけを数える。
  # 札で数えるには、請求の仕組みで Project の札を有効にしておく必要がある
  # （docs/03_手順書/07_AWSへの公開の手順書.md の 2章の 5.）
  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Project$kakeibo"]
  }

  # クレジットを差し引く前の金額で数える（差し引いたあとは 0 ドルになり、見張りにならないため）
  cost_types {
    include_credit = false
    include_refund = false
  }

  # 通知 1：実際の金額が 27 ドル（約4,000円）をこえたら
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = var.alert_threshold_usd
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  # 通知 2：月末までの見込みが 33 ドル（約5,000円）をこえそうなら
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = var.monthly_budget_usd
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}
