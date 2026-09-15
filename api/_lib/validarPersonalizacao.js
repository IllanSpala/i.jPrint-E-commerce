import { produtos } from '../../src/data/produtos.js';

export function validarPersonalizacao(item) {
  const produto = produtos.find(p => String(p.id) === String(item.id));
  if (produto?.personalizacao3dOpcional && item.modoCompra === 'pronto') {
    const opcao = produto.opcoes?.find(o => o.nome === item.opcaoEscolhida);
    if (!opcao || opcao.esgotado || item.personalizacoes?.length) return 'Selecione uma opção pronta válida para o Rolling Tray.';
    return null;
  }
  if (produto?.personalizador3d || item.personalizador3d) {
    if (!Array.isArray(item.personalizacoes) || !item.personalizacoes.length || item.personalizacoes.length !== item.quantidade || item.personalizacoes.some(p => typeof p.svg !== 'string' || !p.svg.includes('<svg'))) {
      return 'Faltam arquivos de personalização. Personalize cada unidade antes de finalizar.';
    }
  }
  return null;
}
