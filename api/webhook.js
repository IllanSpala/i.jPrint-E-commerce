import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const evento = req.body;
    console.log('[Webhook InfinitePay] Evento recebido:', JSON.stringify(evento));

    // A InfinitePay envia o order_nsu (nosso pedido_id) e transaction_nsu quando aprova.
    // Para links de pagamento, ela NÃO envia um campo "status", apenas dispara o webhook
    // quando a transação é aprovada e capturada com sucesso.
    const pedidoId = evento?.charge?.order_nsu || evento?.order_nsu;
    const transactionId = evento?.transaction_nsu || evento?.charge?.transaction_nsu;
    
    // Fallback: se houver status, avalia, senão, se houver transaction_nsu, assume sucesso.
    const status = evento?.charge?.status || evento?.status;
    const isApproved = status === 'approved' || status === 'paid' || status === 'captured' || (!status && transactionId);

    if (!pedidoId) {
      console.log('[Webhook] order_nsu não encontrado no payload');
      return res.status(200).json({ received: true });
    }

    if (isApproved) {
      // Remover "email" do select de perfis, pois a tabela perfis só tem "nome" e "telefone"
      const { data: pedidoAtualizado, error } = await supabase
        .from('pedidos')
        .update({ status: 'Pago' })
        .eq('id', pedidoId)
        .select('*, perfis(nome)')
        .single();

      if (error) {
        console.error('[Webhook] Erro ao atualizar pedido:', error);
        return res.status(500).json({ error: 'Erro ao atualizar pedido no banco (Verifique a Service Role Key no Vercel)' });
      }

      console.log(`[Webhook] Pedido ${pedidoId} marcado como PAGO`);

      // ==========================================
      // DISPARO DE E-MAILS (Se a chave estiver configurada)
      // ==========================================
      if (process.env.RESEND_API_KEY && pedidoAtualizado?.user_id) {
        try {
          // Como estamos usando a Service Role Key, podemos buscar o email direto do auth admin
          const { data: authData, error: authError } = await supabase.auth.admin.getUserById(pedidoAtualizado.user_id);
          const clienteEmail = authData?.user?.email;

          if (clienteEmail) {
            const { Resend } = await import('resend');
            const resend = new Resend(process.env.RESEND_API_KEY);
            const clienteNome = pedidoAtualizado.perfis?.nome || 'Cliente';
            const valor = Number(pedidoAtualizado.total).toFixed(2).replace('.', ',');
            
            // E-mail para o Cliente
            await resend.emails.send({
              from: 'I.J Print <vendas@ijprint26.com>', // Troque para o seu domínio verificado depois
              to: clienteEmail,
              subject: 'Pagamento Confirmado! 🚀 - I.J Print',
              html: `
                <div style="font-family: sans-serif; color: #111; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                  <div style="background-color: #c8a46e; padding: 20px; text-align: center;">
                    <h1 style="color: #fff; margin: 0;">Pagamento Confirmado!</h1>
                  </div>
                  <div style="padding: 20px;">
                    <p>Olá <strong>${clienteNome}</strong>,</p>
                    <p>Boas notícias! Seu pagamento de <strong>R$ ${valor}</strong> referente ao pedido <strong>#${String(pedidoId).slice(0,8).toUpperCase()}</strong> foi aprovado.</p>
                    <p>Já estamos preparando suas peças 3D com muito carinho. Você será avisado quando o pedido for enviado!</p>
                    <br/>
                    <p>Obrigado por escolher a I.J Print!</p>
                  </div>
                </div>
              `
            });

            // E-mail para o Admin (Você)
            await resend.emails.send({
              from: 'Sistema I.J Print <sistema@ijprint26.com>', 
              to: 'i.j.print26@gmail.com',
              subject: `💰 Nova Venda Aprovada! (R$ ${valor})`,
              html: `
                <div style="font-family: sans-serif; color: #111;">
                  <h2>Nova venda confirmada! 🎉</h2>
                  <p>O cliente <strong>${clienteNome}</strong> (${clienteEmail}) acabou de ter o pagamento aprovado.</p>
                  <p><strong>Valor:</strong> R$ ${valor}</p>
                  <p><strong>ID do Pedido:</strong> ${String(pedidoId).slice(0,8).toUpperCase()}</p>
                  <p>Acesse o painel administrativo para verificar os detalhes da impressão e embalar o produto.</p>
                </div>
              `
            });
            console.log('[Webhook] E-mails de confirmação enviados com sucesso!');
          }
        } catch (emailError) {
          console.error('[Webhook] Erro ao enviar e-mails:', emailError);
        }
      }
    } else {
      console.log(`[Webhook] Payload não classificado como aprovado. Status: ${status}, Transação: ${transactionId}. Sem ação necessária.`);
    }

    // Sempre responde 200 para a InfinitePay não ficar reenviando
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Webhook] Erro geral:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
}
