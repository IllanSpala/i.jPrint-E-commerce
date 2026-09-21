import { protegerAdmin } from './_lib/seguranca.js';

export default protegerAdmin(async (req, res, db) => {
  const { id, ativo } = req.body || {};
  if (!Number.isSafeInteger(id) || typeof ativo !== 'boolean') return res.status(400).json({ error: 'Produto ou estado inválido.' });
  const { data, error } = await db.from('produtos').update({ ativo, ativo_admin: ativo }).eq('id', id).select('id,ativo,ativo_admin').maybeSingle();
  if (error) return res.status(503).json({ error: 'Não foi possível alterar o produto. Confira se produtos_ativos.sql foi aplicado.' });
  if (!data) return res.status(404).json({ error: 'Produto não encontrado no banco.' });
  return res.status(200).json(data);
});
