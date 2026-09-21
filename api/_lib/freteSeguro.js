import { createHmac, timingSafeEqual, createHash } from 'node:crypto';

export function hashCarrinho(itens, precos) {
  return createHash('sha256').update(JSON.stringify(itens.map((item, i) => ({ id: item.id, quantidade: item.quantidade, opcao: item.opcaoEscolhida || null, modo: item.modoCompra || null, preco: precos[i].price })))).digest('hex');
}
function assinar(texto) {
  const segredo = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!segredo) throw new Error('Assinatura de frete indisponível');
  return createHmac('sha256', segredo).update('ijprint-frete-v1:' + texto).digest('base64url');
}
export function criarCotacao(dados) {
  const payload = Buffer.from(JSON.stringify({ ...dados, expira: Date.now() + 15 * 60 * 1000 })).toString('base64url');
  return `${payload}.${assinar(payload)}`;
}
export function verificarCotacao(token, esperado) {
  const falhar = () => { throw Object.assign(new Error('Recalcule o frete antes de pagar.'), { status: 400 }); };
  if (typeof token !== 'string' || token.length > 4096) return falhar();
  const [payload, assinatura, extra] = token.split('.');
  if (!payload || !assinatura || extra) return falhar();
  const a = Buffer.from(assinatura), b = Buffer.from(assinar(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return falhar();
  let dados;
  try { dados = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return falhar(); }
  if (dados.expira < Date.now() || !Number.isSafeInteger(dados.centavos) || dados.centavos < 0 || !Number.isSafeInteger(dados.servico) || Object.entries(esperado).some(([k,v]) => dados[k] !== v)) return falhar();
  return dados;
}
