-- Executar DEPOIS de cupons_primeira_compra.sql. Transação: falha reverte tudo.
-- Revise os administradores e as políticas antes de aplicar em produção.
begin;
create table if not exists public.loja_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.loja_admins enable row level security;
revoke all on public.loja_admins from public, anon, authenticated;
grant all on public.loja_admins to service_role;
-- Só uma conta já verificada pode ser promovida. Não usa metadata editável.
insert into public.loja_admins(user_id)
select id from auth.users where lower(email) = 'i.j.print26@gmail.com' and email_confirmed_at is not null
on conflict do nothing;

create or replace function public.sou_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.loja_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.sou_admin() from public, anon;
grant execute on function public.sou_admin() to authenticated;

alter table public.pedidos add column if not exists frete_valor numeric(12,2);
alter table public.pedidos add column if not exists frete_servico integer;
alter table public.pedidos add column if not exists modo_entrega text;
alter table public.pedidos add column if not exists checkout_hash text;
alter table public.pedidos add column if not exists checkout_estado text not null default 'processando';
alter table public.pedidos add column if not exists pagamento_handle text;
alter table public.pedidos add column if not exists link_pagamento text;
alter table public.pedidos add column if not exists pagamento_transacao text;
alter table public.pedidos add column if not exists pagamento_slug text;
alter table public.pedidos add column if not exists pagamento_confirmado_em timestamptz;
create unique index if not exists pedidos_transacao_unica on public.pedidos(pagamento_transacao) where pagamento_transacao is not null;
create unique index if not exists pedidos_checkout_pendente on public.pedidos(user_id,checkout_hash) where status = 'Aguardando Pagamento' and checkout_hash is not null;

-- Políticas permissivas são combinadas por OR: remover as antigas destas tabelas.
do $$ declare p record; begin
 for p in select schemaname, tablename, policyname from pg_policies
 where schemaname = 'public' and tablename in ('pedidos','perfis','enderecos','produtos','carrinhos_salvos')
 loop execute format('drop policy %I on %I.%I', p.policyname,p.schemaname,p.tablename); end loop;
end $$;
alter table public.pedidos enable row level security;
revoke all on public.pedidos from public, anon, authenticated;
grant select on public.pedidos to authenticated;
grant all on public.pedidos to service_role;
create policy pedidos_leitura on public.pedidos for select to authenticated using (user_id = (select auth.uid()) or (select public.sou_admin()));

alter table public.perfis enable row level security;
revoke all on public.perfis from public, anon, authenticated;
grant select, insert, update on public.perfis to authenticated;
create policy perfis_leitura on public.perfis for select to authenticated using (id = (select auth.uid()) or (select public.sou_admin()));
create policy perfis_inserir on public.perfis for insert to authenticated with check (id = (select auth.uid()));
create policy perfis_atualizar on public.perfis for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter table public.enderecos enable row level security;
revoke all on public.enderecos from public, anon, authenticated;
grant select, insert, update, delete on public.enderecos to authenticated;
create policy enderecos_proprios on public.enderecos for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.produtos enable row level security;
revoke all on public.produtos from public, anon, authenticated;
grant select on public.produtos to anon, authenticated;
create policy catalogo_publico on public.produtos for select to anon, authenticated using (true);

-- Opcional se a tabela de recuperação de carrinho já existe.
do $$ begin
 if to_regclass('public.carrinhos_salvos') is not null then
   alter table public.carrinhos_salvos enable row level security;
   revoke all on public.carrinhos_salvos from public, anon, authenticated;
   grant all on public.carrinhos_salvos to service_role;
 end if;
end $$;
alter table public.pedidos add column if not exists etiqueta_estado text not null default 'pendente';
alter table public.pedidos add column if not exists melhor_envio_cart_id text;
alter table public.pedidos add column if not exists tracking_url text;
create table if not exists public.limites_loja (
 chave text primary key, janela timestamptz not null, quantidade integer not null
);
alter table public.limites_loja enable row level security;
revoke all on public.limites_loja from public, anon, authenticated;
grant all on public.limites_loja to service_role;
create or replace function public.limitar_requisicoes_loja(p_chave text, p_limite integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare contador integer; atual timestamptz := date_trunc('minute', now()); begin
 if length(p_chave) > 250 or p_limite < 1 or p_limite > 1000 then return false; end if;
 insert into public.limites_loja as l values(p_chave, atual, 1)
 on conflict(chave) do update set janela = atual,
 quantidade = case when l.janela = atual then l.quantidade + 1 else 1 end
 returning quantidade into contador;
 return contador <= p_limite;
end $$;
revoke all on function public.limitar_requisicoes_loja(text,integer) from public, anon, authenticated;
grant execute on function public.limitar_requisicoes_loja(text,integer) to service_role;
create table if not exists public.notificacoes_pedidos (
 id bigint generated always as identity primary key,
 pedido_id uuid not null references public.pedidos(id),
 evento text not null, destino text not null check (destino in ('cliente','admin')),
 pedido jsonb not null, criado_em timestamptz not null default now(),
 enviado_em timestamptz, reservado_ate timestamptz, tentativas integer not null default 0,
 unique(pedido_id,evento,destino)
);
alter table public.notificacoes_pedidos enable row level security;
revoke all on public.notificacoes_pedidos from public, anon, authenticated;
grant all on public.notificacoes_pedidos to service_role;
create or replace function public.enfileirar_notificacao_pedido() returns trigger
language plpgsql security definer set search_path = '' as $$
declare evento_atual text; begin
 if new.status is distinct from old.status and new.status in ('Pago','Em Produção','Enviado','Concluído') then evento_atual := new.status;
 elsif new.status = 'Aguardando Pagamento' and new.link_pagamento is not null and old.link_pagamento is null then evento_atual := 'Novo';
 else return new; end if;
 insert into public.notificacoes_pedidos(pedido_id,evento,destino,pedido)
 select new.id,evento_atual,d,to_jsonb(new) - 'itens' from unnest(array['cliente','admin']) d
 on conflict do nothing;
 return new;
end $$;
revoke all on function public.enfileirar_notificacao_pedido() from public, anon, authenticated;
drop trigger if exists notificar_pedido on public.pedidos;
create trigger notificar_pedido after update of status,link_pagamento on public.pedidos
for each row execute function public.enfileirar_notificacao_pedido();
create or replace function public.reservar_notificacoes_pedidos() returns setof public.notificacoes_pedidos
language sql security definer set search_path = '' as $$
 update public.notificacoes_pedidos set reservado_ate = now() + interval '5 minutes', tentativas = tentativas + 1
 where id in (select id from public.notificacoes_pedidos where enviado_em is null
 and (reservado_ate is null or reservado_ate < now()) and tentativas < 12
 order by id limit 5 for update skip locked) returning *;
$$;
revoke all on function public.reservar_notificacoes_pedidos() from public, anon, authenticated;
grant execute on function public.reservar_notificacoes_pedidos() to service_role;
commit;
