-- LifeOS: align sync_states upsert conflict target with PostgREST
--
-- Application upserts use onConflict: "calendar_id" (one sync-state row per calendar).
-- The Phase 8 partial unique index is not valid for PostgREST upsert inference.

-- Backfill missing calendar_id from calendars on the same connection.
UPDATE public.sync_states AS ss
SET calendar_id = selected.calendar_id
FROM (
  SELECT DISTINCT ON (ss_inner.id)
    ss_inner.id AS sync_state_id,
    c.id AS calendar_id
  FROM public.sync_states AS ss_inner
  INNER JOIN public.calendars AS c
    ON c.connection_id = ss_inner.connection_id
   AND c.user_id = ss_inner.user_id
  WHERE ss_inner.calendar_id IS NULL
  ORDER BY
    ss_inner.id,
    CASE
      WHEN c.source = 'canvas' AND c.name = 'Canvas' THEN 0
      WHEN c.sync_enabled THEN 1
      ELSE 2
    END,
    c.updated_at DESC NULLS LAST,
    c.created_at DESC
) AS selected
WHERE ss.id = selected.sync_state_id;

-- Deduplicate rows per calendar_id, preserving the newest/most complete state.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY calendar_id
      ORDER BY
        (sync_cursor IS NOT NULL) DESC,
        (feed_hash IS NOT NULL) DESC,
        COALESCE(last_synced_at, updated_at, created_at) DESC
    ) AS rn
  FROM public.sync_states
  WHERE calendar_id IS NOT NULL
)
DELETE FROM public.sync_states AS ss
USING ranked
WHERE ss.id = ranked.id
  AND ranked.rn > 1;

-- Remove legacy rows that cannot be keyed by calendar_id.
DELETE FROM public.sync_states
WHERE calendar_id IS NULL;

-- Drop legacy/partial unique indexes incompatible with PostgREST upsert.
DROP INDEX IF EXISTS public.sync_states_calendar_id_unique;
DROP INDEX IF EXISTS public.sync_states_connection_id_unique;

ALTER TABLE public.sync_states
  DROP CONSTRAINT IF EXISTS sync_states_calendar_id_key;

ALTER TABLE public.sync_states
  ADD CONSTRAINT sync_states_calendar_id_key UNIQUE (calendar_id);
