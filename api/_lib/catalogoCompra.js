import { carregarProntaEntrega } from '../../src/lib/estadoProntaEntrega.js';
import { prontaEntrega } from '../../src/data/prontaEntrega.js';

// Preços e dados da pronta entrega vêm do catálogo do servidor, nunca do cliente.
// Seus IDs são separados dos IDs numéricos de produtos sob encomenda.
export async function carregarCatalogoCompra(db, itens) {
  const possuiProntas = itens.some(item => prontaEntrega.some(p => p.id === item.id));
  const estados = possuiProntas ? await carregarProntaEntrega(db) : { data: [], error: null };
  if (estados.error) return { data: null, error: estados.error };
  const prontas = estados.data.filter(p => itens.some(item => item.id === p.id));
  const idsEncomendas = itens.filter(item => !prontaEntrega.some(p => p.id === item.id)).map(item => item.id);
  const ids = [...new Set([...idsEncomendas, ...prontas.map(p => p.modeloId)])];
  if (!ids.length) return { data: prontas, error: null };
  const { data, error } = await db.from('produtos').select('*').in('id', ids);
  if (error || !data) return { data: null, error: error || new Error('Catálogo indisponível.') };
  // O vínculo é definido no servidor: medidas enviadas pelo carrinho não são usadas.
  // Preço, identidade e estoque da peça pronta continuam independentes do modelo.
  const prontasComFrete = [];
  for (const peca of prontas) {
    const modelo = data.find(p => p.id === peca.modeloId);
    if (!modelo) return { data: null, error: new Error(`Modelo original não encontrado para ${peca.id}.`) };
    prontasComFrete.push({ ...peca, dimensoes: modelo.dimensoes, peso_gramas: modelo.peso_gramas });
  }
  return { data: [...data.filter(p => idsEncomendas.includes(p.id)), ...prontasComFrete], error: null };
}
