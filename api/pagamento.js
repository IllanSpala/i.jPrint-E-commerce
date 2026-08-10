import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { pedido_id, valor_total, frete_valor, itens, cliente, redirect_url } = req.body;
  const handle = process.env.INFINITEPAY_HANDLE;
  const siteUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173';
  const webhookUrl = `${siteUrl}/api/webhook`;

  if (!handle) {
    console.log("Handle da InfinitePay não configurado. Retornando link simulado.");
    return res.status(200).json({
      link_pagamento: "https://pay.infinitepay.io/simulado",
      status: "pending"
    });
  }

  try {
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
    const items_payload = itens.map(item => {
      const produtoReal = produtosDb.find(p => p.id === item.id);
      if (!produtoReal) {
         throw new Error(`Produto ${item.id} não encontrado no banco.`);
      }
      
      // Determina o preço base (promocional ou normal)
      let precoReal = produtoReal.preco_promocional || produtoReal.preco;
      
      // Se houver uma opção escolhida e ela tiver acréscimo de preço, recalcula
      if (item.opcaoEscolhida && produtoReal.opcoes) {
         const opcaoReal = produtoReal.opcoes.find(o => o.nome === item.opcaoEscolhida);
         if (opcaoReal && opcaoReal.precoAcrescimo) {
            precoReal += opcaoReal.precoAcrescimo;
         }
      }

      return {
        quantity: item.quantidade,
        price: Math.round(precoReal * 100),
        description: item.nome
      };
    });

    // 3. Atualizar o valor total do pedido no banco de dados com o valor seguro recalculado
    let valorTotalSeguro = items_payload.reduce((acc, curr) => acc + ((curr.price / 100) * curr.quantity), 0);
    if (frete_valor > 0) valorTotalSeguro += frete_valor;

    await supabase
      .from('pedidos')
      .update({ total: valorTotalSeguro })
      .eq('id', pedido_id);

    // Se houver frete, adicionamos como um item extra no checkout
    if (frete_valor > 0) {
      items_payload.push({
        quantity: 1,
        price: Math.round(frete_valor * 100),
        description: "Frete / Entrega"
      });
    }

    const siteUrl = 'https://www.ijprint26.com';
    const webhookUrl = `${siteUrl}/api/webhook`;

    const body = {
      handle: handle,
      order_nsu: pedido_id.toString(),
      items: items_payload,
      customer: {
        name: cliente.nome,
        email: cliente.email
      },
      metadata: {
        pedido_id: pedido_id.toString()
      },
      // Redireciona o cliente de volta ao site após o pagamento
      redirect_url: redirect_url || `${siteUrl}/pedido-confirmado?pedido_id=${pedido_id}`,
      // InfinitePay vai notificar nosso backend quando o pagamento for confirmado
      webhook_url: webhookUrl
    };

    const response = await fetch('https://api.checkout.infinitepay.io/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errData = await response.text();
      console.error("Erro InfinitePay:", errData);
      throw new Error('Falha ao gerar link na InfinitePay');
    }

    const data = await response.json();
    
    // O link para o cliente pagar fica em data.url
    res.status(200).json({
      link_pagamento: data.url || `https://pay.infinitepay.io/${handle}`,
      status: "pending"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Erro ao gerar cobrança' });
  }
}
