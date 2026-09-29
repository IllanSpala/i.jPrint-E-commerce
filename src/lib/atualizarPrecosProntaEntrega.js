import { prontaEntrega } from '../data/prontaEntrega.js';

// O carrinho persistido pode conter preços antigos. Atualiza somente peças prontas
// conhecidas, preservando quantidades e identificadores do carrinho.
export function atualizarPrecoProntaEntrega(item) {
  const peca = prontaEntrega.find(p => p.id === item?.id);
  return peca ? { ...item, preco: peca.preco, precoPromocional: null } : item;
}
