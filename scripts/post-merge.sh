#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Non-interactif (stdin closed) → utiliser push-force pour appliquer aussi les
# contraintes UNIQUE (ex: user_tasks_user_task_unique) sans prompt.
pnpm --filter db push-force

# Backfill invariant : tout user doit avoir une ligne balances (defaults "0").
# Idempotent grâce à NOT EXISTS + ON CONFLICT DO NOTHING (UNIQUE balances.user_id).
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
  INSERT INTO balances (user_id)
  SELECT u.id FROM users u
  WHERE NOT EXISTS (SELECT 1 FROM balances b WHERE b.user_id = u.id)
  ON CONFLICT DO NOTHING;
"
