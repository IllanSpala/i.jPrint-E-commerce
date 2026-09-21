-- Executar depois de seguranca_vendas.sql. Não exclui dados ao ser instalado.
begin;
create or replace function public.excluir_pedido_sem_cobranca(p_pedido_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare pedido public.pedidos%rowtype;
begin
  select * into pedido from public.pedidos where id = p_pedido_id for update;
  if not found then return false; end if;
  if pedido.status is distinct from 'Aguardando Pagamento'
    or pedido.checkout_estado is distinct from 'falhou'
    or pedido.link_pagamento is not null
    or pedido.pagamento_transacao is not null
    or pedido.pagamento_slug is not null
    or pedido.pagamento_confirmado_em is not null
    or pedido.melhor_envio_cart_id is not null
    or pedido.tracking_url is not null
    or pedido.etiqueta_estado is distinct from 'pendente'
    or exists(select 1 from public.notificacoes_pedidos where pedido_id = p_pedido_id)
  then return false; end if;

  delete from public.cupons_reservados where pedido_id = p_pedido_id;
  delete from public.pedidos where id = p_pedido_id;
  return true;
end;
$$;
revoke all on function public.excluir_pedido_sem_cobranca(uuid) from public, anon, authenticated;
grant execute on function public.excluir_pedido_sem_cobranca(uuid) to service_role;
commit;
