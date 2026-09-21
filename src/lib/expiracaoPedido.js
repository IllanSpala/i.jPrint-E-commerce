export const PRAZO_PAGAMENTO_MS = 20 * 60 * 1000;

// Expiração de exibição: nunca cancela a cobrança ou altera o pedido.
export function pedidoPendenteExpirado(pedido, agora = Date.now()) {
  const criadoEm = Date.parse(pedido.created_at);
  return pedido.status === 'Aguardando Pagamento'
    && Number.isFinite(criadoEm)
    && agora >= criadoEm + PRAZO_PAGAMENTO_MS;
}
