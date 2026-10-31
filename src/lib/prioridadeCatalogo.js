import { produtoPersonalizado } from './produtoPersonalizado.js';

export function prioridadeCatalogo(produto) {
  if (produto.isPagamentoPersonalizado) return -1;
  if (produto.precoPromocional) return 0;
  if (produto.parametrico || produto.personalizador3d || produto.tipoPersonalizacao === 'filament_art') return 1;
  if (produtoPersonalizado(produto)) return 2;
  return 3;
}
