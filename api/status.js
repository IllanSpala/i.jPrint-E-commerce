import { createClient } from '@supabase/supabase-js';
import {
  enviarEmailCliente,
  buscarEmailCliente,
  emailClienteAcompanhamento,
} from './_lib/mailer.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Marca um pedido "Pago" como "Em Produção" e dispara o e-mail de
// acompanhamento pro cliente. Usado pelo botão "Marcar como Em Produção"
// no painel Admin.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { pedido_id } = req.body;

  if (!pedido_id) {
    return res.status(400).json({ error: 'ID do pedido é obrigatório' });
  }

  try {
    // O filtro .eq('status', 'Pago') garante que só avançamos pedidos que
    // já foram efetivamente pagos, evitando marcar "Em Produção" um pedido
    // ainda "Aguardando Pagamento" por engano/corrida de clique duplo.
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .update({ status: 'Em Produção' })
      .eq('id', pedido_id)
      .eq('status', 'Pago')
      .select('*, perfis(nome, telefone)')
      .single();

    if (error || !pedido) {
      return res.status(400).json({
        error: 'Pedido não encontrado ou não está mais no status "Pago" (pode já ter avançado ou não ter sido pago ainda).',
      });
    }

    try {
      const clienteEmail = pedido.user_id
        ? await buscarEmailCliente(supabase, pedido.user_id)
        : null;

      if (clienteEmail) {
        const clienteNome = pedido.perfis?.nome || 'Cliente';
        await enviarEmailCliente({
          to: clienteEmail,
          ...emailClienteAcompanhamento({ clienteNome, pedidoId: pedido_id }),
        });
      }
    } catch (emailError) {
      console.error('[Status] Erro ao enviar e-mail de acompanhamento:', emailError);
    }

    return res.status(200).json({ success: true, pedido });
  } catch (error) {
    console.error('[Status] Erro:', error);
    return res.status(500).json({ error: error.message || 'Erro ao atualizar status do pedido' });
  }
}
