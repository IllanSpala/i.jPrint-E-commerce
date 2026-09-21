import { produtos as catalogoLocal } from '../../src/data/produtos.js';

export const CUPONS = Object.freeze({
  'COMPRE.IJ': { percentual: 10, primeiraCompra: true },
});

export function erroCupom(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export function obterCupom(codigo) {
  if (typeof codigo !== 'string') throw erroCupom('Informe um cupom válido.');
  const normalizado = codigo.trim().toUpperCase();
  if (!Object.hasOwn(CUPONS, normalizado)) throw erroCupom('Cupom inválido.');
  return { codigo: normalizado, ...CUPONS[normalizado] };
}

export async function verificarPrimeiraCompra(supabase, userId) {
  // O histórico é preservado mesmo se um pedido pago for excluído pelo admin.
  const { data: historico, error: erroHistorico } = await supabase
    .from('clientes_com_compra').select('user_id').eq('user_id', userId).maybeSingle();
  if (erroHistorico) throw erroCupom('Não foi possível validar a primeira compra. Tente novamente mais tarde.', 503);
  if (historico) throw erroCupom('Este cupom é exclusivo para a primeira compra.');

  const { data: reserva, error: erroReserva } = await supabase
    .from('cupons_reservados').select('user_id').eq('user_id', userId).maybeSingle();
  if (erroReserva) throw erroCupom('Não foi possível validar o cupom. Tente novamente mais tarde.', 503);
  if (reserva) throw erroCupom('Você já tem um pagamento com cupom em andamento. Use o link recebido por e-mail ou entre em contato com a loja.', 409);
}

export async function precificarItens(supabase, itens) {
  if (!Array.isArray(itens) || !itens.length || itens.length > 100) {
    throw erroCupom('Carrinho vazio ou inválido.');
  }
  const { data: produtos, error } = await supabase.from('produtos')
    .select('*')
    .in('id', itens.map((item) => item.id));
  if (error || !produtos) throw erroCupom('Não foi possível conferir os preços dos produtos.', 503);

  return itens.map((item) => {
    const produto = produtos.find((p) => p.id === item.id);
    if (!produto) throw erroCupom(`Produto ${item.id} não encontrado.`);
    if (!Number.isSafeInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 999) {
      throw erroCupom('Quantidade inválida no carrinho.');
    }
    if (produto.esgotado) throw erroCupom('Produto esgotado.');
    let preco = Number(produto.preco_promocional || produto.preco);
    const local = catalogoLocal.find(p => p.id === produto.id);
    const pagamentoPersonalizado = local?.isPagamentoPersonalizado === true;
    if (item.isPagamentoPersonalizado && !pagamentoPersonalizado) throw erroCupom('Produto não permite pagamento livre.');
    if (pagamentoPersonalizado) preco = Number(item.preco);
    else {
      const personalizado = local?.personalizador3d && (!local.personalizacao3dOpcional || item.modoCompra === 'personalizado');
      if (personalizado && item.opcaoEscolhida) throw erroCupom('A personalização não pode indicar uma opção pronta.');
      if (produto.opcoes?.length && !personalizado) {
        let escolha = null;
        for (const opcao of produto.opcoes) {
          if (opcao.variacoes?.length) {
            for (const variacao of opcao.variacoes) {
              if (`${opcao.nome} - ${variacao.nome}` === item.opcaoEscolhida) escolha = { opcao, variacao };
            }
          } else if (opcao.nome === item.opcaoEscolhida) escolha = { opcao };
        }
        if (!escolha || escolha.opcao.esgotado || escolha.variacao?.esgotado) throw erroCupom('Selecione uma opção disponível.');
        preco = Number(escolha.variacao?.preco || escolha.opcao.preco || (preco + Number(escolha.opcao.precoAcrescimo || 0)));
      } else if (item.opcaoEscolhida && !personalizado) throw erroCupom('Opção de produto inválida.');
    }
    const price = Math.round(preco * 100);
    if (!Number.isSafeInteger(price) || price <= 0) throw erroCupom('Preço inválido no carrinho.');
    return { quantity: item.quantidade, price, description: produto.nome || item.nome };
  });
}

export function calcularDesconto(items, cupom) {
  const subtotalCentavos = items.reduce((total, item) => total + item.price * item.quantity, 0);
  if (!Number.isSafeInteger(subtotalCentavos)) throw erroCupom('Total inválido.');
  const descontoCentavos = Math.round(subtotalCentavos * cupom.percentual / 100);
  if (descontoCentavos < 1) throw erroCupom('Subtotal insuficiente para aplicar o cupom.');

  // Distribui o desconto em centavos, sem item negativo e sem descontar o frete.
  // Divide uma linha apenas quando unidades precisam diferir em um centavo.
  let subtotalAcumulado = 0;
  let descontoDistribuido = 0;
  const itemsComDesconto = items.flatMap((item) => {
    const totalLinha = item.price * item.quantity;
    subtotalAcumulado += totalLinha;
    const descontoAcumulado = Math.round(descontoCentavos * subtotalAcumulado / subtotalCentavos);
    const totalLiquido = totalLinha - (descontoAcumulado - descontoDistribuido);
    descontoDistribuido = descontoAcumulado;
    const price = Math.floor(totalLiquido / item.quantity);
    const restantes = totalLiquido % item.quantity;
    if (price < 1) throw erroCupom('Um dos itens tem valor insuficiente para aplicar o cupom.');
    return [
      { ...item, quantity: item.quantity - restantes, price },
      ...(restantes ? [{ ...item, quantity: restantes, price: price + 1 }] : []),
    ].filter((linha) => linha.quantity > 0);
  });
  return { subtotalCentavos, descontoCentavos, itemsComDesconto };
}

export async function reservarCupom(supabase, userId, pedidoId, codigo) {
  const { data, error } = await supabase.rpc('reservar_cupom_primeira_compra', {
    p_user_id: userId, p_pedido_id: pedidoId, p_codigo: codigo,
  });
  if (error) throw erroCupom('Não foi possível reservar o cupom. Tente novamente mais tarde.', 503);
  if (data === 'cliente_existente') throw erroCupom('Este cupom é exclusivo para a primeira compra.');
  if (data !== 'reservado') throw erroCupom('Você já tem um pagamento com cupom em andamento. Use o link recebido por e-mail ou entre em contato com a loja.', 409);
}
