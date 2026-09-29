import test from 'node:test';
import assert from 'node:assert/strict';
import { prontaEntrega } from '../src/data/prontaEntrega.js';
import { precificarItens } from '../api/_lib/cupons.js';
import { carregarCatalogoCompra } from '../api/_lib/catalogoCompra.js';

test('peças prontas têm preço provisório, dados de frete e IDs próprios', () => {
  assert.equal(prontaEntrega.length, 4);
  assert.equal(new Set(prontaEntrega.map(p => p.id)).size, 4);
  for (const p of prontaEntrega) {
    assert.equal(typeof p.prod_ativo, 'boolean');
    assert.ok(Number.isFinite(p.preco) && p.preco > 0);
    assert.ok(p.peso_gramas > 0);
    assert.match(p.dimensoes, /^\d+x\d+x\d+$/);
  }
});
test('preço da peça pronta é calculado no servidor, ignorando valor enviado', async () => {
  const db = { from(tabela) { assert.equal(tabela, 'pronta_entrega_estados'); return { select: async () => ({ data: prontaEntrega.map(p => ({id:p.id,ativo:true,ativo_admin:null})), error:null }) }; } };
  const linhas = await precificarItens(db, [{ id:'pronta-xenonita', preco:0.01, quantidade:2 }]);
  assert.equal(linhas[0].price, Math.round(prontaEntrega.find(p => p.id === 'pronta-xenonita').preco * 100));
  assert.equal(linhas[0].quantity, 2);
  await assert.rejects(precificarItens(db, [{ id:'pronta-xenonita', preco:0.01, quantidade:1, isPagamentoPersonalizado:true }]));
});
test('carrinho misto preserva preços do banco e consulta só IDs de encomendas', async () => {
  let consultados;
  const db = { from: tabela => tabela === 'pronta_entrega_estados' ? { select: async () => ({ data: prontaEntrega.map(p => ({id:p.id,ativo:true})), error:null }) } : ({ select: () => ({ in: async (_campo, ids) => {
    consultados = ids;
    return {data:[{id:6,nome:'Modelo sob encomenda',ativo:true,preco:99.9}],error:null};
  } }) }) };
  const itens=[{id:6,quantidade:1},{id:'pronta-tony',quantidade:1}];
  const precos=await precificarItens(db,itens);
  assert.deepEqual(consultados,[6]);
  assert.deepEqual(precos.map(p=>p.price),[9990,Math.round(prontaEntrega.find(p => p.id === 'pronta-tony').preco * 100)]);
  const {data}=await carregarCatalogoCompra(db,itens);
  assert.ok(data.find(p=>p.id==='pronta-tony').dimensoes);
});

import { carregarProntaEntrega } from '../src/lib/estadoProntaEntrega.js';
import { alterarProdutoAtivo } from '../api/produto-ativo.js';

test('remoção do estoque marca como esgotado, bloqueia compra e permite reposição', async () => {
  let estado = { id:'pronta-xenonita', ativo:true, ativo_admin:null };
  const db = { from(tabela) {
    assert.equal(tabela, 'pronta_entrega_estados');
    return {
      select: async () => ({data:[estado],error:null}),
      update(valores) { return { eq(campo,id) {
        assert.equal(campo,'id'); assert.equal(id,estado.id);
        return {select() {return {maybeSingle:async()=> {estado={...estado,...valores};return {data:estado,error:null};}};}};
      }};},
    };
  }};
  const res={status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
  await alterarProdutoAtivo({body:{id:estado.id,ativo:false}},res,db);
  assert.equal(res.code,200);
  const esgotada = (await carregarProntaEntrega(db)).data.find(p=>p.id===estado.id);
  assert.equal(esgotada.esgotado,true);
  assert.equal(esgotada.prod_ativo,true);
  await assert.rejects(precificarItens(db,[{id:estado.id,quantidade:1}]),/esgotado/);
  await alterarProdutoAtivo({body:{id:estado.id,ativo:true}},res,db);
  assert.equal((await precificarItens(db,[{id:estado.id,quantidade:1}]))[0].price,Math.round(prontaEntrega.find(p => p.id === estado.id).preco * 100));
});
test('falha ou ausência de estado não reativa itens pelo catálogo local', async () => {
  const db={from:()=>({select:async()=>({data:[],error:null})})};
  const result=await carregarProntaEntrega(db);
  assert.ok(result.data.every(p=>p.esgotado===true));
  assert.ok(result.data.every(p=>p.prod_ativo===true));
  await assert.rejects(precificarItens(db,[{id:'pronta-jax',quantidade:1}]),/esgotado/);
  const falha={from:()=>({select:async()=>({data:null,error:new Error('offline')})})};
  assert.equal((await carregarProntaEntrega(falha)).data,null);
  await assert.rejects(precificarItens(falha,[{id:'pronta-jax',quantidade:1}]),/preços/);
});
test('API rejeita ID pronto desconhecido antes de alterar o banco',async()=>{
 const res={status(code){this.code=code;return this;},json(){return this;}};
 await alterarProdutoAtivo({body:{id:'pronta-inexistente',ativo:false}},res,{});
 assert.equal(res.code,400);
});

import { atualizarPrecoProntaEntrega } from '../src/lib/atualizarPrecosProntaEntrega.js';
test('ausência da tabela permite catálogo local, mas não mascara erro de permissão', async()=>{
 const db=error=>({from:()=>({select:async()=>({data:null,error})})});
 const result=await carregarProntaEntrega(db({code:'PGRST205',message:"Could not find the table 'public.pronta_entrega_estados' in the schema cache"}));
 assert.equal(result.configuracaoPendente,true);
 assert.deepEqual(result.data.map(p=>p.preco),[189.9,21.9,63.9,63.9]);
 assert.equal((await carregarProntaEntrega(db({code:'42501',message:'permission denied'}))).data,null);
});
test('carrinho antigo recebe preço atual por peça sem alterar quantidade ou outros produtos',()=>{
 for (const p of prontaEntrega) {
   const item=atualizarPrecoProntaEntrega({id:p.id,preco:20,precoPromocional:10,quantidade:3,cartId:'salvo'});
   assert.equal(item.preco,p.preco); assert.equal(item.precoPromocional,null);
   assert.equal(item.quantidade,3); assert.equal(item.cartId,'salvo');
 }
 const encomenda={id:6,preco:123,quantidade:2};
 assert.equal(atualizarPrecoProntaEntrega(encomenda),encomenda);
});
