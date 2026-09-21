import { protegerAdmin } from './_lib/seguranca.js';

// Apagar um pedido não cancela a cobrança na operadora. Preserve o registro
// para conciliação e pagamentos tardios até existir integração de estorno.
export default protegerAdmin(async (req, res) => {
  return res.status(409).json({
    error: 'Cancelamento automático indisponível. Cancele a cobrança ou estorne o pagamento na operadora e concilie o pedido; nenhum registro foi excluído.',
  });
});
