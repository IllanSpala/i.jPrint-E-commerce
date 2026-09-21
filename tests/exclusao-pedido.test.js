import test from 'node:test';
import assert from 'node:assert/strict';
import { excluirPedidoSemCobranca } from '../api/cancelar.js';

for (const [nome, resultado, esperado] of [
  ['exclusão confirmada', { data: true }, 200],
  ['pedido protegido ou inexistente', { data: false }, 409],
  ['migração ausente ou banco indisponível', { error: { message: 'interno' } }, 503],
]) test(nome, async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await excluirPedidoSemCobranca({ body: { pedido_id: id, status: 'falhou' } }, res, {
    async rpc(nome, args) {
      assert.equal(nome, 'excluir_pedido_sem_cobranca');
      assert.deepEqual(args, { p_pedido_id: id });
      return resultado;
    },
  });
  assert.equal(res.code, esperado);
});

test('ID inválido não acessa o banco', async () => {
  const res = { status(code) { this.code = code; return this; }, json() { return this; } };
  await excluirPedidoSemCobranca({ body: { pedido_id: 'inválido' } }, res, {
    rpc() { assert.fail('Não deveria consultar o banco'); },
  });
  assert.equal(res.code, 400);
});
