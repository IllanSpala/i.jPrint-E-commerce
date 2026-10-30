-- Archive projects and their private objects before rollback. Existing orders reference them.
-- This migration deliberately retains private files; do not make the bucket public.
begin;
drop policy if exists filament_original_insert on storage.objects;
drop policy if exists filament_private_read on storage.objects;
drop policy if exists filament_orphan_delete on storage.objects;
drop table if exists public.filament_art_projects;
drop table if exists public.filament_art_profiles;
commit;
