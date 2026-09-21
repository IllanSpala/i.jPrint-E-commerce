import { produtos } from '../data/produtos.js';

export function produtoAtivo(produto) {
  if (!produto) return false;
  const local = produtos.find(p => String(p.id) === String(produto.id));
  return produto.ativo !== false && local?.ativo !== false;
}
