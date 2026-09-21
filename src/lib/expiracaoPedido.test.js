import test from 'node:test';
import assert from 'node:assert/strict';
import { pedidoPendenteExpirado, PRAZO_PAGAMENTO_MS } from './expiracaoPedido.js';

const inicio = Date.parse('2026-09-21T10:00:00Z');
const pedido = { status: 'Aguardando Pagamento', created_at: new Date(inicio).toISOString() };

test('pendente expira exatamente aos 20 minutos, inclusive ao reabrir o painel', () => {
  assert.equal(pedidoPendenteExpirado(pedido, inicio + PRAZO_PAGAMENTO_MS - 1), false);
  assert.equal(pedidoPendenteExpirado(pedido, inicio + PRAZO_PAGAMENTO_MS), true);
  assert.equal(pedidoPendenteExpirado(pedido, inicio + 86400000), true);
});

test('confirmação tardia faz o pedido voltar à lista ativa sem alterar seu registro', () => {
  for (const status of ['Pago', 'Em Produção', 'Enviado', 'Concluído']) {
    assert.equal(pedidoPendenteExpirado({ ...pedido, status }, inicio + 86400000), false);
  }
  assert.equal(pedido.status, 'Aguardando Pagamento');
});

test('datas inválidas ou futuras não ocultam pedidos', () => {
  for (const created_at of [null, undefined, '', 'inválido']) {
    assert.equal(pedidoPendenteExpirado({ ...pedido, created_at }, inicio), false);
  }
  assert.equal(pedidoPendenteExpirado(pedido, inicio - 1), false);
});
