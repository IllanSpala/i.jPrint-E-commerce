import { svgSeguro } from '../../src/lib/svgSeguro.js';
import { produtos } from '../../src/data/produtos.js';
import { dadosDataUrl, LIMITE_ANEXOS_PEDIDO, LIMITE_BYTES_ANEXOS_PEDIDO, TIPOS_ANEXOS_PEDIDO } from '../../src/lib/anexosPedido.js';

function assinaturaValida(tipo, buffer) {
  if (tipo === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (tipo === 'image/jpeg') return buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (tipo === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  if (tipo === 'video/mp4') return buffer.subarray(4, 8).toString() === 'ftyp';
  if (tipo === 'video/webm') return buffer.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]));
  return false;
}

export function validarAnexosItem(anexos) {
  if (anexos == null) return null;
  if (!Array.isArray(anexos) || anexos.length > LIMITE_ANEXOS_PEDIDO) return 'Anexos inválidos.';
  let total = 0;
  for (const anexo of anexos) {
    const dados = dadosDataUrl(anexo?.dados);
    if (!dados || dados.tipo !== anexo.tipo || !TIPOS_ANEXOS_PEDIDO.includes(dados.tipo)) return 'Formato de anexo inválido.';
    const buffer = Buffer.from(dados.base64, 'base64');
    if (!buffer.length || buffer.toString('base64') !== dados.base64 || !assinaturaValida(dados.tipo, buffer)) return 'Conteúdo de anexo inválido.';
    total += buffer.length;
  }
  return total > LIMITE_BYTES_ANEXOS_PEDIDO ? 'Os anexos devem somar até 2 MB.' : null;
}

export function validarPersonalizacao(item) {
  if (!item || typeof item !== 'object') return 'Item inválido.';
  if (item.personalizacoes && (!Array.isArray(item.personalizacoes) || item.personalizacoes.some(p => !p || !svgSeguro(p.svg) || (p.svgOriginal && !svgSeguro(p.svgOriginal))))) return 'SVG inválido. Envie somente vetores estáticos, sem CSS, scripts ou links externos.';
  const produto = produtos.find(p => String(p.id) === String(item.id));
  if (item.personalizacoes?.some(p => {
    const preview = dadosDataUrl(p.previewImagem);
    const original = p.origemImagem?.arquivoOriginal ? dadosDataUrl(p.origemImagem.arquivoOriginal) : null;
    return !preview || preview.tipo !== 'image/png' || !assinaturaValida('image/png', Buffer.from(preview.base64, 'base64')) ||
      (p.origemImagem?.arquivoOriginal && (!original || original.tipo !== 'image/webp' || !assinaturaValida('image/webp', Buffer.from(original.base64, 'base64'))));
  })) return 'Prévia da personalização inválida.';
  const erroAnexos = validarAnexosItem(item.anexos);
  if (erroAnexos) return erroAnexos;
  if (item.anexos?.length && !produto?.exigePersonalizacao) return 'Este produto não aceita anexos de referência.';
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
