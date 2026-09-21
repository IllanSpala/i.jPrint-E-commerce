import * as mailer from './mailer.js';
import { escaparHtml } from '../../src/lib/reciboSeguro.js';
export async function processarNotificacoes(db) {
  if (!process.env.RESEND_API_KEY) throw new Error('Configure o Resend antes de processar notificações.');
  const { data: fila, error } = await db.rpc('reservar_notificacoes_pedidos');
  if (error) throw new Error('Fila de notificações indisponível.');
  let enviados = 0;
  await Promise.all((fila || []).map(async n => {
    const p = n.pedido;
    const args = { clienteNome: p.endereco?.cliente_nome || 'Cliente', clienteEmail: p.endereco?.cliente_email, pedidoId: p.id, valor: p.total, linkPagamento: p.link_pagamento, trackingUrl: p.tracking_url };
    const templates = { Novo: mailer.emailClienteCompraFeita, Pago: mailer.emailClientePagamentoConfirmado, 'Em Produção': mailer.emailClienteAcompanhamento, Enviado: mailer.emailClientePedidoEnviado, 'Concluído': mailer.emailClientePedidoConcluido };
    let conteudo = templates[n.evento]?.(args);
    if (!conteudo) return;
    if (n.evento === 'Enviado' && p.modo_entrega === 'retirada') conteudo = { subject: 'Pedido pronto para retirada — I.J Print', html: `<p>Seu pedido ${escaparHtml(p.id)} está pronto para retirada. Combine o horário com a loja.</p>` };
    if (n.destino === 'admin') conteudo = { subject: `Pedido ${p.id.slice(0,8)}: ${n.evento}`, html: `<p>Pedido ${escaparHtml(p.id)}: ${escaparHtml(n.evento)}. Consulte os detalhes no painel.</p>` };
    const enviar = n.destino === 'admin' ? mailer.enviarEmailAdmin : mailer.enviarEmailCliente;
    const resultado = await enviar({ ...conteudo, to: args.clienteEmail, idempotencyKey: `pedido-${n.id}` });
    if (resultado.sent) {
      const salvo = await db.from('notificacoes_pedidos').update({ enviado_em: new Date().toISOString() }).eq('id', n.id);
      if (!salvo.error) enviados++;
    }
  }));
  return enviados;
}
