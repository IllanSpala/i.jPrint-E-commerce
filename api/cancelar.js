import { createClient } from '@supabase/supabase-js';

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

    // 2. Disparar o e-mail de cancelamento (se configurado e houver e-mail)
    if (process.env.RESEND_API_KEY && clienteEmail) {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      await resend.emails.send({
        from: 'I.J Print <vendas@ijprint26.com>', 
        to: clienteEmail,
        subject: `Seu Pedido foi Cancelado - I.J Print`,
        html: `
          <div style="font-family: sans-serif; color: #111; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #ef4444; padding: 20px; text-align: center;">
              <h1 style="color: #fff; margin: 0;">Pedido Cancelado</h1>
            </div>
            <div style="padding: 20px;">
              <p>Olá <strong>${clienteNome}</strong>,</p>
              <p>Informamos que o seu pedido <strong>#${String(pedido_id).slice(0,8).toUpperCase()}</strong> foi cancelado pelo nosso sistema.</p>
              
              <h3 style="color: #ef4444; margin-top: 24px;">Motivo do cancelamento:</h3>
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 8px 0; color: #7f1d1d; font-style: italic; border-radius: 0 4px 4px 0;">
                ${motivo || 'Motivo não especificado. Entre em contato para mais detalhes.'}
              </div>
              
              <p style="margin-top: 24px;">Se você já havia realizado o pagamento via Pix ou Cartão, nossa equipe entrará em contato para realizar o estorno ou você pode nos chamar respondendo este e-mail.</p>
              <br/>
              <p>Atenciosamente,<br/><strong>Equipe I.J Print</strong></p>
            </div>
          </div>
        `
      });
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
