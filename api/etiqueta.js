import { protegerAdmin } from './_lib/seguranca.js';
import { gerarReciboSeguro } from '../src/lib/reciboSeguro.js';

export default protegerAdmin(async (req, res, db) => {
  const { data: pedido, error } = await db.from('pedidos').select('*, perfis(nome,telefone,cpf)').eq('id', req.body?.pedido_id).maybeSingle();
  if (error) throw new Error('Consulta indisponível');
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado.' });
  if (!['Pago', 'Em Produção', 'Enviado', 'Concluído'].includes(pedido.status)) return res.status(409).json({ error: 'Aguarde a confirmação do pagamento.' });
  const recibo = { success: true, html_recibo: gerarReciboSeguro(pedido), is_retirada: pedido.modo_entrega === 'retirada', cart_id: pedido.melhor_envio_cart_id, tracking_url: pedido.tracking_url };
  if (pedido.modo_entrega !== 'envio' || pedido.melhor_envio_cart_id) return res.status(200).json(recibo);
  if (pedido.status !== 'Em Produção') return res.status(409).json({ error: 'Inicie a produção antes de preparar o envio.' });
  if (!pedido.frete_servico || !process.env.MELHOR_ENVIO_TOKEN || !process.env.ORIGEM_CEP) return res.status(503).json({ error: 'Serviço de envio ou configuração ausente. Concilie este pedido manualmente.' });
  // A claim persists across ambiguous failures: do not create duplicate labels.
  const claim = await db.from('pedidos').update({ etiqueta_estado: 'processando' }).eq('id', pedido.id).eq('etiqueta_estado', 'pendente').eq('status', 'Em Produção').select('id').maybeSingle();
  if (claim.error) throw new Error('Falha ao reservar envio');
  if (!claim.data) return res.status(409).json({ error: 'Envio já processado ou aguardando conciliação no Melhor Envio.' });
  const endereco = pedido.endereco;
  const produtos = pedido.itens.map(i => {
    const medidas = String(i.dimensoes || '').split('x').map(n => Math.ceil(Number(n) / 10));
    if (medidas.length !== 3 || medidas.some(n => !Number.isFinite(n) || n <= 0) || !(i.peso_gramas > 0)) throw new Error('Dimensões ou peso não cadastrados');
    return { name: i.nome, quantity: i.quantidade, unitary_value: i.preco, weight: i.peso_gramas / 1000, width: medidas[0], length: medidas[1], height: medidas[2] };
  });
  const resposta = await fetch('https://melhorenvio.com.br/api/v2/me/cart', {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${process.env.MELHOR_ENVIO_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'I.J Print (i.j.print26@gmail.com)' },
    body: JSON.stringify({ service: pedido.frete_servico,
      from: { name: 'I.J Print', postal_code: process.env.ORIGEM_CEP.replace(/\D/g, ''), address: 'Quadra da Guararema', number: 'S/N', city: 'Alegre', state_abbr: 'ES', email: 'i.j.print26@gmail.com' },
      to: { name: endereco.cliente_nome, postal_code: endereco.cep.replace(/\D/g, ''), address: endereco.logradouro || endereco.rua, number: endereco.numero, district: endereco.bairro, city: endereco.cidade, state_abbr: endereco.uf, document: pedido.perfis?.cpf?.replace(/\D/g, '') },
      products: produtos, options: { receipt: false, own_hand: false },
      volumes: produtos.flatMap(p => Array.from({ length: p.quantity }, () => ({ weight: p.weight, width: p.width, length: p.length, height: p.height }))),
      tag: { tag: `pedido-${pedido.id}`, url: null },
    }),
  });
  if (!resposta.ok) return res.status(502).json({ error: 'Falha no Melhor Envio. Confira o carrinho na operadora antes de tentar novamente.' });
  const etiqueta = await resposta.json();
  if (typeof etiqueta.id !== 'string') throw new Error('Resposta inválida');
  const salvo = await db.from('pedidos').update({ melhor_envio_cart_id: etiqueta.id, etiqueta_estado: 'criada' }).eq('id', pedido.id).eq('etiqueta_estado', 'processando');
  if (salvo.error) throw new Error('Conciliação do envio necessária');
  return res.status(200).json({ ...recibo, cart_id: etiqueta.id, message: 'Adicionado ao carrinho do Melhor Envio. Compre a etiqueta e poste antes de marcar como enviado.' });
});
