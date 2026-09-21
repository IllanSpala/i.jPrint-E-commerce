// Regressões de segurança. Sem rede, cobranças, banco ou e-mails reais.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarHandlerWebhook } from '../api/webhook.js';
import { protegerAdmin } from '../api/_lib/seguranca.js';
import { precificarItens } from '../api/_lib/cupons.js';
import { criarCotacao, verificarCotacao, hashCarrinho } from '../api/_lib/freteSeguro.js';
import { gerarReciboSeguro } from '../src/lib/reciboSeguro.js';
import { svgSeguro } from '../src/lib/svgSeguro.js';
import { produtos } from '../src/data/produtos.js';
import { criarHandlerPagamento } from '../api/pagamento.js';

const resposta = () => ({ code: 200, status(c) { this.code = c; return this; }, json(v) { this.body = v; return this; } });
function banco({ admin = false, autenticado = true, total = 100, status = 'Aguardando Pagamento', produto = { id: 10001, nome: 'Peça', preco: 100 } } = {}) {
  const db = { pedido: { id: 'pedido-1', total, status, pagamento_handle: 'loja-teste' }, mudancas: [], consultas: [],
    auth: { getUser: async () => ({ data: { user: autenticado ? { id: 'cliente-1', email: 'teste@example.invalid' } : null } }) },
    rpc: async () => ({ data: true }),
    from(tabela) {
      let valor; let acao = 'select'; const filtros = [];
      const q = { select() { return q; }, eq(k,v) { filtros.push([k,v]); return q; }, in() { return q; }, maybeSingle() { return q; }, single() { return q; },
        update(v) { valor = v; acao = 'update'; return q; }, insert(v) { valor = v; acao = 'insert'; return q; },
        then(resolve, reject) {
          db.consultas.push({ tabela, acao, filtros });
          let data = null, error = null;
          if (tabela === 'loja_admins') data = admin ? { user_id: 'cliente-1' } : null;
          if (tabela === 'produtos') data = [produto];
          if (tabela === 'perfis') data = { nome: 'Teste', cpf: '52998224725', telefone: '11999999999' };
          if (tabela === 'pedidos') {
            if (acao === 'insert') { db.pedido = valor; db.mudancas.push(valor); }
            else if (acao === 'update' && filtros.every(([k,v]) => db.pedido[k] === v)) { Object.assign(db.pedido, valor); db.mudancas.push(valor); }
            if (filtros.every(([k,v]) => db.pedido[k] === v)) data = { ...db.pedido };
          }
          return Promise.resolve({ data, error }).then(resolve, reject);
        },
      }; return q;
    },
  }; return db;
}
for (const [nome, req, options, codigo] of [
  ['anônimo', { headers: {} }, {}, 401],
  ['sessão inválida', { headers: { authorization: 'Bearer invalido' } }, { autenticado: false }, 401],
  ['cliente sem cargo', { headers: { authorization: 'Bearer cliente' } }, {}, 403],
  ['administrador', { headers: { authorization: 'Bearer admin' } }, { admin: true }, 200],
]) test(`autorização administrativa: ${nome}`, async () => {
  let executou = false; const res = resposta();
  await protegerAdmin(async (_req, r) => { executou = true; r.json({ ok: true }); }, () => banco(options))({ method: 'POST', ...req }, res);
  assert.equal(res.code, codigo); assert.equal(executou, codigo === 200);
});
const evento = { order_nsu: 'pedido-1', transaction_nsu: 'tx-1', invoice_slug: 'slug-1', status: 'paid' };
for (const [nome, validacao, codigo] of [
  ['status forjado', { success: true, paid: false, amount: 10000 }, 400],
  ['valor menor', { success: true, paid: true, amount: 1 }, 400],
  ['valor maior', { success: true, paid: true, amount: 10001 }, 400],
  ['tipo inválido', { success: true, paid: true, amount: '10000' }, 400],
  ['pagamento confirmado', { success: true, paid: true, amount: 10000, paid_amount: 10100 }, 200],
]) test(`webhook: ${nome}`, async () => {
  process.env.INFINITEPAY_HANDLE = 'loja-teste'; const db = banco(); const res = resposta();
  await criarHandlerWebhook(db, async (url, options) => {
    assert.equal(url, 'https://api.checkout.infinitepay.io/payment_check');
    assert.deepEqual(JSON.parse(options.body), { handle: 'loja-teste', order_nsu: 'pedido-1', transaction_nsu: 'tx-1', slug: 'slug-1' });
    return { ok: true, json: async () => validacao };
  })({ method: 'POST', body: evento }, res);
  assert.equal(res.code, codigo); assert.equal(db.mudancas.length, codigo === 200 ? 1 : 0);
});
test('webhook repetido não regride pedido enviado nem duplica confirmação', async () => {
  const db = banco(); const handler = criarHandlerWebhook(db, async () => ({ ok: true, json: async () => ({ success: true, paid: true, amount: 10000 }) }));
  await handler({ method: 'POST', body: evento }, resposta());
  await handler({ method: 'POST', body: evento }, resposta());
  assert.equal(db.mudancas.length, 1);
  db.pedido.status = 'Enviado'; await handler({ method: 'POST', body: evento }, resposta());
  assert.equal(db.pedido.status, 'Enviado');
});
test('webhook não confirma se operadora falhar', async () => {
  const db = banco(), res = resposta();
  await criarHandlerWebhook(db, async () => { throw new Error('timeout'); })({ method: 'POST', body: evento }, res);
  assert.equal(res.code, 503); assert.equal(db.mudancas.length, 0);
});
test('preço absoluto do produto real Pintado é respeitado', async () => {
  const p = produtos.find(p => p.id === 32);
  const r = await precificarItens(banco({ produto: p }), [{ id: 32, quantidade: 1, opcaoEscolhida: 'Pintado', preco: 0.01 }]);
  assert.equal(r[0].price, 15990);
});
test('variação, estoque e opção obrigatória são validados', async () => {
  const p = { id: 10001, preco: 100, opcoes: [{ nome: 'Kit', preco: 150, variacoes: [{ nome: 'Grande', preco: 200 }, { nome: 'Pequeno', esgotado: true }] }] };
  const db = banco({ produto: p });
  assert.equal((await precificarItens(db, [{ id: p.id, quantidade: 1, opcaoEscolhida: 'Kit - Grande' }]))[0].price, 20000);
  for (const opcaoEscolhida of [null, 'Kit', 'Kit - Pequeno', 'Outro']) await assert.rejects(precificarItens(db, [{ id: p.id, quantidade: 1, opcaoEscolhida }]));
});
test('assinatura do frete impede alteração de valor, usuário, carrinho e CEP', () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'segredo-somente-teste';
  const esperado = { userId: 'cliente-1', cep: '01001000', carrinho: 'hash-1' };
  const token = criarCotacao({ ...esperado, centavos: 2550, servico: 1 });
  assert.equal(verificarCotacao(token, esperado).centavos, 2550);
  for (const campo of ['userId', 'cep', 'carrinho']) assert.throws(() => verificarCotacao(token, { ...esperado, [campo]: 'alterado' }));
  const partes = token.split('.'); const dados = JSON.parse(Buffer.from(partes[0], 'base64url')); dados.centavos = 0;
  assert.throws(() => verificarCotacao(Buffer.from(JSON.stringify(dados)).toString('base64url') + '.' + partes[1], esperado));
});
test('recibo não executa HTML nem transforma desconto em frete', () => {
  const html = gerarReciboSeguro({ id: 'p', status: 'Pago', endereco: { cliente_nome: '<img src=x onerror=alert(1)>' }, itens: [{ nome: '<script>x</script>', preco: 100, quantidade: 1 }], desconto: 10, frete_valor: 25, total: 115 });
  assert.doesNotMatch(html, /<img|<script/); assert.match(html, /&lt;img/); assert.match(html, /Frete: R\$\s*25,00/); assert.match(html, /default-src 'none'/);
});
test('SVG só permite geometria estática, incluindo originais', () => {
  assert.equal(svgSeguro('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fill="#000" d="M0 0 L20 20"/></svg>'), true);
  for (const svg of ['<svg onload="alert(1)"/>','<svg><script>alert(1)</script></svg>','<svg><foreignObject/></svg>','<svg><image href="https://evil.invalid"/></svg>','<!DOCTYPE svg><svg/>','<svg><style>body{}</style></svg>','<svg><path fill="url(https://evil.invalid)"/></svg>','<svg><path fill="&#106;avascript:foo"/></svg>']) assert.equal(svgSeguro(svg), false, svg);
});
test('checkout sem cupom também rejeita quantidade ou flag de preço forjada', async () => {
  for (const item of [{ id: 10001, quantidade: -1 }, { id: 10001, quantidade: 1, isPagamentoPersonalizado: true, preco: 0.01 }]) {
    const db = banco(), res = resposta(); let cobrancas = 0;
    await criarHandlerPagamento(db, { fetchPagamento: async () => { cobrancas++; } })({ method: 'POST', headers: { authorization: 'Bearer teste' }, body: { itens: [item], modo_entrega: 'retirada', endereco: {} } }, res);
    assert.equal(res.code, 400); assert.equal(cobrancas, 0); assert.equal(db.mudancas.length, 0);
  }
});
test('checkout repetido reaproveita o link já criado', async () => {
  process.env.INFINITEPAY_HANDLE = 'loja-teste';
  const db = banco(); let cobrancas = 0;
  const handler = criarHandlerPagamento(db, { fetchPagamento: async () => { cobrancas++; return { ok: true, json: async () => ({ url: 'https://pay.infinitepay.io/checkout-teste' }) }; } });
  const req = { method: 'POST', headers: { authorization: 'Bearer teste' }, body: { itens: [{ id: 10001, quantidade: 1 }], modo_entrega: 'retirada', endereco: {} } };
  const primeiro = resposta(), segundo = resposta();
  await handler(req, primeiro); await handler(req, segundo);
  assert.equal(primeiro.code, 200); assert.equal(segundo.code, 200);
  assert.equal(segundo.body.link_pagamento, primeiro.body.link_pagamento);
  assert.equal(cobrancas, 1);
});
test('falha de rede não permite criar outro link na tentativa seguinte', async () => {
  const db = banco(); let cobrancas = 0;
  const handler = criarHandlerPagamento(db, { fetchPagamento: async () => { cobrancas++; throw new Error('Timeout após envio'); } });
  const req = { method: 'POST', headers: { authorization: 'Bearer teste' }, body: { itens: [{ id: 10001, quantidade: 1 }], modo_entrega: 'retirada', endereco: {} } };
  await handler(req, resposta()); const segundo = resposta(); await handler(req, segundo);
  assert.equal(segundo.code, 409); assert.equal(cobrancas, 1); assert.ok(db.pedido.id);
});
test('pedido legado sem identificação segura da loja exige conciliação', async () => {
  const db = banco(); db.pedido.pagamento_handle = null; let chamadas = 0; const res = resposta();
  await criarHandlerWebhook(db, async () => { chamadas++; })({ method: 'POST', body: evento }, res);
  assert.equal(res.code, 503); assert.equal(chamadas, 0); assert.equal(db.mudancas.length, 0);
});
