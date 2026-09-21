-- Opcional para o controle via banco/admin. O campo no código funciona sem esta migração.
begin;
alter table public.produtos add column if not exists ativo boolean not null default true;
commit;
