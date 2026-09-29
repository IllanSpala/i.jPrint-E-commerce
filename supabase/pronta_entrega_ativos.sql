begin;
create table if not exists public.pronta_entrega_estados (
  id text primary key,
  ativo boolean not null default true,
  ativo_admin boolean default null,
  constraint pronta_entrega_id check (id in ('pronta-xenonita','pronta-jax','pronta-tony','pronta-edward'))
);
comment on column public.pronta_entrega_estados.ativo is 'Disponibilidade em estoque. false mantém a peça visível como esgotada; a visibilidade é definida por prod_ativo no catálogo.';
alter table public.pronta_entrega_estados enable row level security;
revoke all on public.pronta_entrega_estados from anon, authenticated;
grant select on public.pronta_entrega_estados to anon, authenticated;
grant all on public.pronta_entrega_estados to service_role;
drop policy if exists "Leitura de estados da pronta entrega" on public.pronta_entrega_estados;
create policy "Leitura de estados da pronta entrega" on public.pronta_entrega_estados for select to anon, authenticated using (true);
insert into public.pronta_entrega_estados (id) values
 ('pronta-xenonita'), ('pronta-jax'), ('pronta-tony'), ('pronta-edward')
on conflict (id) do nothing;
commit;
