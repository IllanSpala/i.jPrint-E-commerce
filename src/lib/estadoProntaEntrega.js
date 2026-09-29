import { prontaEntrega } from '../data/prontaEntrega.js';

export async function carregarProntaEntrega(db) {
  const { data, error } = await db.from('pronta_entrega_estados').select('id,ativo,ativo_admin');
  // Compatibilidade enquanto a migração não foi aplicada. Somente tabela
  // inexistente permite usar o cadastro local; falhas de rede/permissão não.
  if (error?.code === 'PGRST205' && error.message?.includes('pronta_entrega_estados')) {
    return { data: prontaEntrega.map(peca => ({ ...peca, esgotado: false, ativo_admin: null })), error: null, configuracaoPendente: true };
  }
  if (error || !Array.isArray(data)) return { data: null, error: error || new Error('Estados de pronta entrega indisponíveis.') };
  // Ausência de cadastro nunca pode reativar uma peça por fallback local.
  return { data: prontaEntrega.map(peca => {
    const estado = data.find(e => e.id === peca.id);
    return {
      ...peca,
      ativo: peca.prod_ativo,
      esgotado: estado?.ativo !== true,
      ativo_admin: typeof estado?.ativo_admin === 'boolean' ? estado.ativo_admin : null,
    };
  }), error: null };
}
