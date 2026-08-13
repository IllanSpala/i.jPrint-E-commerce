import { createClient } from '@supabase/supabase-js';
import {
  enviarEmailCliente,
  buscarEmailCliente,
  emailClientePedidoConcluido,
} from './_lib/mailer.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Marca um pedido "Enviado" como "Concluído" e dispara o e-mail de
// agradecimento e convite pro cliente. Usado pelo botão verde no painel Admin.
export default async function handler(req, res) {
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

    try {
      const clienteEmail = pedido.user_id
        ? await buscarEmailCliente(supabase, pedido.user_id)
        : pedido.endereco?.cliente_email || null;

      if (clienteEmail) {
        const clienteNome = pedido.perfis?.nome || pedido.endereco?.cliente_nome || 'Cliente';
        await enviarEmailCliente({
          to: clienteEmail,
          ...emailClientePedidoConcluido({ clienteNome, pedidoId: pedido_id }),
        });
      }
    } catch (emailError) {
      console.error('[Status] Erro ao enviar e-mail de pedido concluído:', emailError);
    }

    return res.status(200).json({ success: true, pedido });
  } catch (error) {
    console.error('[Status] Erro:', error);
    return res.status(500).json({ error: error.message || 'Erro ao atualizar status do pedido' });
  }
}
