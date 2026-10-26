-- FolioLense 0002: let the owner read a family in the same statement that creates it.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- Why: "insert ... returning" checks the select policy on the new row. The old policy only called
-- can_read_family(id), which looks the family up in a separate query that cannot see a row created
-- by the statement still running, so creating a family failed with
-- "new row violates row-level security policy for table families".
-- Checking owner_id on the row itself first fixes it.

drop policy families_select on public.families;
create policy families_select on public.families for select to authenticated
  using (owner_id = auth.uid() or public.can_read_family(id));

select 'FolioLense fix 0002 applied' as result;
