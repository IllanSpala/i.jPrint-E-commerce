import { svgSeguro } from './svgSeguro.js';
// Arquivos recuperáveis a partir do JSON persistido em pedidos.itens.
export function arquivosPersonalizacao(itens = []) {
  return itens.flatMap((item, i) => (item.personalizacoes || []).flatMap((p, j) => {
    const base = `produto-${item.id}-item-${i + 1}-arte-${j + 1}`;
    const arquivos = [];
    if (svgSeguro(p.svgOriginal)) arquivos.push({ nome: `${base}-original.svg`, conteudo: p.svgOriginal });
    if (svgSeguro(p.svg)) arquivos.push({ nome: `${base}-processado.svg`, conteudo: p.svg.replaceAll('currentColor', /^#[0-9a-fA-F]{3,8}$/.test(p.corGravura) ? p.corGravura : '#000000') });
    if (p.svg) {
      const { svg, svgOriginal, previewImagem, ...configuracao } = p;
      arquivos.push({ nome: `${base}-configuracao.json`, conteudo: JSON.stringify({ produto: item.nome, dimensoes: item.dimensoes, ...configuracao }, null, 2) });
    }
    return arquivos;
  }));
}

export function baixarArquivoPersonalizacao(arquivo) {
  const url = URL.createObjectURL(new Blob([arquivo.conteudo], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = arquivo.nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
