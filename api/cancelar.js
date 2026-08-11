import { createClient } from '@supabase/supabase-js';
import {
  enviarEmailCliente,
  enviarEmailAdmin,
  emailClientePedidoCancelado,
  emailAdminCompraCancelada,
} from './_lib/mailer.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { pedido_id, motivo } = req.body;

  if (!pedido_id) {
    return res.status(400).json({ error: 'ID do pedido é obrigatório' });
  }

  try {
    // 1. Buscar os dados do pedido antes de deletar
    const { data: pedido, error: fetchError } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedido_id)
      .single();

    if (fetchError || !pedido) {
      throw new Error(`Pedido não encontrado. Detalhe: ${fetchError ? fetchError.message : 'Sem retorno'}`);
    }

    // Buscar perfil do cliente (se houver) para mandar o e-mail.
    // A tabela "pedidos" grava a coluna como "user_id" (ver api/pagamento.js),
    // não "usuario_id". E a tabela "perfis" não tem coluna "email" — o email
    // fica na tabela de autenticação e precisa ser buscado via Service Role.
    let clienteNome = 'Cliente';
    let clienteEmail = null;

    if (pedido.user_id) {
       const { data: perfil } = await supabase
         .from('perfis')
         .select('nome')
         .eq('id', pedido.user_id)
         .single();

       if (perfil) {
          clienteNome = perfil.nome || 'Cliente';
       }

       const { data: authData, error: authError } = await supabase.auth.admin.getUserById(pedido.user_id);
       if (authError) {
         console.error('[Cancelar Pedido] Erro ao buscar email do usuário:', authError);
       } else {
         clienteEmail = authData?.user?.email || null;
       }
    }

    // 2. Disparar os e-mails de cancelamento: cliente (se tiver email) e admin (sempre)
    try {
      await Promise.all([
        clienteEmail
          ? enviarEmailCliente({
              to: clienteEmail,
              ...emailClientePedidoCancelado({ clienteNome, pedidoId: pedido_id, motivo }),
            })
          : Promise.resolve(),
        enviarEmailAdmin(
          emailAdminCompraCancelada({ clienteNome, clienteEmail, pedidoId: pedido_id, motivo })
        ),
      ]);
    } catch (emailError) {
      console.error('[Cancelar Pedido] Erro ao enviar e-mails:', emailError);
    }

    // 3. Deletar o pedido do banco de dados permanentemente (conforme fluxo atual do Admin)
    const { error: deleteError } = await supabase
      .from('pedidos')
      .delete()
      .eq('id', pedido_id);

    if (deleteError) {
      throw new Error('Erro ao deletar pedido no banco de dados: ' + deleteError.message);
    }

    return res.status(200).json({ success: true, message: 'Pedido cancelado e e-mail enviado com sucesso.' });
  } catch (error) {
    console.error('[Cancelar Pedido] Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}
