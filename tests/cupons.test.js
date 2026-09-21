import { criarCotacao, hashCarrinho } from '../api/_lib/freteSeguro.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { obterCupom, calcularDesconto, precificarItens } from '../api/_lib/cupons.js';
import { criarHandlerCupom } from '../api/cupom.js';
import { criarHandlerPagamento } from '../api/pagamento.js';

const produto = { id: 1, nome: 'Peça', preco: 99.9, preco_promocional: 63.9, opcoes: [{ nome: 'Padrão' }, { nome: 'Grande', precoAcrescimo: 10 }] };
const item = { opcaoEscolhida: 'Padrão', id: 1, nome: 'Peça', quantidade: 2, preco: 0.01 };
function banco({ comprado = false, reservado = false, indisponivel = false, autenticado = true, reservaResult = 'reservado', insertError = null } = {}) {
  const registros = [];
  const liberados = [];
  return {
    registros, liberados,
    auth: { getUser: async () => ({ data: { user: autenticado ? { id: 'cliente-1', email: 'teste@example.com' } : null }, error: null }) },
    rpc: async (nome) => ({ data: nome === 'limitar_requisicoes_loja' ? true : reservaResult, error: null }),
    from(tabela) {
      let action = 'select';
      const q = {
        select() { return q; }, eq() { return q; }, in() { return q; },
        update() { return q; },
        insert(v) { action = 'insert'; registros.push(v); return q; },
        delete() { action = 'delete'; liberados.push(tabela); return q; },
        single() { return q; }, maybeSingle() { return q; },
        then(resolve, reject) {
          let data = null;
          let error = null;
          if (tabela === 'produtos') data = [produto];
          if (tabela === 'perfis') data = { nome: 'Teste', cpf: '52998224725', telefone: '11999999999' };
          if (tabela === 'clientes_com_compra') { data = comprado ? { user_id: 'cliente-1' } : null; error = indisponivel ? new Error('offline') : null; }
          if (tabela === 'cupons_reservados' && action === 'select') data = reservado ? { user_id: 'cliente-1' } : null;
          if (tabela === 'pedidos' && action === 'insert') error = insertError;
          return Promise.resolve({ data, error }).then(resolve, reject);
        },
      };
      return q;
    },
  };
}
function resposta() {
  return { statusCode: 200, setHeader() {}, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } };
}
const request = (body, token = 'teste') => ({ method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body });

