// Módulo compartilhado de e-mails (Resend). Centraliza os templates e o envio
// para evitar duplicar HTML entre api/pagamento.js, api/webhook.js,
// api/status.js, api/cancelar.js e api/etiqueta.js.
//
// Arquivos que começam com "_" dentro de /api não viram rotas na Vercel,
// então este arquivo pode ser importado livremente pelos outros.

export const ADMIN_EMAIL = 'i.j.print26@gmail.com';
const FROM_CLIENTE = 'I.J Print <vendas@ijprint26.com>';
const FROM_SISTEMA = 'Sistema I.J Print <sistema@ijprint26.com>';

let resendClientPromise = null;
async function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClientPromise) {
    resendClientPromise = import('resend').then(({ Resend }) => new Resend(process.env.RESEND_API_KEY));
  }
  return resendClientPromise;
}

export function formatarValor(total) {
  return Number(total || 0).toFixed(2).replace('.', ',');
}

export function formatarPedidoId(pedidoId) {
  return String(pedidoId).slice(0, 8).toUpperCase();
}

// Busca o e-mail do cliente na tabela de autenticação do Supabase.
// A tabela "perfis" NÃO tem coluna "email" (fica escondida em auth.users),
// então isso exige um client instanciado com a SUPABASE_SERVICE_ROLE_KEY.
export async function buscarEmailCliente(supabase, userId) {
  if (!userId) return null;
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    console.error('[Mailer] Erro ao buscar email do cliente:', error);
    return null;
  }
  return data?.user?.email || null;
}

function wrapClienteHtml({ corFundo, titulo, corpoHtml }) {
  return `
    <div style="font-family: sans-serif; color: #111; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
      <div style="background-color: ${corFundo}; padding: 20px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">${titulo}</h1>
      </div>
      <div style="padding: 20px;">
        ${corpoHtml}
      </div>
    </div>
  `;
}

function wrapAdminHtml({ titulo, corpoHtml }) {
  return `
    <div style="font-family: sans-serif; color: #111;">
      <h2 style="margin: 0 0 12px;">${titulo}</h2>
      ${corpoHtml}
    </div>
  `;
}

async function enviarEmail({ from, to, subject, html }) {
  const resend = await getResend();
  if (!resend || !to) return { skipped: true };
  try {
    await resend.emails.send({ from, to, subject, html });
    return { sent: true };
  } catch (error) {
    console.error(`[Mailer] Falha ao enviar "${subject}" para ${to}:`, error);
    return { sent: false, error };
  }
}

export function enviarEmailCliente({ to, subject, html }) {
  return enviarEmail({ from: FROM_CLIENTE, to, subject, html });
}

export function enviarEmailAdmin({ subject, html }) {
  return enviarEmail({ from: FROM_SISTEMA, to: ADMIN_EMAIL, subject, html });
}

// ==================== TEMPLATES: CLIENTE ====================

