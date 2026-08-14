import { createClient } from '@supabase/supabase-js';
import {
  enviarEmailCliente,
  buscarEmailCliente,
  emailClientePedidoEnviado,
} from './_lib/mailer.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

function gerarReciboHtml(pedido, isRetirada) {
  const clienteNome = pedido.perfis?.nome || pedido.endereco?.cliente_nome || 'Cliente Desconhecido';
  const dataPedido = new Date(pedido.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  
  const htmlItens = (pedido.itens || []).map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.quantidade}x</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">
        ${item.nome} ${item.opcaoEscolhida ? `(${item.opcaoEscolhida})` : ''}
        ${item.personalizacao ? `<br/><small><i>Personalização: ${item.personalizacao}</i></small>` : ''}
        ${item.parametrosMultiplos ? `<br/><small><i>Nomes: ${item.parametrosMultiplos.join(', ')}</i></small>` : ''}
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">R$ ${((item.precoPromocional || item.preco) * item.quantidade).toFixed(2).replace('.', ',')}</td>
    </tr>
  `).join('');

  return `
    <html>
      <head>
        <title>Recibo - Pedido #${pedido.id.split('-')[0].toUpperCase()}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          .container { max-width: 800px; margin: 0 auto; border: 1px solid #ccc; padding: 30px; border-radius: 8px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
          .header p { margin: 5px 0 0; color: #666; }
          .info-grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .info-box { width: 48%; }
          .info-box h3 { border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px; font-size: 14px; color: #666; text-transform: uppercase; }
          .info-box p { margin: 5px 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f5f5f5; padding: 10px; text-align: left; font-size: 14px; text-transform: uppercase; border-bottom: 2px solid #ddd; }
          .total-box { text-align: right; font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 15px; }
          .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #999; }
          @media print {
            body { -webkit-print-color-adjust: exact; padding: 0; }
            .container { border: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>I.J Print - Recibo de Entrega</h1>
            <p>Data do Pedido: ${dataPedido} | ID: #${pedido.id.split('-')[0].toUpperCase()}</p>
            ${isRetirada ? '<h2 style="color: #10b981; margin: 10px 0 0;">PEDIDO PARA RETIRADA LOCAL</h2>' : '<h2 style="color: #3b82f6; margin: 10px 0 0;">PEDIDO PARA ENVIO VIA CORREIOS</h2>'}
          </div>
          
          <div class="info-grid">
            <div class="info-box">
              <h3>Dados do Cliente</h3>
              <p><strong>Nome:</strong> ${clienteNome}</p>
              <p><strong>WhatsApp:</strong> ${pedido.perfis?.telefone || 'Não informado'}</p>
            </div>
            <div class="info-box">
              <h3>Endereço de ${isRetirada ? 'Retirada' : 'Entrega'}</h3>
              <p>${pedido.endereco?.logradouro || pedido.endereco?.rua || 'Não informado'}, ${pedido.endereco?.numero || 'S/N'}</p>
              <p>${pedido.endereco?.complemento ? pedido.endereco.complemento + '<br/>' : ''}</p>
              <p>${pedido.endereco?.bairro || ''} - ${pedido.endereco?.cidade || ''} / ${pedido.endereco?.uf || ''}</p>
              <p><strong>CEP:</strong> ${pedido.endereco?.cep || '-'}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Qtd</th>
                <th>Item</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${htmlItens}
            </tbody>
          </table>

          <div class="total-box">
            TOTAL PAGO: R$ ${Number(pedido.total).toFixed(2).replace('.', ',')}
          </div>
          
          <div class="footer">
            Documento auxiliar de conferência de estoque gerado pelo sistema I.J Print.
          </div>
        </div>
      </body>
    </html>
  `;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { pedido_id, pedido } = req.body;
  const token = process.env.MELHOR_ENVIO_TOKEN;
  const cepOrigem = process.env.ORIGEM_CEP;

  const logradouro = (pedido.endereco?.logradouro || pedido.endereco?.rua || '').toLowerCase();
  const isRetirada = logradouro.includes('guararema') || logradouro.includes('retirada') || pedido.endereco?.cep === '-';

  try {
    // PROTEÇÃO CONTRA DUPLO CLIQUE / REGRESSÃO
    // Busca o status atual no banco antes de fazer qualquer coisa
    const { data: pedidoAtual, error: errBusca } = await supabase
      .from('pedidos')
      .select('status')
      .eq('id', pedido_id)
      .single();

    if (errBusca || !pedidoAtual) {
      throw new Error('Falha ao verificar status do pedido no banco.');
    }

    if (pedidoAtual.status === 'Enviado' || pedidoAtual.status === 'Concluído') {
      return res.status(400).json({ error: `Este pedido já foi processado (Status: ${pedidoAtual.status}). Não é possível gerar etiqueta ou enviar e-mail novamente.` });
    }

    let trackingUrl = null;
    let cartData = null;

    if (!isRetirada) {
      if (!token || !cepOrigem) {
        trackingUrl = 'https://rastreamento.correios.com.br/app/index.php';
      } else {
        const headers = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Aplicação ij-print26 (i.j.print26@gmail.com)'
        };

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
            service: 1, 
            from: {
              name: 'I.J Print',
              postal_code: cepOrigem.replace(/\D/g, ''),
              address: 'Quadra da Guararema',
              number: 'S/N',
              city: 'Alegre',
              state_abbr: 'ES',
              email: 'i.j.print26@gmail.com'
            },
            to: {
              name: pedido.perfis?.nome || pedido.endereco?.cliente_nome || 'Cliente',
              postal_code: pedido.endereco?.cep?.replace(/\D/g, '') || '',
              address: pedido.endereco?.logradouro || pedido.endereco?.rua || '',
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

        if (!cartRes.ok) {
          const errBody = await cartRes.text();
          console.error('[Melhor Envio] Erro na API:', cartRes.status, errBody);
          throw new Error(`Falha ao adicionar ao carrinho do Melhor Envio (${cartRes.status}): ${errBody}`);
        }
        cartData = await cartRes.json();
        trackingUrl = `https://melhorenvio.com.br/envios/${cartData.id}`;
      }

      // Envia E-mail de Envio (apenas para Envios via Correios)
      try {
        const clienteEmailEnvio = pedido?.user_id
          ? await buscarEmailCliente(supabase, pedido.user_id)
          : pedido.endereco?.cliente_email || null;

        if (clienteEmailEnvio) {
          const clienteNome = pedido.perfis?.nome || pedido.endereco?.cliente_nome || 'Cliente';
          await enviarEmailCliente({
            to: clienteEmailEnvio,
            ...emailClientePedidoEnviado({ clienteNome, pedidoId: pedido_id, trackingUrl }),
          });
          console.log('[Melhor Envio] E-mail de envio disparado com sucesso.');
        }
      } catch (err) {
        console.error('[Melhor Envio] Erro ao enviar e-mail de rastreio:', err);
      }
    } else {
      // Se for retirada local, enviamos e-mail avisando que está pronto para retirar
      try {
        const clienteEmailEnvio = pedido?.user_id
          ? await buscarEmailCliente(supabase, pedido.user_id)
          : pedido.endereco?.cliente_email || null;

        if (clienteEmailEnvio) {
          const clienteNome = pedido.perfis?.nome || pedido.endereco?.cliente_nome || 'Cliente';
          await enviarEmailCliente({
            to: clienteEmailEnvio,
            subject: 'Seu pedido está pronto para retirada! 📦 - I.J Print',
            html: `
              <div style="font-family: sans-serif; color: #111; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #10b981; padding: 20px; text-align: center;">
                  <h1 style="color: #fff; margin: 0; font-size: 20px;">Pedido Pronto para Retirada!</h1>
                </div>
                <div style="padding: 20px;">
                  <p>Olá <strong>${clienteNome}</strong>,</p>
                  <p>Boas notícias! Seu pedido <strong>#${String(pedido_id).slice(0,8).toUpperCase()}</strong> já foi embalado e está pronto para ser retirado.</p>
                  <p>Você pode combinar o melhor horário para retirar diretamente conosco pelo WhatsApp.</p>
                  <p>Muito obrigado pela sua compra!</p>
                </div>
              </div>
            `
          });
        }
      } catch (err) {
        console.error('[Retirada] Erro ao enviar e-mail de retirada:', err);
      }
    }

    const reciboHtml = gerarReciboHtml(pedido, isRetirada);

    res.status(200).json({
      success: true,
      cart_id: cartData?.id,
      tracking_url: trackingUrl,
      html_recibo: reciboHtml,
      is_retirada: isRetirada,
      message: isRetirada ? 'Recibo gerado para Retirada.' : 'Etiqueta adicionada ao Melhor Envio e Recibo gerado.'
    });

  } catch (error) {
    console.error('Erro ao gerar etiqueta:', error);
    res.status(500).json({ error: 'Erro ao gerar etiqueta: ' + error.message });
  }
}
