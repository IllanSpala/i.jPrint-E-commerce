import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
global.WebSocket = ws;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  const { data, error } = await supabase.from('pedidos').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    if (data.length > 0) {
      console.log("Columns:", Object.keys(data[0]));
    } else {
      console.log("No data, try getting options or forcing an error to see columns");
    }
  }
}

test();
