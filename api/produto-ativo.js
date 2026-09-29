import { prontaEntrega } from '../src/data/prontaEntrega.js';
import { protegerAdmin } from './_lib/seguranca.js';

export async function alterarProdutoAtivo(req, res, db) {
  const { id, ativo } = req.body || {};
  const pecaPronta = prontaEntrega.find(p => p.id === id);
  const pronta = Boolean(pecaPronta);
  if ((!Number.isSafeInteger(id) && !pronta) || typeof ativo !== 'boolean') return res.status(400).json({ error: 'Produto ou estado inválido.' });
  if (pronta && pecaPronta.prod_ativo !== true) return res.status(404).json({ error: 'Produto oculto no cadastro.' });
  const alteracoes = pronta ? { ativo } : { ativo, ativo_admin: ativo };
  const { data, error } = await db.from(pronta ? 'pronta_entrega_estados' : 'produtos').update(alteracoes).eq('id', id).select('id,ativo,ativo_admin').maybeSingle();
  if (error) return res.status(503).json({ error: pronta ? 'Não foi possível alterar a peça. Confira se pronta_entrega_ativos.sql foi aplicado.' : 'Não foi possível alterar o produto. Confira se produtos_ativos.sql foi aplicado.' });
  if (!data) return res.status(404).json({ error: 'Produto não encontrado no banco.' });
  return res.status(200).json(pronta ? { ...data, esgotado: data.ativo !== true } : data);
}
export default protegerAdmin(alterarProdutoAtivo);
