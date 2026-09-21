-- Opcional para o controle via banco/admin. O campo no código funciona sem esta migração.
begin;
alter table public.produtos add column if not exists ativo boolean not null default true;
-- NULL segue a regra do código/banco; booleano é uma escolha explícita do admin.
alter table public.produtos add column if not exists ativo_admin boolean default null;
commit;
