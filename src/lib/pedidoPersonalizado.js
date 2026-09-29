export const LIMITE_ANEXOS = 3;
export const LIMITE_BYTES = 3 * 1024 * 1024;
export const TIPOS_ANEXOS = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
export function validarArquivos(arquivos) {
  if (arquivos.length > LIMITE_ANEXOS) return 'Selecione até 3 arquivos.';
  if (arquivos.some(a => !TIPOS_ANEXOS.includes(a.type) || a.size <= 0)) return 'Use imagens JPG, PNG ou WebP, ou vídeos MP4 ou WebM não vazios.';
  if (arquivos.reduce((s, a) => s + a.size, 0) > LIMITE_BYTES) return 'Os anexos devem somar até 3 MB. Para vídeos maiores, envie um link.';
  return '';
}
export function validarPedido(dados) {
  if (typeof dados?.nome !== 'string' || dados.nome.trim().length < 2 || dados.nome.length > 100) return 'Informe seu nome (2 a 100 caracteres).';
  if (typeof dados.email !== 'string' || dados.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) return 'Informe um e-mail válido para contato.';
  if (typeof dados.descricao !== 'string' || dados.descricao.trim().length < 20 || dados.descricao.length > 4000) return 'Descreva sua ideia em 20 a 4.000 caracteres.';
  if (typeof dados.referencia !== 'string' || dados.referencia.length > 2000) return 'Link de referência inválido.';
  if (dados.referencia) {
    try { const url = new URL(dados.referencia); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return 'Use um link http ou https.'; }
    catch { return 'Informe um link completo, começando com https://.'; }
  }
  return '';
}
