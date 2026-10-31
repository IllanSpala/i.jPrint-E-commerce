import test from 'node:test';
import assert from 'node:assert/strict';
import { prioridadeCatalogo } from './prioridadeCatalogo.js';
test('pagamento personalizado vem primeiro, seguido de promoções, paramétricos, personalizados e demais', () => {
 const itens = [
  {id:'comum',categoria:'Miniaturas'},
  {id:'multi',categoria:'Tabacaria',categorias:['Tabacaria','Personalizados']},
  {id:'parametrico',parametrico:true},
  {id:'hueforge',categoria:'Personalizados',tipoPersonalizacao:'filament_art'},
  {id:'editor3d',personalizador3d:true},
  {id:'pagamento',isPagamentoPersonalizado:true},
  {id:'promo',precoPromocional:10},
  {id:'promo-personalizado',categoria:'Personalizados',precoPromocional:20},
 ];
 assert.deepEqual([...itens].sort((a,b)=>prioridadeCatalogo(a)-prioridadeCatalogo(b)).map(p=>p.id),['pagamento','promo','promo-personalizado','parametrico','hueforge','editor3d','multi','comum']);
 assert.equal(prioridadeCatalogo({personalizador3d:true}),1);
 assert.equal(prioridadeCatalogo({exigePersonalizacao:true}),2);
});
