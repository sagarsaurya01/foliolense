-- FolioLense 0006: let a user record corporate actions on their own assets (Phase 6).
-- 0001 made corporate_actions read-only (worker-written). Applying a split/bonus/dividend in the
-- app writes one, so add a write policy scoped to the asset's owner, and one for the applied log.

create policy corporate_actions_write on public.corporate_actions for all to authenticated
  using (exists (select 1 from public.assets a where a.id = asset_id and a.owner_id = auth.uid()))
  with check (exists (select 1 from public.assets a where a.id = asset_id and a.owner_id = auth.uid()));

select 'FolioLense 0006 corporate-action write policy applied' as result;
