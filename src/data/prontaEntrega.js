import { produtos } from "./produtos.js";

// Preços unitários independentes definidos para cada peça pronta.
export const prontaEntrega = [
  { id: 'pronta-xenonita', prod_ativo: true, preco: 189.90, modeloId: 80, nome: 'Xenonita', categoria: 'Bustos', descricao: 'Pedra articulada, impressa e finalizada.', imagem: '/pronta-entrega/xenonita_real.png', imagens: ['/pronta-entrega/xenonita_real.png', '/pronta-entrega/xenonita_real2.png', '/pronta-entrega/xenonita_real3.png'] },
  { id: 'pronta-jax', prod_ativo: true, preco: 21.90, modeloId: 78, nome: 'Jax — Amazing Digital Circus', categoria: 'Miniaturas', descricao: 'Jax, de Amazing Digital Circus, impresso e finalizado.', imagem: '/pronta-entrega/jax_real.png' },
  { id: 'pronta-tony', prod_ativo: true, preco: 63.90, modeloId: 6, nome: 'Tony Montana — Scarface', categoria: 'Miniaturas', descricao: 'Peça finalizada com terno branco e detalhes vermelhos.', imagem: '/pronta-entrega/tony_real.png', imagens: ['/pronta-entrega/tony_real.png', '/pronta-entrega/tony_real2.png'] },
  { id: 'pronta-edward', prod_ativo: true, preco: 63.90, modeloId: 18, nome: 'Edward Mãos de Tesoura', categoria: 'Miniaturas', descricao: 'Peça finalizada com traje preto e mãos de tesoura.', imagem: '/pronta-entrega/edward_real.png', imagens: ['/pronta-entrega/edward_real.png', '/pronta-entrega/edward_real2.png'] },
  { id: 'pronta-luffy', prod_ativo: true, preco: 139.90, modeloId: 21, nome: 'Luffy Vascaino', categoria: 'Miniaturas', descricao: 'Peça finalizada da figure do Luffy com o pedido de personalização do Vasco Da Gama', imagem: '/pronta-entrega/luffy_real.png', imagens: ['/pronta-entrega/luffy_real.png', '/pronta-entrega/luffy_real2.png', '/pronta-entrega/luffy_real3.png'] }

].map(peca => {
  const modelo = produtos.find(p => p.id === peca.modeloId);
  return {
    ...peca, prontaEntrega: true, ativo: peca.prod_ativo,
    dimensoes: modelo?.dimensoes, peso_gramas: modelo?.peso_gramas
  };
});
