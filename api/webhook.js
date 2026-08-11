import { createClient } from '@supabase/supabase-js';
import {
  enviarEmailCliente,
  enviarEmailAdmin,
  buscarEmailCliente,
  emailClientePagamentoConfirmado,
  emailAdminPagamentoRecebido,
} from './_lib/mailer.js';

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
      // DISPARO DE E-MAILS: "Pagamento confirmado" (cliente) e
      // "Pagamento recebido" (admin)
      // ==========================================
      if (pedidoAtualizado?.user_id) {
        try {
          const clienteEmail = await buscarEmailCliente(supabase, pedidoAtualizado.user_id);

          if (clienteEmail) {
            const clienteNome = pedidoAtualizado.perfis?.nome || 'Cliente';
            const valor = pedidoAtualizado.total;

            await Promise.all([
              enviarEmailCliente({
                to: clienteEmail,
                ...emailClientePagamentoConfirmado({ clienteNome, pedidoId, valor }),
              }),
              enviarEmailAdmin(
                emailAdminPagamentoRecebido({ clienteNome, clienteEmail, pedidoId, valor })
              ),
            ]);
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
