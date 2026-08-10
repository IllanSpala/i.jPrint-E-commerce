export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { cep_destino, itens } = req.body;
  const token = process.env.MELHOR_ENVIO_TOKEN;
  const cepOrigem = process.env.ORIGEM_CEP; // Adicione isso no seu .env.local depois!

  if (!token || !cepOrigem) {
    console.log("Token ou CEP de origem faltando. Retornando frete simulado.");
    return res.status(200).json({
      opcoes: [
        { id: 1, nome: 'PAC', preco: 25.50, prazo: 7 },
        { id: 2, nome: 'SEDEX', preco: 45.90, prazo: 3 }
      ]
    });
  }

  try {
    // Melhor Envio requer medidas mínimas: 1x1x1cm e peso 0.1kg. Vamos mapear nossos itens (em mm/g) para cm/kg
    const products = itens.map(item => {
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

    res.status(200).json({ opcoes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao calcular o frete' });
  }
}
