import { createClient } from '@supabase/supabase-js';
import { produtos } from '../src/data/produtos.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const secret = req.query.secret;
  if (secret !== 'ijprint26-sync-secret') {
    return res.status(401).json({ error: 'Acesso não autorizado' });
  }

  try {
    const results = [];
    for (const p of produtos) {
      const { error } = await supabase.from('produtos').upsert({
        id: p.id,
        nome: p.nome,
        preco: p.preco,
        preco_promocional: p.precoPromocional || null,
        imagem: p.imagem,
        imagens: p.imagens || [p.imagem],
        opcoes: p.opcoes || null,
        categoria: p.categoria,
        exige_personalizacao: p.exigePersonalizacao || false,
        descricao: p.descricao,
        peso_gramas: 300,
        dimensoes: '150x100x200'
      });

      if (error) {
        results.push({ id: p.id, nome: p.nome, status: 'error', error: error.message });
      } else {
        results.push({ id: p.id, nome: p.nome, status: 'success' });
      }
    }

    const totalSuccess = results.filter(r => r.status === 'success').length;
    return res.status(200).json({
      message: `Sincronização concluída com sucesso! ${totalSuccess}/${produtos.length} produtos upserted.`,
      total: produtos.length,
      sucessoCount: totalSuccess,
      detalhes: results
    });
  } catch (err) {
    console.error('[sync-produtos] Erro:', err);
    return res.status(500).json({ error: err.message });
  }
}
