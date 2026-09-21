import { limitarRequisicoes } from './_lib/seguranca.js';
import { createClient } from '@supabase/supabase-js';
import { obterCupom, verificarPrimeiraCompra, precificarItens, calcularDesconto } from './_lib/cupons.js';

export function criarHandlerCupom(supabase) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return res.status(401).json({ error: 'Entre na sua conta para aplicar o cupom.' });
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: 'Entre novamente na sua conta para aplicar o cupom.' });
    await limitarRequisicoes(supabase, 'cupom:' + user.id, 30);
      const cupom = obterCupom(req.body?.codigo);
      await verificarPrimeiraCompra(supabase, user.id);
      const items = await precificarItens(supabase, req.body?.itens);
      const { subtotalCentavos, descontoCentavos } = calcularDesconto(items, cupom);
      return res.status(200).json({ codigo: cupom.codigo, percentual: cupom.percentual, subtotalCentavos, descontoCentavos });
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.status ? error.message : 'Não foi possível validar o cupom.' });
    }
  };
}

export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: 'A validação de cupons está indisponível no momento.' });
  return criarHandlerCupom(createClient(url, key))(req, res);
}
