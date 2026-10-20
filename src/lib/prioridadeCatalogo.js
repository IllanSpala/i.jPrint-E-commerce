export function prioridadeCatalogo(produto) {
  if (produto.isPagamentoPersonalizado) return -1;
  if (produto.precoPromocional) return 0;
  if (produtoPersonalizado(produto)) return 1;
  return 2;
}
import { produtoPersonalizado } from './produtoPersonalizado.js';
