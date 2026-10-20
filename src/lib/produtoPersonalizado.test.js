import test from 'node:test';
import assert from 'node:assert/strict';
import { produtoPersonalizado } from './produtoPersonalizado.js';
import { produtos } from '../data/produtos.js';
import { normalizarProduto } from './normalizarProduto.js';

test('reconhece categoria principal e secundária mesmo sem campos de personalização', () => {
 assert.equal(produtoPersonalizado({categoria:'Personalizados',exigePersonalizacao:false}),true);
 assert.equal(produtoPersonalizado({categoria:'Acessórios',categorias:['Acessórios','Personalizados']}),true);
 for (const campo of ['exigePersonalizacao','personalizador3d','isPagamentoPersonalizado']) assert.equal(produtoPersonalizado({[campo]:true}),true);
 assert.equal(produtoPersonalizado({categoria:'Miniaturas',categorias:['Miniaturas']}),false);
});
test('todos os personalizados do catálogo mantêm identificação após leitura do banco', () => {
 const personalizados = produtos.filter(p=>[p.categoria,...(p.categorias||[])].includes('Personalizados'));
 assert.ok(personalizados.length > 0);
 for (const p of personalizados) {
  assert.equal(produtoPersonalizado(p),true,p.nome);
  assert.equal(produtoPersonalizado(normalizarProduto({id:p.id,exige_personalizacao:false})),true,p.nome);
 }
 assert.equal(produtoPersonalizado(produtos.find(p=>p.id===64)),true);
});
