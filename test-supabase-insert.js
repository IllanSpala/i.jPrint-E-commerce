import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Polyfill WebSocket
import ws from 'ws';
global.WebSocket = ws;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  const pedido_id = crypto.randomUUID();
  const novoPedido = {
    id: pedido_id,
    user_id: "00000000-0000-0000-0000-000000000000",
    cliente_nome: "Teste",
    cliente_email: "teste@teste.com",
    endereco: { rua: "X" },
    itens: [],
    total: 100,
    status: 'Aguardando Pagamento'
  };

  const { error: insertError } = await supabase.from('pedidos').insert(novoPedido);
  console.log("Insert Error:", insertError);
}

test();
