import { createClient } from '@supabase/supabase-js';
import { obterCupom, verificarPrimeiraCompra, precificarItens, calcularDesconto, reservarCupom } from './_lib/cupons.js';
import { anexosPersonalizacao } from './_lib/anexosPersonalizacao.js';
import { validarPersonalizacao } from './_lib/validarPersonalizacao.js';
import {
  enviarEmailCliente,
  enviarEmailAdmin,
  emailClienteCompraFeita,
  emailAdminVendaFeita,
} from './_lib/mailer.js';

export function criarHandlerPagamento(supabase, {
  fetchPagamento = fetch,
  enviarCliente = enviarEmailCliente,
  enviarAdmin = enviarEmailAdmin,
} = {}) {
  return async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { endereco, frete_valor, itens, redirect_base_url, cupom: codigoCupom } = req.body;
  if (!Array.isArray(itens) || !itens.length) return res.status(400).json({ error: 'Carrinho vazio ou inválido.' });
  if (Buffer.byteLength(JSON.stringify(req.body), 'utf8') > 3500000) return res.status(413).json({ error: 'Os arquivos do pedido estão muito grandes. Reduza o tamanho dos SVGs ou divida a compra em pedidos menores.' });
  for (const item of itens) {
    const erroPersonalizacao = validarPersonalizacao(item);
    if (erroPersonalizacao) return res.status(400).json({ error: erroPersonalizacao });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso negado: Token de autenticação ausente' });
  }
  
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Acesso negado: Token inválido ou expirado' });
  }

  // Busca o nome do usuário cadastrado na tabela "perfis" primeiro
  const { data: perfilDb } = await supabase
    .from('perfis')
    .select('nome')
    .eq('id', user.id)
    .single();

  const clienteNome = perfilDb?.nome || user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
  const clienteEmail = user.email;

  const handle = process.env.INFINITEPAY_HANDLE;
  const siteUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173';
  const webhookUrl = `${siteUrl}/api/webhook`;

  if (!handle && codigoCupom) {
    return res.status(503).json({ error: 'Pagamento com cupom indisponível no momento.' });
  }

  if (!handle) {
    console.log("Handle da InfinitePay não configurado. Retornando link simulado.");
    return res.status(200).json({
      link_pagamento: "https://pay.infinitepay.io/simulado",
      status: "pending"
    });
  }

  const pedido_id = crypto.randomUUID();
  let cupom = null;
  let desconto = null;
  let cupomReservado = false;
  let linkPodeExistir = false;

  try {
    if (codigoCupom) {
      cupom = obterCupom(codigoCupom);
      await verificarPrimeiraCompra(supabase, user.id);
    }
    // 1. REVALIDAÇÃO DE SEGURANÇA: Buscar o preço real dos produtos no banco de dados
    const productIds = itens.map(i => i.id);
    const { data: produtosDb, error: dbError } = await supabase
      .from('produtos')
      .select('id, preco, preco_promocional, opcoes')
      .in('id', productIds);

    if (dbError || !produtosDb) {
      throw new Error('Erro ao buscar produtos no banco para validação.');
    }

    // 2. Montar o payload da InfinitePay usando os preços reais do banco
    let items_payload = itens.map(item => {
      const produtoReal = produtosDb.find(p => p.id === item.id);
      if (!produtoReal) {
         throw new Error(`Produto ${item.id} não encontrado no banco.`);
      }
      
      // Determina o preço base (promocional ou normal)
      let precoReal = produtoReal.preco_promocional || produtoReal.preco;
      
      // Se for o Pagamento Personalizado, o preço vem do frontend
      if (item.isPagamentoPersonalizado) {
        precoReal = parseFloat(item.preco);
      } else {
        // Se houver uma opção escolhida e ela tiver acréscimo de preço, recalcula
        if (item.opcaoEscolhida && produtoReal.opcoes) {
           const opcaoReal = produtoReal.opcoes.find(o => o.nome === item.opcaoEscolhida);
           if (opcaoReal && opcaoReal.precoAcrescimo) {
              precoReal += opcaoReal.precoAcrescimo;
           }
        }
      }

      return {
        quantity: item.quantidade,
        price: Math.round(precoReal * 100),
        description: item.nome
      };
    });

    if (cupom) {
      const itensSeguros = await precificarItens(supabase, itens);
      desconto = calcularDesconto(itensSeguros, cupom);
      items_payload = desconto.itemsComDesconto;
    }

    // Se houver frete, adicionamos como um item extra no checkout
    if (frete_valor > 0) {
      items_payload.push({
        quantity: 1,
        price: Math.round(frete_valor * 100),
        description: "Frete / Entrega"
      });
    }

    const siteUrl_infinite = 'https://www.ijprint26.com';
    const webhookUrl_infinite = `${siteUrl_infinite}/api/webhook`;

    const body = {
      handle: handle,
      order_nsu: pedido_id.toString(),
      redirect_url: `${redirect_base_url}?pedido_id=${pedido_id}`,
      webhook_url: webhookUrl_infinite,
      customer: {
        name: clienteNome,
        email: clienteEmail
      },
      items: items_payload
    };

    if (cupom) {
      await reservarCupom(supabase, user.id, pedido_id, cupom.codigo);
      cupomReservado = true;
    }
    // Uma falha de rede pode ocorrer após a criação do link: preserve a reserva.
    linkPodeExistir = true;
    const response = await fetchPagamento('https://api.checkout.infinitepay.io/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      if (response.status >= 400 && response.status < 500 && response.status !== 408) linkPodeExistir = false;
      const errText = await response.text();
      let errMsg = errText;
      try {
        const errJson = JSON.parse(errText);
        errMsg = JSON.stringify(errJson, null, 2);
      } catch (e) {
        // Keeps raw text if not JSON
      }
      
      console.error("\n[INFINITEPAY API REJECTED]");
      console.error("Status:", response.status);
      console.error("Payload enviado:", JSON.stringify(body, null, 2));
      console.error("Mensagem exata da recusa:", errMsg);
      console.error("---------------------------\n");
      
      let clientErrorMsg = errMsg;
      try {
        const parsed = JSON.parse(errMsg);
        if (parsed.message) clientErrorMsg = parsed.message;
        if (parsed.error) clientErrorMsg = parsed.error;
        if (parsed.details) clientErrorMsg = JSON.stringify(parsed.details);
      } catch (e) {}

      throw new Error(`InfinitePay 422: ${clientErrorMsg}`);
    }

    const data = await response.json();
    const link_pagamento = data.url || `https://pay.infinitepay.io/${handle}`;

    // 4. Inserir o pedido no banco de dados SOMENTE após sucesso da InfinitePay
    const valorTotalSeguro = items_payload.reduce((acc, curr) => acc + curr.price * curr.quantity, 0) / 100;
    
    const novoPedido = {
      id: pedido_id,
      user_id: user.id,
      endereco: { ...endereco, cliente_nome: clienteNome, cliente_email: clienteEmail },
      itens,
      total: valorTotalSeguro,
      status: 'Aguardando Pagamento',
      ...(cupom ? { cupom_codigo: cupom.codigo, desconto: desconto.descontoCentavos / 100 } : {})
    };

    const { error: insertError } = await supabase.from('pedidos').insert(novoPedido);
    if (insertError) {
      console.error("Erro ao salvar pedido no banco após gerar link:", insertError);
      throw new Error('Erro ao salvar o pedido no sistema.');
    }

    // ==========================================
    // DISPARO DE E-MAILS: "Compra feita" (cliente) e "Venda feita" (admin)
    // Não deve bloquear a resposta ao cliente caso o Resend falhe.
    // ==========================================
    try {
      await Promise.all([
        enviarCliente({
          to: clienteEmail,
          ...emailClienteCompraFeita({
            clienteNome,
            pedidoId: pedido_id,
            valor: valorTotalSeguro,
            linkPagamento: link_pagamento,
          }),
        }),
        enviarAdmin({
          ...emailAdminVendaFeita({
            clienteNome,
            clienteEmail,
            pedidoId: pedido_id,
            valor: valorTotalSeguro,
          }),
          attachments: anexosPersonalizacao(itens),
        }),
      ]);
    } catch (emailError) {
      console.error('[Pagamento] Erro ao enviar e-mails de novo pedido:', emailError);
    }

    // O link para o cliente pagar fica em data.url
    res.status(200).json({
      link_pagamento,
      status: "pending"
    });
  } catch (error) {
    if (cupomReservado && !linkPodeExistir) {
      const { error: releaseError } = await supabase.from('cupons_reservados').delete().eq('pedido_id', pedido_id);
      if (releaseError) console.error('[Cupom] Falha ao liberar reserva:', releaseError);
    }
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || 'Erro ao gerar cobrança' });
  }
}
}

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  );
  return criarHandlerPagamento(supabase)(req, res);
}
