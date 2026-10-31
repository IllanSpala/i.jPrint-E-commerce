begin;
create table if not exists public.filament_art_profiles (
 id text primary key,
 profile jsonb not null,
 in_stock boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.filament_art_profiles enable row level security;
revoke all on public.filament_art_profiles from public, anon, authenticated;
grant select on public.filament_art_profiles to anon, authenticated;
grant all on public.filament_art_profiles to service_role;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'filament_art_profiles' and policyname = 'filament_profiles_read') then
    create policy filament_profiles_read on public.filament_art_profiles for select to anon, authenticated using (true);
  end if;
end $$;
create table if not exists public.filament_art_projects (
 id uuid primary key,
 user_id uuid not null references auth.users(id),
 product_id bigint not null check (product_id = 82),
 hash text not null check (hash ~ '^[0-9a-f]{64}$'),
 original_path text not null,
 artifact_path text not null unique,
 summary jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.filament_art_projects enable row level security;
revoke all on public.filament_art_projects from public, anon, authenticated;
grant select on public.filament_art_projects to authenticated;
grant all on public.filament_art_projects to service_role;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'filament_art_projects' and policyname = 'filament_projects_read') then
    create policy filament_projects_read on public.filament_art_projects for select to authenticated using (user_id = (select auth.uid()) or (select public.sou_admin()));
  end if;
end $$;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('filament-art-private','filament-art-private',false,8388608,array['image/png','image/jpeg','image/webp','application/json'])
on conflict (id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'filament_original_insert') then
    create policy filament_original_insert on storage.objects for insert to authenticated with check (
 bucket_id = 'filament-art-private' and (storage.foldername(name))[1] = (select auth.uid())::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/original$'
 and lower(metadata->>'mimetype') in ('image/png','image/jpeg','image/webp')
);
  end if;
end $$;
-- No UPDATE: an approved input must never be replaced. Server alone writes project.json.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'filament_private_read') then
    create policy filament_private_read on storage.objects for select to authenticated using (
 bucket_id = 'filament-art-private' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.sou_admin()))
);
  end if;
end $$;
-- Cleanup uses the service API; owners cannot delete a file during confirmation.
commit;
