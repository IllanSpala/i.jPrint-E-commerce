import { protegerAdmin } from './_lib/seguranca.js';



// Marca um pedido "Enviado" como "Concluído" e dispara o e-mail de
// agradecimento e convite pro cliente. Usado pelo botão verde no painel Admin.
async function handler(req, res, supabase) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { pedido_id } = req.body;

  if (!pedido_id) {
    return res.status(400).json({ error: 'ID do pedido é obrigatório' });
  }

  try {
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .update({ status: 'Concluído' })
      .eq('id', pedido_id)
      .eq('status', 'Enviado')
      .select('*, perfis(nome, telefone)')
      .single();

    if (error || !pedido) {
      return res.status(400).json({
        error: 'Pedido não encontrado ou não está mais no status "Enviado".',
      });
    }

    return res.status(200).json({ success: true, pedido });
  } catch (error) {
    console.error('[Status] Erro:', error);
    return res.status(500).json({ error: 'Erro ao atualizar status do pedido' });
  }
}

export default protegerAdmin(handler);
