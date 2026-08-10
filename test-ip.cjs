const crypto = require('crypto');

async function run() {
  const pedido_id = crypto.randomUUID();
  const body = {
    handle: "illan-souza",
    order_nsu: pedido_id.toString(),
    redirect_url: `https://www.ijprint26.com/pedido-confirmado?pedido_id=${pedido_id}`,
    webhook_url: "https://www.ijprint26.com/api/webhook",
    customer: {
      name: "Jose Francisco Macedo",
      email: "jose@example.com"
    },
    items: [
      {
        quantity: 1,
        price: Math.round(149.90 * 100),
        description: "Estatueta Worms-TD Granada Santa"
      },
      {
        quantity: 1,
        price: Math.round(26.57 * 100),
        description: "Frete / Entrega"
      }
    ]
  };

  const response = await fetch('https://api.checkout.infinitepay.io/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Response:", text);
}

run();
