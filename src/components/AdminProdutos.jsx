import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { apiAutenticada } from '../lib/apiAutenticada';
import { produtoAtivo } from '../lib/produtoAtivo.js';

export default function AdminProdutos() {
  const [aberto, setAberto] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  async function abrir() {
    setAberto(!aberto);
    if (aberto) return;
    setOcupado(true);
    setErro('');
    try {
      const { data, error } = await supabase.from('produtos').select('*').order('id');
      if (error) throw new Error('Não foi possível carregar os produtos.');
      setProdutos(data || []);
    } catch (e) { setErro(e.message); }
    finally { setOcupado(false); }
  }
  async function alternar(produto) {
    setOcupado(true);
    setErro('');
    try {
      const res = await apiAutenticada('/api/produto-ativo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: produto.id, ativo: !produtoAtivo(produto) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao alterar produto.');
      setProdutos(lista => lista.map(p => p.id === data.id ? { ...p, ...data } : p));
    } catch (e) { setErro(e.message); }
    finally { setOcupado(false); }
  }
  return <section className="mb-6 rounded-lg border border-zinc-800 p-4">
    <button type="button" onClick={abrir} aria-expanded={aberto} className="text-sand-400 focus-visible:outline focus-visible:outline-2">
      {aberto ? 'Fechar gestão de produtos' : 'Ativar / desativar produtos'}
    </button>
    {aberto && <div className="mt-4">
      <p className="mb-3 text-sm text-zinc-400">Produtos desativados ficam ocultos e não aceitam novas compras. Pedidos existentes são preservados.</p>
      {erro && <p role="alert" className="mb-3 text-red-400">{erro}</p>}
      {ocupado && <p role="status" className="text-sm text-zinc-400">Atualizando…</p>}
      <ul className="max-h-96 overflow-y-auto divide-y divide-zinc-800">
        {produtos.map(p => {
          const ativo = produtoAtivo(p);
          return <li key={p.id} className="flex items-center justify-between gap-3 py-3">
            <div className="text-sm text-zinc-200">#{p.id} — {p.nome}
              <p className="text-xs text-zinc-500">{ativo ? 'Ativo' : 'Desativado'}</p>
            </div>
            <button type="button" disabled={ocupado} onClick={() => alternar(p)} className="rounded border border-zinc-700 px-3 py-2 text-sm text-sand-400 disabled:opacity-40 focus-visible:outline focus-visible:outline-2">
              {ativo ? 'Desativar' : 'Ativar'}
            </button>
          </li>;
        })}
      </ul>
    </div>}
  </section>;
}
