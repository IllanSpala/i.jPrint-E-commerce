export const TIPOS_ANEXOS_PEDIDO = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
export const LIMITE_ANEXOS_PEDIDO = 3;
export const LIMITE_BYTES_ANEXOS_PEDIDO = 2 * 1024 * 1024;

export function validarAnexosPedido(arquivos = []) {
  if (!Array.isArray(arquivos) || arquivos.length > LIMITE_ANEXOS_PEDIDO) return 'Selecione até 3 arquivos.';
  if (arquivos.some(arquivo => !TIPOS_ANEXOS_PEDIDO.includes(arquivo.type) || arquivo.size <= 0)) {
    return 'Use fotos JPG, PNG ou WebP, ou vídeos MP4 ou WebM não vazios.';
  }
  if (arquivos.reduce((total, arquivo) => total + arquivo.size, 0) > LIMITE_BYTES_ANEXOS_PEDIDO) {
    return 'Os arquivos devem somar até 2 MB.';
  }
  return '';
}

export function lerAnexoPedido(arquivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ nome: arquivo.name.slice(0, 180), tipo: arquivo.type, tamanho: arquivo.size, dados: reader.result });
    reader.onerror = () => reject(new Error(`Não foi possível ler ${arquivo.name}.`));
    reader.readAsDataURL(arquivo);
  });
}

export function dadosDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  return match ? { tipo: match[1], base64: match[2] } : null;
}
