export function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function gerarReciboSeguro(pedido) {
  const e = escaparHtml;
  const dinheiro = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const endereco = pedido.endereco || {};
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Recibo I.J Print</title><style>body{font:16px sans-serif;margin:40px;color:#18181b}table{width:100%;border-collapse:collapse}td,th{padding:12px;text-align:left;border-bottom:1px solid #ddd}</style></head><body><h1>I.J Print — Recibo de pedido</h1><p>Não é documento fiscal.</p><p>Pedido: ${e(pedido.id)}</p><p>Status: ${e(pedido.status)}</p><p>Cliente: ${e(pedido.perfis?.nome || endereco.cliente_nome)}</p><p>${e(endereco.logradouro || endereco.rua)}, ${e(endereco.numero)} — ${e(endereco.bairro)} — ${e(endereco.cidade)}/${e(endereco.uf)} — ${e(endereco.cep)}</p><table><thead><tr><th>Produto</th><th>Quantidade</th><th>Unitário</th></tr></thead><tbody>${(pedido.itens || []).map(i => `<tr><td>${e(i.nome)} ${e(i.opcaoEscolhida)}<br>${e(i.personalizacao)} ${e(i.parametrosMultiplos?.join(', '))}</td><td>${e(i.quantidade)}</td><td>${e(dinheiro(i.precoPromocional || i.preco))}</td></tr>`).join('')}</tbody></table><p>Desconto: ${e(dinheiro(pedido.desconto))}</p><p>Frete: ${pedido.frete_valor == null ? 'Não registrado (pedido anterior)' : e(dinheiro(pedido.frete_valor))}</p><h2>Total: ${e(dinheiro(pedido.total))}</h2></body></html>`;
}
