import { protegerAdmin } from './_lib/seguranca.js';

export async function excluirPedidoSemCobranca(req, res, db) {
  const id = req.body?.pedido_id;
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ error: 'Pedido inválido.' });
  }
  // A função SQL verifica o estado com lock e remove a reserva de cupom
  // na mesma transação. Nunca confia no estado informado pelo navegador.
  const { data, error } = await db.rpc('excluir_pedido_sem_cobranca', { p_pedido_id: id });
  if (error) return res.status(503).json({ error: 'Exclusão indisponível. Verifique se a migração excluir_pedido_sem_cobranca.sql foi aplicada.' });
  if (data !== true) return res.status(409).json({
    error: 'Este pedido não pode ser excluído: apenas checkouts com falha comprovada e sem cobrança podem ser removidos. Pendentes com link são preservados para confirmar pagamentos tardios.',
  });
  return res.status(200).json({ ok: true });
}

export default protegerAdmin(excluirPedidoSemCobranca);
