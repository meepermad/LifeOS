-- Phase 6.5: Canvas task synchronization metadata

alter table public.tasks
  add column sync_managed boolean not null default false,
  add column source_content_hash text null,
  add column cancelled_by_sync boolean not null default false;

-- Claim existing manually converted Canvas tasks for sync lifecycle
update public.tasks
set sync_managed = true
where source = 'canvas' and external_task_id is not null;