export function emailClienteCompraFeita({ clienteNome, pedidoId, valor, linkPagamento }) {
  return {
    subject: 'Recebemos seu pedido! 🛍️ - I.J Print',
    html: wrapClienteHtml({
      corFundo: '#c8a46e',
      titulo: 'Pedido Recebido!',
      corpoHtml: `
        <p>Olá <strong>${clienteNome}</strong>,</p>
        <p>Recebemos seu pedido <strong>#${formatarPedidoId(pedidoId)}</strong> no valor de <strong>R$ ${formatarValor(valor)}</strong>.</p>
        <p>Para colocarmos suas peças na fila de produção, é só concluir o pagamento pelo link abaixo:</p>
        ${linkPagamento ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${linkPagamento}" style="background-color: #111; color: #c8a46e; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Pagar agora</a>
        </div>` : ''}
        <p>Assim que o pagamento for aprovado, você recebe uma confirmação por aqui.</p>
        <br/>
        <p>Obrigado por escolher a I.J Print!</p>
      `
    })
  };
}

export function emailClientePagamentoConfirmado({ clienteNome, pedidoId, valor }) {
  return {
    subject: 'Pagamento Confirmado! 🚀 - I.J Print',
    html: wrapClienteHtml({
      corFundo: '#c8a46e',
      titulo: 'Pagamento Confirmado!',
      corpoHtml: `
        <p>Olá <strong>${clienteNome}</strong>,</p>
        <p>Boas notícias! Seu pagamento de <strong>R$ ${formatarValor(valor)}</strong> referente ao pedido <strong>#${formatarPedidoId(pedidoId)}</strong> foi aprovado.</p>
        <p>Já estamos preparando suas peças 3D com muito carinho. Você será avisado quando o pedido for enviado!</p>
        <br/>
        <p>Obrigado por escolher a I.J Print!</p>
      `
    })
  };
}

export function emailClienteAcompanhamento({ clienteNome, pedidoId }) {
  return {
    subject: 'Seu pedido está em produção 🛠️ - I.J Print',
    html: wrapClienteHtml({
      corFundo: '#3b82f6',
      titulo: 'Pedido em Produção',
      corpoHtml: `
        <p>Olá <strong>${clienteNome}</strong>,</p>
        <p>Seu pedido <strong>#${formatarPedidoId(pedidoId)}</strong> entrou na fila de produção e já estamos imprimindo suas peças.</p>
        <p>Assim que ele for despachado, você recebe o código de rastreio por aqui.</p>
        <br/>
        <p>Obrigado pela paciência e pela confiança na I.J Print!</p>
      `
    })
  };
}

export function emailClientePedidoEnviado({ clienteNome, pedidoId, trackingUrl }) {
  return {
    subject: 'Seu pedido está a caminho! 📦 - I.J Print',
    html: wrapClienteHtml({
      corFundo: '#c8a46e',
      titulo: 'Pedido Enviado!',
      corpoHtml: `
        <p>Olá <strong>${clienteNome}</strong>,</p>
        <p>Seu pedido <strong>#${formatarPedidoId(pedidoId)}</strong> já foi embalado e a etiqueta de envio foi gerada.</p>
        <p>Para acompanhar a entrega, clique no botão abaixo:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${trackingUrl}" style="background-color: #111; color: #c8a46e; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Acompanhar Entrega</a>
        </div>
        <p>Muito obrigado pela sua compra!</p>
      `
    })
  };
}

export function emailClientePedidoCancelado({ clienteNome, pedidoId, motivo }) {
  return {
    subject: 'Seu Pedido foi Cancelado - I.J Print',
    html: wrapClienteHtml({
      corFundo: '#ef4444',
      titulo: 'Pedido Cancelado',
      corpoHtml: `
        <p>Olá <strong>${clienteNome}</strong>,</p>
        <p>Informamos que o seu pedido <strong>#${formatarPedidoId(pedidoId)}</strong> foi cancelado pelo nosso sistema.</p>
        <h3 style="color: #ef4444; margin-top: 24px;">Motivo do cancelamento:</h3>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 8px 0; color: #7f1d1d; font-style: italic; border-radius: 0 4px 4px 0;">
          ${motivo || 'Motivo não especificado. Entre em contato para mais detalhes.'}
        </div>
        <p style="margin-top: 24px;">Se você já havia realizado o pagamento via Pix ou Cartão, nossa equipe entrará em contato para realizar o estorno ou você pode nos chamar respondendo este e-mail.</p>
        <br/>
        <p>Atenciosamente,<br/><strong>Equipe I.J Print</strong></p>
      `
    })
  };
}

// ==================== TEMPLATES: ADMIN ====================

export function emailAdminVendaFeita({ clienteNome, clienteEmail, pedidoId, valor }) {
  return {
    subject: `🛍️ Novo pedido criado (R$ ${formatarValor(valor)})`,
    html: wrapAdminHtml({
      titulo: 'Novo pedido criado',
      corpoHtml: `
        <p>O cliente <strong>${clienteNome}</strong> (${clienteEmail}) acabou de gerar um link de pagamento.</p>
        <p><strong>Valor:</strong> R$ ${formatarValor(valor)}</p>
        <p><strong>ID do Pedido:</strong> ${formatarPedidoId(pedidoId)}</p>
        <p>Ainda aguardando confirmação de pagamento.</p>
      `
    })
  };
}

export function emailAdminPagamentoRecebido({ clienteNome, clienteEmail, pedidoId, valor }) {
  return {
    subject: `💰 Nova Venda Aprovada! (R$ ${formatarValor(valor)})`,
    html: wrapAdminHtml({
      titulo: 'Nova venda confirmada! 🎉',
      corpoHtml: `
        <p>O cliente <strong>${clienteNome}</strong> (${clienteEmail}) acabou de ter o pagamento aprovado.</p>
        <p><strong>Valor:</strong> R$ ${formatarValor(valor)}</p>
        <p><strong>ID do Pedido:</strong> ${formatarPedidoId(pedidoId)}</p>
        <p>Acesse o painel administrativo para verificar os detalhes da impressão e embalar o produto.</p>
      `
    })
  };
}

export function emailAdminCompraCancelada({ clienteNome, clienteEmail, pedidoId, motivo }) {
  return {
    subject: `❌ Pedido cancelado (#${formatarPedidoId(pedidoId)})`,
    html: wrapAdminHtml({
      titulo: 'Pedido cancelado',
      corpoHtml: `
        <p>O pedido <strong>#${formatarPedidoId(pedidoId)}</strong> do cliente <strong>${clienteNome}</strong> (${clienteEmail || 'email não encontrado'}) foi cancelado.</p>
        <p><strong>Motivo:</strong> ${motivo || 'Não especificado'}</p>
      `
    })
  };
}
