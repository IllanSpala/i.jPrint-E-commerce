import { bancoServidor, limitarRequisicoes } from './_lib/seguranca.js';

export function criarHandlerWebhook(db, consultar = fetch) {
  return async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
    const evento = req.body?.charge || req.body || {};
    const { order_nsu: pedidoId, transaction_nsu: transacao } = evento;
    const slug = evento.invoice_slug || evento.slug;
    if (![pedidoId, transacao, slug].every(v => typeof v === 'string' && v.length > 0 && v.length <= 200)) {
      return res.status(400).json({ error: 'Identificadores de pagamento obrigatórios.' });
    }
    try {
      await limitarRequisicoes(db, 'webhook:global', 600);
      const { data: pedido, error } = await db.from('pedidos').select('id,status,total,pagamento_handle').eq('id', pedidoId).maybeSingle();
      if (error) throw new Error('Consulta indisponível');
      if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado.' });
      const handle = pedido.pagamento_handle;
      if (!handle) return res.status(503).json({ error: 'Pedido anterior à validação segura: conciliação manual necessária.' });
      const resposta = await consultar('https://api.checkout.infinitepay.io/payment_check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, order_nsu: pedidoId, transaction_nsu: transacao, slug }),
        signal: AbortSignal.timeout(8000),
      });
      if (!resposta.ok) return res.status(503).json({ error: 'Não foi possível consultar a operadora.' });
      const confirmado = await resposta.json();
      const esperado = Math.round(Number(pedido.total) * 100);
      if (confirmado.success !== true || confirmado.paid !== true || !Number.isSafeInteger(esperado) || esperado <= 0 || confirmado.amount !== esperado) {
        return res.status(400).json({ error: 'Pagamento não confirmado ou valor divergente.' });
      }
      // Compare-and-set: um callback repetido nunca regride produção/envio.
      if (pedido.status === 'Aguardando Pagamento') {
        const atualizacao = await db.from('pedidos').update({
          status: 'Pago', pagamento_transacao: transacao, pagamento_slug: slug,
          pagamento_confirmado_em: new Date().toISOString(),
        }).eq('id', pedidoId).eq('status', 'Aguardando Pagamento');
        if (atualizacao.error) throw new Error('Falha ao registrar confirmação');
      }
      return res.status(200).json({ received: true });
    } catch {
      return res.status(503).json({ error: 'Confirmação temporariamente indisponível. Tente novamente.' });
    }
  };
}

export default async function handler(req, res) {
  try { return await criarHandlerWebhook(bancoServidor())(req, res); }
  catch { return res.status(503).json({ error: 'Serviço indisponível.' }); }
}
