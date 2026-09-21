import test from 'node:test';
import assert from 'node:assert/strict';
import { deveSincronizar, sincronizarNovosProdutos } from '../scripts/sincronizar-novos-produtos.js';

test('somente deploy de produção cadastra produtos', () => {
  for (const env of [{}, { VERCEL: '1' }, { VERCEL: '1', VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'production' }]) {
    assert.equal(deveSincronizar(env), false);
  }
  assert.equal(deveSincronizar({ VERCEL: '1', VERCEL_ENV: 'production' }), true);
});

test('inserção usa conflito por ID sem sobrescrever e envia medidas do novo item', async () => {
  const db = { from(tabela) {
    assert.equal(tabela, 'produtos');
    return { upsert(registros, opcoes) {
      assert.deepEqual(opcoes, { onConflict: 'id', ignoreDuplicates: true });
      assert.equal(registros[0].peso_gramas, 15);
      assert.equal(registros[0].dimensoes, '70x40x10');
      assert.equal(registros[0].preco, 12.9);
      return { select(campos) {
        assert.equal(campos, 'id');
        return { abortSignal: async () => ({ data: [{ id: 79 }], error: null }) };
      } };
    } };
  } };
  assert.equal(await sincronizarNovosProdutos(db, [{ id: 79, preco: 12.9, peso_gramas: 15, dimensoes: '70x40x10' }]), 1);
});

test('falha no banco interrompe sincronização sem revelar mensagem interna', async () => {
  const db = { from: () => ({ upsert: () => ({ select: () => ({ abortSignal: async () => ({ error: { code: '42501', message: 'dado interno' } }) }) }) }) };
  await assert.rejects(sincronizarNovosProdutos(db, [{ id: 79 }]), { message: 'Falha ao cadastrar novos produtos (42501).' });
});
