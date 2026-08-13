// api/carrinho-abandonado.js
// Vercel Serverless Function
//
// GET  → Dispara emails de carrinhos abandonados (usado por cron job ou chamada manual)
// POST → Salva/atualiza o carrinho de um usuário no Supabase (chamado pelo frontend)

import { createClient } from '@supabase/supabase-js';
import {
  enviarEmailCliente,
  buscarEmailCliente,
  formatarValor,
} from './_lib/mailer.js';

function getSupabaseAdmin() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ─── POST: salvar carrinho do usuário logado ───────────────────────────────
async function salvarCarrinho(req, res) {
  const { user_id, itens } = await req.json?.() || {};

  if (!user_id || !Array.isArray(itens)) {
    return res.status(400).json({ error: 'user_id e itens são obrigatórios.' });
  }

  const supabase = getSupabaseAdmin();

  // Se carrinho vazio, limpa o registro (checkout concluído)
  if (itens.length === 0) {
    await supabase.from('carrinhos_salvos').delete().eq('user_id', user_id);
    return res.status(200).json({ ok: true, acao: 'carrinho_limpo' });
  }

  const { error } = await supabase
    .from('carrinhos_salvos')
    .upsert(
      {
        user_id,
        itens,
        atualizado_em: new Date().toISOString(),
        email_enviado: false, // reset: novo item adicionado, reinicia a contagem
        email_enviado_em: null,
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('[Carrinho] Erro ao salvar:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true, acao: 'carrinho_salvo' });
}

// ─── GET: disparar emails de carrinhos abandonados ────────────────────────
async function dispararEmails(req, res) {
  // Segurança: só aceita requisições com o token correto (cron job da Vercel)
  const authHeader = req.headers?.['authorization'] || '';
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabaseAdmin();

  // Busca carrinhos abandonados há mais de 1 hora, sem email enviado ainda
  const limiteAbandono = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hora atrás

  const { data: carrinhos, error } = await supabase
    .from('carrinhos_salvos')
    .select('*')
    .eq('email_enviado', false)
    .lt('atualizado_em', limiteAbandono);

  if (error) {
    console.error('[CarrinhoAbandonado] Erro ao buscar carrinhos:', error);
    return res.status(500).json({ error: error.message });
  }

  if (!carrinhos || carrinhos.length === 0) {
    return res.status(200).json({ ok: true, disparados: 0, mensagem: 'Nenhum carrinho abandonado encontrado.' });
  }

  let disparados = 0;

  for (const carrinho of carrinhos) {
    // Busca o email do cliente via admin API do Supabase Auth
    const emailCliente = await buscarEmailCliente(supabase, carrinho.user_id);
    if (!emailCliente) continue;

    // Busca o nome do cliente na tabela de perfis
    const { data: perfil } = await supabase
      .from('perfis')
      .select('nome')
      .eq('id', carrinho.user_id)
      .single();

    const nomeCliente = perfil?.nome || 'Cliente';
    const itens = carrinho.itens || [];
    const totalCarrinho = itens.reduce(
      (acc, i) => acc + (i.precoPromocional || i.preco) * i.quantidade,
      0
    );

    // Monta o template do email
    const { subject, html } = emailCarrinhoAbandonado({
      clienteNome: nomeCliente,
      itens,
      total: totalCarrinho,
      linkLoja: 'https://ijprint26.com',
    });

    const resultado = await enviarEmailCliente({ to: emailCliente, subject, html });

    if (resultado.sent) {
      // Marca como email enviado para não reenviar
      await supabase
        .from('carrinhos_salvos')
        .update({ email_enviado: true, email_enviado_em: new Date().toISOString() })
        .eq('user_id', carrinho.user_id);

      disparados++;
      console.log(`[CarrinhoAbandonado] Email enviado para ${emailCliente}`);
    }
  }

  return res.status(200).json({
    ok: true,
    disparados,
    total_encontrados: carrinhos.length,
  });
}

// ─── Router ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'POST') return salvarCarrinho(req, res);
  if (req.method === 'GET') return dispararEmails(req, res);

  return res.status(405).json({ error: 'Método não permitido.' });
}

// ─── Template de Email ────────────────────────────────────────────────────
function emailCarrinhoAbandonado({ clienteNome, itens, total, linkLoja }) {
  const linhasItens = itens
    .map((item) => {
      const nomeFinal = item.opcaoEscolhida
        ? `${item.nome} (${item.opcaoEscolhida})`
        : item.nome;
      const preco = item.precoPromocional || item.preco;
      return `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #333;">
            ${item.quantidade}x <strong>${nomeFinal}</strong>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; text-align: right; color: #333; white-space: nowrap;">
            R$ ${formatarValor(preco * item.quantidade)}
          </td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <div style="font-family: sans-serif; color: #111; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
      
      <!-- Header -->
      <div style="background-color: #111; padding: 24px; text-align: center;">
        <h1 style="color: #c8a46e; margin: 0; font-size: 22px; letter-spacing: 2px; text-transform: uppercase;">I.J Print</h1>
      </div>

      <!-- Body -->
      <div style="padding: 32px 24px;">
        <h2 style="color: #111; margin: 0 0 8px;">Ei, ${clienteNome}! Você esqueceu algo 🛒</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Você deixou alguns itens no seu carrinho na I.J Print. As peças ainda estão esperando por você — é só voltar e finalizar o pedido!
        </p>

        <!-- Tabela de itens -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 8px 0; border-bottom: 2px solid #c8a46e; color: #c8a46e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Produto</th>
              <th style="text-align: right; padding: 8px 0; border-bottom: 2px solid #c8a46e; color: #c8a46e; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${linhasItens}
          </tbody>
          <tfoot>
            <tr>
              <td style="padding: 14px 0 0; font-weight: bold; font-size: 16px; color: #111;">Total</td>
              <td style="padding: 14px 0 0; font-weight: bold; font-size: 16px; color: #c8a46e; text-align: right;">R$ ${formatarValor(total)}</td>
            </tr>
          </tfoot>
        </table>

        <!-- CTA -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${linkLoja}" 
             style="background-color: #c8a46e; color: #111; padding: 14px 32px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 15px; display: inline-block; letter-spacing: 1px;">
            Finalizar meu pedido
          </a>
        </div>

        <p style="color: #888; font-size: 13px; text-align: center; margin: 0;">
          Cada peça é impressa com carinho e acabamento premium. ❤️<br/>
          Dúvidas? Fale com a gente pelo WhatsApp.
        </p>
      </div>

      <!-- Footer -->
      <div style="background-color: #f9f9f9; padding: 16px 24px; text-align: center; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #aaa; font-size: 12px;">
          Você está recebendo este email porque tem uma conta na I.J Print.<br/>
          <a href="${linkLoja}" style="color: #c8a46e;">Visitar a loja</a>
        </p>
      </div>
    </div>
  `;

  return {
    subject: `${clienteNome}, você esqueceu algo no carrinho! 🛒`,
    html,
  };
}
