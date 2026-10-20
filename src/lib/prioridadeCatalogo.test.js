import test from 'node:test';
import assert from 'node:assert/strict';
import { prioridadeCatalogo } from './prioridadeCatalogo.js';
test('pagamento personalizado vem primeiro, seguido de promoções, personalizados e demais', () => {
 const itens = [
  {id:'comum',categoria:'Miniaturas'},
  {id:'multi',categoria:'Tabacaria',categorias:['Tabacaria','Personalizados']},
  {id:'pagamento',isPagamentoPersonalizado:true},
  {id:'promo',precoPromocional:10},
  {id:'promo-personalizado',categoria:'Personalizados',precoPromocional:20},
 ];
 assert.deepEqual([...itens].sort((a,b)=>prioridadeCatalogo(a)-prioridadeCatalogo(b)).map(p=>p.id),['pagamento','promo','promo-personalizado','multi','comum']);
 assert.equal(prioridadeCatalogo({personalizador3d:true}),1);
 assert.equal(prioridadeCatalogo({exigePersonalizacao:true}),1);
});
