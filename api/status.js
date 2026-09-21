import { protegerAdmin } from './_lib/seguranca.js';



// Marca um pedido "Pago" como "Em Produção" e dispara o e-mail de
// acompanhamento pro cliente. Usado pelo botão "Marcar como Em Produção"
// no painel Admin.
async function handler(req, res, supabase) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { pedido_id, acao, codigo_rastreio } = req.body || {};
  const envio = acao === 'enviado';
  if (envio && codigo_rastreio && !/^[A-Za-z0-9-]{5,50}$/.test(codigo_rastreio)) return res.status(400).json({ error: 'Rastreio inválido.' });

  if (!pedido_id) {
    return res.status(400).json({ error: 'ID do pedido é obrigatório' });
  }

  try {
    if (envio) {
      const atual = await supabase.from('pedidos').select('modo_entrega').eq('id', pedido_id).maybeSingle();
      if (atual.error || !atual.data) return res.status(409).json({ error: 'Pedido indisponível.' });
      if (atual.data.modo_entrega !== 'retirada' && atual.data.modo_entrega !== 'digital' && !codigo_rastreio) return res.status(400).json({ error: 'Informe o código de rastreio da postagem.' });
    }
    // O filtro .eq('status', envio ? 'Em Produção' : 'Pago') garante que só avançamos pedidos que
    // já foram efetivamente pagos, evitando marcar "Em Produção" um pedido
    // ainda "Aguardando Pagamento" por engano/corrida de clique duplo.
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .update({ status: envio ? 'Enviado' : 'Em Produção', ...(envio && codigo_rastreio ? { tracking_url: `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(codigo_rastreio)}` } : {}) })
      .eq('id', pedido_id)
      .eq('status', envio ? 'Em Produção' : 'Pago')
      .select('*, perfis(nome, telefone)')
      .single();

    if (error || !pedido) {
      return res.status(400).json({
        error: 'Pedido não encontrado ou não está mais no status "Pago" (pode já ter avançado ou não ter sido pago ainda).',
      });
    }

    return res.status(200).json({ success: true, pedido });
  } catch (error) {
    console.error('[Status] Erro:', error);
    return res.status(500).json({ error: 'Erro ao atualizar status do pedido' });
  }
}

export default protegerAdmin(handler);
