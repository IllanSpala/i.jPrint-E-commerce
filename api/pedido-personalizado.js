import { createHash } from 'node:crypto';
import { bancoServidor, limitarRequisicoes } from './_lib/seguranca.js';
import { enviarEmailAdmin } from './_lib/mailer.js';
import { escaparHtml } from '../src/lib/reciboSeguro.js';
import { validarPedido, validarArquivos, LIMITE_BYTES, LIMITE_ANEXOS } from '../src/lib/pedidoPersonalizado.js';

export function prepararAnexos(anexos) {
  if (!Array.isArray(anexos) || anexos.length > LIMITE_ANEXOS) throw new Error('Anexos inválidos.');
  let total = 0;
  const files = anexos.map((a, i) => {
    if (typeof a?.conteudo !== 'string' || a.conteudo.length > Math.ceil(LIMITE_BYTES / 3) * 4 || (a.conteudo.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(a.conteudo))) throw new Error('Arquivo inválido.');
    const buffer = Buffer.from(a.conteudo, 'base64');
    total += buffer.length;
    if (total > LIMITE_BYTES) throw new Error('Os anexos devem somar até 3 MB.');
    const tipo = a.tipo;
    const assinatura = tipo === 'image/jpeg' ? buffer.subarray(0,3).equals(Buffer.from([255,216,255]))
      : tipo === 'image/png' ? buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : tipo === 'image/webp' ? buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP'
      : tipo === 'video/mp4' ? buffer.toString('ascii',4,8) === 'ftyp'
      : tipo === 'video/webm' ? buffer.subarray(0,4).equals(Buffer.from([26,69,223,163])) : false;
    if (!assinatura) throw new Error('O conteúdo do arquivo não corresponde ao formato aceito.');
    const ext = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'video/mp4':'mp4', 'video/webm':'webm' }[tipo];
    return { filename:`referencia-${i + 1}.${ext}`, content:buffer.toString('base64'), type:tipo, size:buffer.length };
  });
  const erro = validarArquivos(files); if (erro) throw new Error(erro);
  return files.map(({filename,content}) => ({filename,content}));
}

export function criarHandler({ criarBanco = bancoServidor, limitar = limitarRequisicoes, enviar = enviarEmailAdmin } = {}) {
  return async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error:'Método não permitido.' });
    const dados = req.body;
    const erro = validarPedido(dados);
    if (erro) return res.status(400).json({ error:erro });
    if (typeof dados.chave !== 'string' || !/^[a-f0-9-]{36}$/i.test(dados.chave)) return res.status(400).json({error:'Identificador de envio inválido.'});
    try {
      const db = criarBanco();
      const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
      await limitar(db, 'personalizado:' + createHash('sha256').update(ip).digest('hex'), 3);
      let attachments;
      try { attachments = prepararAnexos(dados.anexos || []); }
      catch (e) { return res.status(400).json({error:e.message}); }
      const resultado = await enviar({ subject:'Nova solicitação — I.J Print', idempotencyKey:`personalizado/${dados.chave}`, attachments,
        html:`<h2>Solicitação de avaliação / consulta de peça</h2><p>Nome: ${escaparHtml(dados.nome)}</p><p>E-mail: ${escaparHtml(dados.email)}</p><p style="white-space:pre-wrap">${escaparHtml(dados.descricao)}</p><p>Referência: ${escaparHtml(dados.referencia || 'Não informada')}</p>` });
      if (!resultado.sent) return res.status(503).json({error:'Não foi possível confirmar o envio. Tente novamente em instantes.'});
      return res.status(200).json({ok:true});
    } catch (e) { return res.status(e.status || 503).json({error:e.status ? e.message : 'Serviço temporariamente indisponível. Tente novamente.'}); }
  };
}
export default criarHandler();
