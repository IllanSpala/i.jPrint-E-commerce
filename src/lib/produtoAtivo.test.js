import test from 'node:test';
import assert from 'node:assert/strict';
import { produtos } from '../data/produtos.js';
import { produtoAtivo } from './produtoAtivo.js';
import { normalizarProduto } from './normalizarProduto.js';
import { precificarItens } from '../../api/_lib/cupons.js';

test('todos os produtos têm campo booleano explícito', () => {
  for (const p of produtos) assert.equal(typeof p.ativo, 'boolean', `Produto ${p.id}`);
});

test('código ou banco podem desativar; reativação precisa dos dois', async () => {
  const local = produtos.find(p => p.id === 79);
  const anterior = local.ativo;
  const registro = { id: 79, nome: 'Teste', preco: 12.9 };
  const db = { from: () => ({ select: () => ({ in: async () => ({ data: [registro] }) }) }) };
  try {
    for (const ativoLocal of [true, false]) {
      for (const ativoBanco of [undefined, true, false]) {
        local.ativo = ativoLocal;
        registro.ativo = ativoBanco;
        const esperado = ativoLocal && ativoBanco !== false;
        assert.equal(produtoAtivo(registro), esperado);
        assert.equal(normalizarProduto(registro).ativo, esperado);
        // Cliente não pode contornar o bloqueio enviando ativo:true no carrinho.
        const compra = precificarItens(db, [{ id: 79, quantidade: 1, ativo: true }]);
        if (esperado) assert.equal((await compra)[0].price, 1290);
        else await assert.rejects(compra, /temporariamente indisponível/);
      }
    }
  } finally { local.ativo = anterior; }
  assert.equal(produtoAtivo(null), false);
});
