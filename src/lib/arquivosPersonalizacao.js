import { svgSeguro } from './svgSeguro.js';
// Arquivos recuperáveis a partir do JSON persistido em pedidos.itens.
export function arquivosPersonalizacao(itens = []) {
  return itens.flatMap((item, i) => (item.personalizacoes || []).flatMap((p, j) => {
    const base = `produto-${item.id}-item-${i + 1}-arte-${j + 1}`;
    const arquivos = [];
    if (svgSeguro(p.svgOriginal)) arquivos.push({ nome: `${base}-original.svg`, conteudo: p.svgOriginal });
    if (svgSeguro(p.svg)) {
      const processado = p.svg.replaceAll('currentColor', /^#[0-9a-fA-F]{3,8}$/.test(p.corGravura) ? p.corGravura : '#000000');
      arquivos.push({ nome: `${base}-processado.svg`, conteudo: processado, previewUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(processado)}`, rotulo: 'Arte aplicada no produto' });
    }
    if (p.origemImagem?.arquivoOriginal?.startsWith('data:image/')) arquivos.push({ nome: `${base}-imagem-original.webp`, dataUrl: p.origemImagem.arquivoOriginal, tipo: 'image/webp', rotulo: 'Foto/arte original aplicada' });
    if (p.previewImagem?.startsWith('data:image/')) arquivos.push({ nome: `${base}-resultado-final.png`, dataUrl: p.previewImagem, tipo: 'image/png', rotulo: 'Print do resultado final' });
    if (p.svg) {
      const { svg, svgOriginal, previewImagem, origemImagem, ...configuracao } = p;
      const origemSemArquivo = origemImagem ? { ...origemImagem, arquivoOriginal: undefined } : undefined;
      arquivos.push({ nome: `${base}-configuracao.json`, conteudo: JSON.stringify({ produto: item.nome, dimensoes: item.dimensoes, ...configuracao, origemImagem: origemSemArquivo }, null, 2) });
    }
    return arquivos;
  }));
}

export function baixarArquivoPersonalizacao(arquivo) {
  const url = arquivo.dataUrl || URL.createObjectURL(new Blob([arquivo.conteudo], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = arquivo.nome;
  link.click();
  if (!arquivo.dataUrl) setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function baixarAnexoPedido(anexo) {
  const link = document.createElement('a');
  link.href = anexo.dados;
  link.download = anexo.nome || 'referencia';
  link.click();
}