test('normaliza código e rejeita códigos desconhecidos', () => {
  assert.equal(obterCupom(' compre.ij ').percentual, 10);
  for (const code of ['OUTRO', 'toString', null, {}]) assert.throws(() => obterCupom(code));
});
test('desconto preserva centavos exatos em linhas com múltiplas unidades', () => {
  const resultado = calcularDesconto([{ price: 333, quantity: 3 }, { price: 6390, quantity: 2 }], obterCupom('COMPRE.IJ'));
  assert.equal(resultado.subtotalCentavos, 13779);
  assert.equal(resultado.descontoCentavos, 1378);
  assert.equal(resultado.itemsComDesconto.reduce((s, i) => s + i.price * i.quantity, 0), 12401);
  assert.ok(resultado.itemsComDesconto.every((i) => Number.isInteger(i.price) && i.price > 0));
});
test('usa preços do banco, promoção e acréscimo, ignorando preço forjado', async () => {
  assert.deepEqual(await precificarItens(banco(), [{ ...item, opcaoEscolhida: 'Grande' }]), [{ quantity: 2, price: 7390, description: 'Peça' }]);
});
test('não aceita flag de pagamento livre forjada para produto normal', async () => {
  await assert.rejects(precificarItens(banco(), [{ ...item, isPagamentoPersonalizado: true }]));
});
test('rejeita quantidade negativa, fracionária e produto inexistente', async () => {
  for (const qtd of [-1, 0, 1.5, '2', 1000]) await assert.rejects(precificarItens(banco(), [{ ...item, quantidade: qtd }]));
  await assert.rejects(precificarItens(banco(), [{ ...item, id: 2 }]));
});
test('valida cupom antes do pagamento sem reservar nem criar pedido', async () => {
  const db = banco(); const res = resposta();
  await criarHandlerCupom(db)(request({ codigo: 'compre.ij', itens: [item] }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.descontoCentavos, 1278);
  assert.equal(db.registros.length, 0);
});
for (const [nome, options, status] of [
  ['compra anterior', { comprado: true }, 400],
  ['pagamento com cupom pendente', { reservado: true }, 409],
  ['histórico indisponível', { indisponivel: true }, 503],
  ['sessão inválida', { autenticado: false }, 401],
]) test(`bloqueia ${nome}`, async () => {
  const res = resposta();
  await criarHandlerCupom(banco(options))(request({ codigo: 'COMPRE.IJ', itens: [item] }), res);
  assert.equal(res.statusCode, status);
});
test('exige login', async () => {
  const res = resposta();
  await criarHandlerCupom(banco())(request({ codigo: 'COMPRE.IJ', itens: [item] }, null), res);
  assert.equal(res.statusCode, 401);
});

async function pagamento(db, fetchPagamento, codigo = 'COMPRE.IJ') {
  process.env.INFINITEPAY_HANDLE = 'loja-teste';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-local-apenas-teste';
  const cotacao = criarCotacao({ userId: 'cliente-1', cep: '01001000', carrinho: hashCarrinho([item], [{ price: 6390 }]), centavos: 2550, servico: 1 });
  const res = resposta();
  await criarHandlerPagamento(db, { fetchPagamento, enviarCliente: async () => {}, enviarAdmin: async () => {} })(request({
    itens: [item], cupom: codigo, frete_valor: 0.01, modo_entrega: 'envio', cotacao, endereco: { logradouro: 'Rua Teste', numero: '1', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '01001000' }, redirect_base_url: 'https://example.com/pedido-confirmado',
  }), res);
  return res;
}
test('checkout cobra 10% a menos nos itens e frete integral; grava desconto e total', async () => {
  const db = banco(); let enviado;
  const res = await pagamento(db, async (_url, opts) => { enviado = JSON.parse(opts.body); return { ok: true, json: async () => ({ url: 'https://pay.infinitepay.io/pagar' }) }; });
  assert.equal(res.statusCode, 200);
  assert.equal(enviado.items.reduce((s, i) => s + i.price * i.quantity, 0), 14052);
  assert.equal(enviado.items.at(-1).price, 2550);
  assert.equal(db.registros[0].total, 140.52);
  assert.equal(db.registros[0].desconto, 12.78);
  assert.equal(db.registros[0].cupom_codigo, 'COMPRE.IJ');
});
test('checkout sem cupom mantém total original', async () => {
  const db = banco();
  const res = await pagamento(db, async () => ({ ok: true, json: async () => ({ url: 'https://pay.infinitepay.io/pagar' }) }), null);
  assert.equal(res.statusCode, 200);
  assert.equal(db.registros[0].total, 153.3);
  assert.equal(db.registros[0].cupom_codigo, undefined);
});
test('revalida primeira compra no checkout antes de chamar provedor', async () => {
  let chamou = false;
  const res = await pagamento(banco({ comprado: true }), async () => { chamou = true; });
  assert.equal(res.statusCode, 400); assert.equal(chamou, false);
});
test('segunda reserva concorrente não gera outro link', async () => {
  let chamou = false;
  const res = await pagamento(banco({ reservaResult: 'ja_reservado' }), async () => { chamou = true; });
  assert.equal(res.statusCode, 409); assert.equal(chamou, false);
});
test('libera reserva após rejeição definitiva do provedor', async () => {
  const db = banco();
  const res = await pagamento(db, async () => ({ ok: false, status: 422, text: async () => '{"message":"Pedido inválido"}' }));
  assert.equal(res.statusCode, 500); assert.deepEqual(db.liberados, ['cupons_reservados']);
});
test('preserva reserva quando a rede falha após envio ao provedor', async () => {
  const db = banco();
  const res = await pagamento(db, async () => { throw new Error('Timeout'); });
  assert.equal(res.statusCode, 500); assert.equal(db.liberados.length, 0);
});
test('não chama a operadora quando não consegue salvar o pedido', async () => {
  const db = banco({ insertError: new Error('offline') });
  let chamadas = 0;
  const res = await pagamento(db, async () => { chamadas++; });
  assert.equal(res.statusCode, 500); assert.equal(chamadas, 0); assert.equal(db.liberados.length, 0);
});
