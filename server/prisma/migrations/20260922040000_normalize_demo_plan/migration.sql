-- Normalize null/empty subscription plans to demo for DEMO-status workspaces.
-- Additive and non-destructive: no rows deleted.

UPDATE "workspace_subscriptions"
SET "plan" = 'demo'
WHERE ("plan" IS NULL OR btrim("plan") = '')
  AND "status" = 'DEMO';
