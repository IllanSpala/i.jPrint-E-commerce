import { limitarRequisicoes } from './_lib/seguranca.js';
import { bancoServidor } from './_lib/seguranca.js';
import { precificarItens } from './_lib/cupons.js';
import { criarCotacao, hashCarrinho } from './_lib/freteSeguro.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { cep_destino, itens } = req.body || {};
  if (typeof cep_destino !== 'string' || !/^\d{8}$/.test(cep_destino.replace(/\D/g, ''))) return res.status(400).json({ error: 'CEP inválido.' });
  const token = process.env.MELHOR_ENVIO_TOKEN;
  const cepOrigem = process.env.ORIGEM_CEP; // Adicione isso no seu .env.local depois!

  if (!token || !cepOrigem) {
    return res.status(503).json({ error: 'Frete indisponível: configuração pendente.' });
  }

  try {
    const db = bancoServidor();
    const jwt = /^Bearer (\S+)$/.exec(req.headers?.authorization || '')?.[1];
    if (!jwt) return res.status(401).json({ error: 'Autenticação necessária.' });
    const { data: auth, error: authError } = await db.auth.getUser(jwt);
    if (authError || !auth?.user) return res.status(401).json({ error: 'Sessão inválida.' });
    await limitarRequisicoes(db, 'frete:' + auth.user.id, 20);
    const precos = await precificarItens(db, itens);
    const { data: catalogo, error: erroCatalogo } = await db.from('produtos').select('*').in('id', itens.map(i => i.id));
    if (erroCatalogo) throw new Error('Catálogo indisponível');
    // Melhor Envio requer medidas mínimas: 1x1x1cm e peso 0.1kg. Vamos mapear nossos itens (em mm/g) para cm/kg
    const products = itens.map((original, index) => {
      const produto = catalogo.find(p => p.id === original.id);
      const item = { ...produto, quantidade: original.quantidade, preco: precos[index].price / 100 };
      if (!item.dimensoes || !item.peso_gramas) throw new Error('Peso ou dimensões não cadastrados');
      // Separamos "XxYxZ" (ex: "50x50x100") e convertemos para cm
      const dims = item.dimensoes ? item.dimensoes.split('x').map(n => Math.max(1, Math.ceil(parseInt(n) / 10))) : [11, 11, 11];
      const pesoKg = item.peso_gramas ? Math.max(0.1, item.peso_gramas / 1000) : 0.3;

      return {
        id: item.id.toString(),
        width: dims[0],
        length: dims[1],
        height: dims[2],
        weight: pesoKg,
        insurance_value: item.preco,
        quantity: item.quantidade
      };
    });

    const response = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Aplicação ij-print26 (i.j.print26@gmail.com)'
      },
      body: JSON.stringify({
        from: { postal_code: cepOrigem.replace(/\D/g, '') },
        to: { postal_code: cep_destino.replace(/\D/g, '') },
        products: products
      })
    });

    if (!response.ok) {
      throw new Error('Falha na API do Melhor Envio');
    }

    const data = await response.json();
    
    // Filtramos apenas Correios PAC e SEDEX para simplificar a vida do cliente
    const transportadorasPermitidas = ['PAC', 'SEDEX'];
    
    const opcoes = data
      .filter(frete => !frete.error && transportadorasPermitidas.includes(frete.name))
      .map(frete => ({
        id: frete.id,
        nome: frete.name,
        preco: parseFloat(frete.price),
        prazo: frete.delivery_time
      }))
      .sort((a, b) => a.preco - b.preco); // Mais barato primeiro

    res.status(200).json({ opcoes: opcoes.filter(o => Number.isFinite(o.preco) && o.preco >= 0).map(o => ({ ...o, cotacao: criarCotacao({ userId: auth.user.id, cep: cep_destino.replace(/\D/g, ''), carrinho: hashCarrinho(itens, precos), centavos: Math.round(o.preco * 100), servico: Number(o.id) }) })) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao calcular o frete' });
  }
}
