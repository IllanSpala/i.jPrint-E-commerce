import { carregarProntaEntrega } from '../../src/lib/estadoProntaEntrega.js';
import { prontaEntrega } from '../../src/data/prontaEntrega.js';

// Preços e dados da pronta entrega vêm do catálogo do servidor, nunca do cliente.
// Seus IDs são separados dos IDs numéricos de produtos sob encomenda.
export async function carregarCatalogoCompra(db, itens) {
  const possuiProntas = itens.some(item => prontaEntrega.some(p => p.id === item.id));
  const estados = possuiProntas ? await carregarProntaEntrega(db) : { data: [], error: null };
  if (estados.error) return { data: null, error: estados.error };
  const prontas = estados.data.filter(p => itens.some(item => item.id === p.id));
  const ids = [...new Set(itens.filter(item => !prontaEntrega.some(p => p.id === item.id)).map(item => item.id))];
  if (!ids.length) return { data: prontas, error: null };
  const { data, error } = await db.from('produtos').select('*').in('id', ids);
  return { data: error || !data ? null : [...data, ...prontas], error };
}
