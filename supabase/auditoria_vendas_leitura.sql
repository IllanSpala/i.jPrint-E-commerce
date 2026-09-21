-- AUDITORIA SOMENTE LEITURA. Executar no SQL Editor do projeto correto.
-- Retorna estrutura/permissões; não lista clientes, endereços ou pedidos.
BEGIN TRANSACTION READ ONLY;

-- 1. Tabelas existentes e RLS habilitado. Uma tabela ausente não aparece.
SELECT c.relname AS tabela, c.relrowsecurity AS rls_ativo,
       c.relforcerowsecurity AS rls_forcado
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  AND c.relname IN ('pedidos', 'perfis', 'enderecos', 'produtos',
                   'carrinhos_salvos', 'clientes_com_compra', 'cupons_reservados')
ORDER BY c.relname;

-- 2. Políticas efetivas: conferir isolamento por auth.uid() e permissões de admin.
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('pedidos', 'perfis', 'enderecos', 'produtos',
                    'carrinhos_salvos', 'clientes_com_compra', 'cupons_reservados')
ORDER BY tablename, policyname;

-- 3. Grants, incluindo grants herdados de PUBLIC, para os papéis da API.
SELECT c.relname AS tabela, r.rolname AS papel,
       has_table_privilege(r.oid, c.oid, 'SELECT') AS pode_select,
       has_table_privilege(r.oid, c.oid, 'INSERT') AS pode_insert,
       has_table_privilege(r.oid, c.oid, 'UPDATE') AS pode_update,
       has_table_privilege(r.oid, c.oid, 'DELETE') AS pode_delete
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  AND r.rolname IN ('anon', 'authenticated', 'service_role')
  AND c.relname IN ('pedidos', 'perfis', 'enderecos', 'produtos',
                   'carrinhos_salvos', 'clientes_com_compra', 'cupons_reservados')
ORDER BY c.relname, r.rolname;

-- 4. Compatibilidade das colunas com pagamento, perfil, frete e cupom.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('pedidos', 'perfis', 'enderecos', 'produtos',
                     'clientes_com_compra', 'cupons_reservados')
ORDER BY table_name, ordinal_position;

-- 5. Funções da campanha e execução restrita ao servidor.
SELECT p.proname AS funcao, pg_get_function_identity_arguments(p.oid) AS argumentos,
       p.prosecdef AS security_definer, r.rolname AS papel,
       has_function_privilege(r.oid, p.oid, 'EXECUTE') AS pode_executar
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.proname IN ('registrar_primeira_compra', 'reservar_cupom_primeira_compra')
  AND r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY p.proname, r.rolname;

-- 6. Trigger que mantém histórico de compras confirmadas.
SELECT t.tgname AS trigger, t.tgenabled AS habilitado,
       pg_get_triggerdef(t.oid) AS definicao
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'pedidos' AND NOT t.tgisinternal;

COMMIT;
