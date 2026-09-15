import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarProduto } from './normalizarProduto.js';
import { validarPersonalizacao } from '../../api/_lib/validarPersonalizacao.js';
import { produtos } from '../data/produtos.js';

test('rolling tray mantém catálogo híbrido mesmo com registro antigo no banco', () => {
  const p = normalizarProduto({ id: 52, nome: 'Rolling Trays Variados', dimensoes: '210x150x20', preco: 42, personalizador3d: false });
  assert.equal(p.nome, 'Rolling Tray personalizado');
  assert.equal(p.dimensoes, '180x120x10');
  assert.equal(p.preco, 42);
  assert.equal(p.personalizacao3dOpcional, true);
  assert.equal(p.modelo3d, '/svg/BASE_ROLLING_TRAY.stl');
  assert.deepEqual(p.categorias, ['Tabacaria', 'Personalizados']);
  assert.equal(p.opcoes.length, produtos.find(p => p.id === 52).opcoes.length);
});

test('pedido aceita opção pronta sem SVG somente no produto híbrido', () => {
  const item = { id: 52, modoCompra: 'pronto', opcaoEscolhida: 'Master Shake', quantidade: 1 };
  assert.equal(validarPersonalizacao(item), null);
  assert.ok(validarPersonalizacao({ ...item, opcaoEscolhida: '' }));
  assert.ok(validarPersonalizacao({ ...item, opcaoEscolhida: 'inexistente' }));
  assert.ok(validarPersonalizacao({ ...item, id: 70 }));
  assert.ok(validarPersonalizacao({ ...item, modoCompra: 'personalizado' }));
  assert.equal(validarPersonalizacao({ id: 52, modoCompra: 'personalizado', quantidade: 1, personalizacoes: [{ svg: '<svg/>' }] }), null);
  assert.ok(validarPersonalizacao({ id: 52, modoCompra: 'personalizado', quantidade: 2, personalizacoes: [{ svg: '<svg/>' }] }));
});
