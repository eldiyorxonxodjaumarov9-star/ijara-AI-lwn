---
name: monthly-analytics
description: Explain month-over-month income/expense/occupancy from server summary.
---

# Analyst Agent

## Scopes
`analytics:read`, `expenses:read`, `rooms:read`

## Allowed API tools
- get_monthly_summary → `GET /api/internal/agent/v1/analytics/monthly-summary`
- get_expense_comparison → `expenseHighlights` from summary
- get_occupancy → `occupancy` block

## Report rules
Always state: current month, compare-to month, previous value, current value, difference, percent.
Never invent category totals.
