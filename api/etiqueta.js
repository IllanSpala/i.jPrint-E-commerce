export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { pedido_id, pedido } = req.body;
  const token = process.env.MELHOR_ENVIO_TOKEN;
  const cepOrigem = process.env.ORIGEM_CEP;

  if (!token || !cepOrigem) {
    return res.status(200).json({
      success: true,
      simulado: true,
      tracking_url: 'https://rastreamento.correios.com.br/app/index.php',
      message: 'Etiqueta simulada (configure MELHOR_ENVIO_TOKEN e ORIGEM_CEP)'
    });
  }

  try {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Aplicação ij-print26 (i.j.print26@gmail.com)'
    };

    // Passo 1: Adicionar itens ao carrinho do Melhor Envio
    const produtos = (pedido.itens || []).map(item => {
      const dims = item.dimensoes
        ? item.dimensoes.split('x').map(n => Math.max(1, Math.ceil(parseInt(n) / 10)))
        : [11, 11, 11];
      const pesoKg = item.peso_gramas ? Math.max(0.1, item.peso_gramas / 1000) : 0.3;
      return {
        name: item.nome,
        quantity: item.quantidade,
        unitary_value: item.preco,
        weight: pesoKg,
        width: dims[0],
        length: dims[1],
        height: dims[2],
      };
    });

    const cartRes = await fetch('https://melhorenvio.com.br/api/v2/me/cart', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        service: 1, // 1 = PAC, 2 = SEDEX (pode ser ajustado via frete selecionado)
        from: {
          name: 'I.J Print',
          postal_code: cepOrigem.replace(/\D/g, ''),
          email: 'i.j.print26@gmail.com'
        },
        to: {
          name: pedido.perfis?.nome || 'Cliente',
          postal_code: pedido.endereco?.cep?.replace(/\D/g, '') || '',
          address: pedido.endereco?.logradouro || '',
          number: pedido.endereco?.numero || 'S/N',
          district: pedido.endereco?.bairro || '',
          city: pedido.endereco?.cidade || '',
          state_abbr: pedido.endereco?.uf || '',
        },
        products: produtos,
        options: {
          receipt: false,
          own_hand: false
        },
        volumes: [{
          weight: produtos.reduce((s, p) => s + p.weight * p.quantity, 0),
          width: Math.max(...produtos.map(p => p.width)),
          length: Math.max(...produtos.map(p => p.length)),
          height: Math.max(...produtos.map(p => p.height))
        }],
        tag: { tag: `pedido-${pedido_id}`, url: null }
      })
    });

    if (!cartRes.ok) throw new Error('Falha ao adicionar ao carrinho do Melhor Envio');
    const cartData = await cartRes.json();

    const trackingUrl = `https://melhorenvio.com.br/envios/${cartData.id}`;

    // ==========================================
    // DISPARO DE E-MAIL: PEDIDO ENVIADO
    // ==========================================
    if (process.env.RESEND_API_KEY && pedido?.perfis?.email) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const clienteNome = pedido.perfis.nome || 'Cliente';

        await resend.emails.send({
          from: 'I.J Print <vendas@ijprint26.com>',
          to: pedido.perfis.email,
          subject: `Seu pedido está a caminho! 📦 - I.J Print`,
          html: `
            <div style="font-family: sans-serif; color: #111; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #c8a46e; padding: 20px; text-align: center;">
                <h1 style="color: #fff; margin: 0;">Pedido Enviado!</h1>
              </div>
              <div style="padding: 20px;">
                <p>Olá <strong>${clienteNome}</strong>,</p>
                <p>Seu pedido <strong>#${String(pedido_id).slice(0, 8).toUpperCase()}</strong> já foi embalado e a etiqueta de envio foi gerada.</p>
                <p>Para acompanhar a entrega, clique no botão abaixo:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${trackingUrl}" style="background-color: #111; color: #c8a46e; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Acompanhar Entrega</a>
                </div>
                <p>Muito obrigado pela sua compra!</p>
              </div>
            </div>
          `
        });
        console.log('[Melhor Envio] E-mail de envio disparado com sucesso.');
      } catch (err) {
        console.error('[Melhor Envio] Erro ao enviar e-mail de rastreio:', err);
      }
    }

    res.status(200).json({
      success: true,
      cart_id: cartData.id,
      tracking_url: trackingUrl,
      message: 'Etiqueta adicionada ao carrinho do Melhor Envio. Acesse o painel para pagar e imprimir.'
    });

  } catch (error) {
    console.error('Erro ao gerar etiqueta:', error);
    res.status(500).json({ error: 'Erro ao gerar etiqueta: ' + error.message });
  }
}
