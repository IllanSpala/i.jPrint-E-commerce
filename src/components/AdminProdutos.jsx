import { carregarProntaEntrega } from '../lib/estadoProntaEntrega.js';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { apiAutenticada } from '../lib/apiAutenticada';
import { produtoAtivo } from '../lib/produtoAtivo.js';

export default function AdminProdutos() {
  const [aberto, setAberto] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState('catalogo');
  async function abrir() {
    setAberto(!aberto);
    if (aberto) return;
    setOcupado(true);
    setErro('');
    try {
      const { data, error } = await supabase.from('produtos').select('*').order('id');
      if (error) throw new Error('Não foi possível carregar os produtos.');
      const prontas = await carregarProntaEntrega(supabase);
      setProdutos([...(prontas.data || []).filter(produtoAtivo).map(p => ({ ...p, configuracaoPendente: prontas.configuracaoPendente })), ...(data || [])]);
      if (prontas.error || prontas.configuracaoPendente) setErro('Pronta entrega indisponível. Aplique pronta_entrega_ativos.sql no banco para gerenciar essas peças.');
    } catch (e) { setErro(e.message); }
    finally { setOcupado(false); }
  }
  async function alternar(produto) {
    setOcupado(true);
    setErro('');
    try {
      const res = await apiAutenticada('/api/produto-ativo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: produto.id, ativo: produto.prontaEntrega ? produto.esgotado : !produtoAtivo(produto) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao alterar produto.');
      setProdutos(lista => lista.map(p => p.id === data.id ? { ...p, ...data } : p));
    } catch (e) { setErro(e.message); }
    finally { setOcupado(false); }
  }
  const produtosDaAba = produtos.filter(p => aba === 'pronta' ? p.prontaEntrega : !p.prontaEntrega);
  return <section className="mb-6 rounded-lg border border-zinc-800 p-4">
    <button type="button" onClick={abrir} aria-expanded={aberto} className="text-sand-400 focus-visible:outline focus-visible:outline-2">
      {aberto ? 'Fechar gestão de produtos' : 'Ativar / desativar produtos'}
    </button>
    {aberto && <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 sm:p-4">
      <p className="mb-3 text-sm text-zinc-400">Produtos desativados ficam ocultos e não aceitam novas compras. Pedidos existentes são preservados.</p>
      {erro && <p role="alert" className="mb-3 text-red-400">{erro}</p>}
      {ocupado && <p role="status" className="text-sm text-zinc-400">Atualizando…</p>}
      <div className="mb-4 flex gap-2 border-b border-zinc-800 pb-3" role="tablist" aria-label="Tipo de produto">
        {[
          ['catalogo', 'Catálogo'],
          ['pronta', 'Pronta entrega'],
        ].map(([id, nome]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={`rounded border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${aba === id ? 'border-sand-400 bg-sand-400/10 text-sand-300' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'}`}
          >
            {nome}
          </button>
        ))}
      </div>
      <div className="max-h-[32rem] overflow-y-auto pr-1">
        {produtosDaAba.length === 0 && <p className="py-8 text-center text-sm text-zinc-500">Nenhum item encontrado.</p>}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {produtosDaAba.map(p => {
          const ativo = produtoAtivo(p);
          const disponivel = p.prontaEntrega ? !p.esgotado : ativo;
          return <li key={p.id} className="flex min-h-52 flex-col overflow-hidden rounded border border-zinc-800 bg-zinc-900">
            <div className="relative aspect-square bg-zinc-950">
              {p.imagem ? <img src={p.imagem} alt="" className={`h-full w-full ${p.prontaEntrega ? 'object-contain' : 'object-cover'}`} /> : <div className="flex h-full items-center justify-center text-xs text-zinc-600">Sem imagem</div>}
              <span className={`absolute left-2 top-2 rounded px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider ${disponivel ? 'bg-emerald-950/90 text-emerald-300' : 'bg-zinc-950/90 text-zinc-400'}`}>
                {p.prontaEntrega ? (disponivel ? 'Disponível' : 'Esgotado') : (ativo ? 'Ativo' : 'Desativado')}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <div className="text-xs font-semibold leading-snug text-zinc-200">{p.nome}</div>
              <div className="mt-auto text-[10px] text-zinc-500">#{p.id}</div>
              <button type="button" disabled={ocupado || p.configuracaoPendente} onClick={() => alternar(p)} className="w-full rounded border border-zinc-700 px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-sand-400 transition-colors hover:border-sand-400 disabled:opacity-40 focus-visible:outline focus-visible:outline-2">
              {p.prontaEntrega ? (disponivel ? 'Remover do estoque' : 'Repor no estoque') : (ativo ? 'Desativar' : 'Ativar')}
              </button>
            </div>
          </li>;
        })}
        </ul>
      </div>
    </div>}
  </section>;
}
