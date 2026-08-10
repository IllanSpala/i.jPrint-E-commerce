import WebSocket from 'ws';
global.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

const updates = [
  { id: 1, dimensoes: "80x80x130", peso_gramas: 100 },
  { id: 2, dimensoes: "150x80x130", peso_gramas: 200 },
  { id: 3, dimensoes: "220x80x130", peso_gramas: 300 },
  { id: 4, dimensoes: "80x80x130", peso_gramas: 100 },
  { id: 5, dimensoes: "80x80x130", peso_gramas: 100 },
  { id: 6, dimensoes: "100x100x220", peso_gramas: 250 },
  { id: 7, dimensoes: "100x100x200", peso_gramas: 200 },
  { id: 8, dimensoes: "100x100x100", peso_gramas: 450 },
  { id: 9, dimensoes: "80x80x150", peso_gramas: 150 },
  { id: 10, dimensoes: "100x100x120", peso_gramas: 350 },
  { id: 11, dimensoes: "80x80x120", peso_gramas: 150 },
  { id: 12, dimensoes: "100x100x20", peso_gramas: 60 },
  { id: 13, dimensoes: "80x80x160", peso_gramas: 130 },
  { id: 14, dimensoes: "200x200x130", peso_gramas: 400 },
  { id: 15, dimensoes: "100x100x200", peso_gramas: 200 },
  { id: 16, dimensoes: "80x80x100", peso_gramas: 120 },
  { id: 17, dimensoes: "80x80x130", peso_gramas: 100 },
  { id: 18, dimensoes: "90x90x180", peso_gramas: 160 },
  { id: 20, dimensoes: "100x100x120", peso_gramas: 200 },
  { id: 21, dimensoes: "80x80x150", peso_gramas: 120 },
  { id: 22, dimensoes: "80x80x150", peso_gramas: 120 },
  { id: 23, dimensoes: "80x80x150", peso_gramas: 120 },
  { id: 24, dimensoes: "80x80x150", peso_gramas: 120 },
  { id: 25, dimensoes: "80x80x150", peso_gramas: 120 },
  { id: 26, dimensoes: "100x100x200", peso_gramas: 250 },
  { id: 27, dimensoes: "80x30x15", peso_gramas: 25 },
  { id: 28, dimensoes: "80x80x150", peso_gramas: 120 },
  { id: 29, dimensoes: "40x40x50", peso_gramas: 30 },
  { id: 30, dimensoes: "90x90x150", peso_gramas: 180 },
  { id: 31, dimensoes: "80x80x150", peso_gramas: 120 },
  { id: 32, dimensoes: "100x100x200", peso_gramas: 250 },
  { id: 33, dimensoes: "80x80x160", peso_gramas: 130 },
  { id: 34, dimensoes: "80x80x150", peso_gramas: 120 },
  { id: 35, dimensoes: "80x80x150", peso_gramas: 120 },
  { id: 36, dimensoes: "80x80x150", peso_gramas: 120 },
  { id: 37, dimensoes: "80x80x150", peso_gramas: 120 },
  { id: 38, dimensoes: "80x80x150", peso_gramas: 120 },
  { id: 39, dimensoes: "80x80x150", peso_gramas: 120 },
  { id: 40, dimensoes: "80x80x150", peso_gramas: 120 },
  { id: 41, dimensoes: "120x120x200", peso_gramas: 300 },
  { id: 42, dimensoes: "90x90x150", peso_gramas: 200 },
  { id: 43, dimensoes: "90x90x150", peso_gramas: 200 },
  { id: 44, dimensoes: "90x90x150", peso_gramas: 200 },
  { id: 45, dimensoes: "90x90x150", peso_gramas: 200 },
  { id: 46, dimensoes: "90x90x150", peso_gramas: 200 },
  { id: 47, dimensoes: "80x80x150", peso_gramas: 120 },
  { id: 48, dimensoes: "80x80x150", peso_gramas: 120 },
  { id: 49, dimensoes: "80x80x160", peso_gramas: 130 },
  { id: 50, dimensoes: "80x80x160", peso_gramas: 130 },
  { id: 51, dimensoes: "80x80x160", peso_gramas: 130 },
  { id: 52, dimensoes: "200x130x20", peso_gramas: 100 },
  { id: 53, dimensoes: "160x110x20", peso_gramas: 120 },
  { id: 54, dimensoes: "160x110x20", peso_gramas: 120 },
  { id: 55, dimensoes: "90x90x90", peso_gramas: 100 },
  { id: 56, dimensoes: "150x150x300", peso_gramas: 600 },
  { id: 57, dimensoes: "100x100x200", peso_gramas: 300 },
  { id: 58, dimensoes: "120x120x220", peso_gramas: 350 },
  { id: 59, dimensoes: "100x100x200", peso_gramas: 250 },
  { id: 60, dimensoes: "200x200x300", peso_gramas: 800 }
];

async function run() {
  console.log('Iniciando atualização de dimensões e pesos...');
  let updatedCount = 0;
  for (const item of updates) {
    const { error } = await supabase
      .from('produtos')
      .update({ dimensoes: item.dimensoes, peso_gramas: item.peso_gramas })
      .eq('id', item.id);
      
    if (error) {
      console.error(`Erro ao atualizar produto ID ${item.id}:`, error.message);
    } else {
      updatedCount++;
    }
  }
  console.log(`Atualização concluída! ${updatedCount} produtos atualizados com sucesso.`);
}

run();
