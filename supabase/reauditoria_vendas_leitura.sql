-- Somente leitura: metadados e totais agregados. Não retorna chaves, e-mails ou pedidos individuais.
begin transaction read only;
select c.relname as tabela,c.relrowsecurity as rls_ativo
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p')
 and c.relname in ('pedidos','perfis','enderecos','produtos','loja_admins','clientes_com_compra','cupons_reservados','limites_loja','notificacoes_pedidos','carrinhos_salvos')
order by 1;

select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' order by tablename,policyname;

select c.relname as tabela,r.rolname as papel,
 has_table_privilege(r.oid,c.oid,'SELECT') as pode_ler,
 has_table_privilege(r.oid,c.oid,'INSERT') as pode_inserir,
 has_table_privilege(r.oid,c.oid,'UPDATE') as pode_alterar,
 has_table_privilege(r.oid,c.oid,'DELETE') as pode_excluir
from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r
where n.nspname='public' and c.relkind in ('r','p')
 and r.rolname in ('anon','authenticated','service_role')
order by 1,2;

select p.proname as funcao,p.prosecdef as security_definer,
 pg_get_function_identity_arguments(p.oid) as argumentos,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_executa,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as cliente_executa
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('sou_admin','limitar_requisicoes_loja','reservar_notificacoes_pedidos','reservar_cupom_primeira_compra')
order by 1;

select indexname,indexdef from pg_indexes where schemaname='public' and tablename='pedidos';
select tgname as trigger,tgenabled as ativo,pg_get_triggerdef(oid) as definicao
from pg_trigger where tgrelid='public.pedidos'::regclass and not tgisinternal;

-- Avisos agregados, tolerando tabelas não existentes.
do $$ declare resumo json; begin
 if to_regclass('public.notificacoes_pedidos') is not null then
   execute 'select json_build_object(''total'',count(*),''pendentes'',count(*) filter(where enviado_em is null),''enviadas'',count(*) filter(where enviado_em is not null),''esgotadas'',count(*) filter(where enviado_em is null and tentativas>=12),''ultimo_envio'',max(enviado_em)) from public.notificacoes_pedidos' into resumo;
   raise notice 'Fila de notificações: %',resumo;
 end if;
 if to_regclass('cron.job') is not null then
   execute 'select json_agg(json_build_object(''jobid'',jobid,''schedule'',schedule,''active'',active)) from cron.job' into resumo;
   raise notice 'Agendamentos Supabase (sem comandos/segredos): %',resumo;
 end if;
end $$;
commit;
