import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import {
  Package, Truck, CreditCard, ChevronDown, ChevronUp,
  ShoppingCart, FileDown, CheckCircle, Clock, XCircle, RefreshCw, Trash2
} from "lucide-react";
import ContagemRegressiva from "../components/ContagemRegressiva";

// --------------- Componente de Detalhes de Pagamento ---------------
function PainelPagamento({ pedido }) {
  const pago = pedido.status === 'Pago' || pedido.status === 'Em Produção' || pedido.status === 'Enviado' || pedido.status === 'Concluído';
  const aguardando = pedido.status === 'Aguardando Pagamento';

  // Gera e baixa uma "nota fiscal" / comprovante em formato de texto HTML imprimível
  function baixarComprovante() {
    const itensHtml = (pedido.itens || []).map(item =>
      `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${item.nome}${item.opcaoEscolhida ? ` (${item.opcaoEscolhida})` : ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${item.quantidade}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">R$ ${Number(item.preco).toFixed(2).replace('.', ',')}</td>
      </tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante - Pedido #${pedido.id}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 680px; margin: 40px auto; color: #111; }
    .header { border-bottom: 2px solid #c8a46e; padding-bottom: 16px; margin-bottom: 24px; }
    h1 { font-size: 22px; color: #c8a46e; margin: 0 0 4px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: bold;
             background: ${pago ? '#d1fae5' : '#fef3c7'}; color: ${pago ? '#065f46' : '#92400e'}; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { text-align: left; padding: 8px; background: #f5f5f5; font-size: 13px; }
    .total-row td { font-weight: bold; font-size: 15px; padding: 12px 8px 0; border-top: 2px solid #c8a46e; }
    .footer { margin-top: 40px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 16px; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>I.J Print — Comprovante de Pedido</h1>
    <p style="margin:0;font-size:13px;color:#555;">
      Pedido <strong>#${String(pedido.id).slice(0, 8).toUpperCase()}</strong> &nbsp;|&nbsp;
      ${new Date(pedido.created_at).toLocaleString('pt-BR')}
    </p>
  </div>

  <p><strong>Status:</strong> <span class="badge">${pedido.status}</span></p>
  <p><strong>Cliente:</strong> ${pedido.perfis?.nome || 'Não informado'}</p>
  ${pedido.endereco ? `
  <p><strong>Endereço de Entrega:</strong><br>
    ${pedido.endereco.logradouro}, ${pedido.endereco.numero}${pedido.endereco.complemento ? ', ' + pedido.endereco.complemento : ''}<br>
    ${pedido.endereco.bairro} — ${pedido.endereco.cidade} / ${pedido.endereco.uf}<br>
    CEP: ${pedido.endereco.cep}
  </p>` : ''}

  <table>
    <thead><tr>
      <th>Produto</th><th style="text-align:center;">Qtd</th><th style="text-align:right;">Preço</th>
    </tr></thead>
    <tbody>${itensHtml}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="2">Total</td>
        <td style="text-align:right;">R$ ${Number(pedido.total).toFixed(2).replace('.', ',')}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    Documento gerado em ${new Date().toLocaleString('pt-BR')} · I.J Print Impressão 3D Personalizada
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprovante-pedido-${String(pedido.id).slice(0, 8)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
        <CreditCard size={14} /> Detalhes do Pagamento
      </h3>
      <div className="bg-zinc-950 border border-zinc-800/50 rounded p-4 space-y-2 text-sm">
        {/* Status */}
        <div className="flex items-center gap-2">
          {pago
            ? <CheckCircle size={16} className="text-green-400" />
            : aguardando
              ? <Clock size={16} className="text-yellow-400" />
              : <XCircle size={16} className="text-red-400" />
          }
          <span className={`font-bold ${pago ? 'text-green-400' : aguardando ? 'text-yellow-400' : 'text-zinc-400'}`}>
            {pedido.status}
          </span>
        </div>

        {/* Valor total */}
        <div className="pt-2 border-t border-zinc-800/50 flex justify-between">
          <span className="text-zinc-400">Total do pedido</span>
          <span className="text-sand-400 font-bold">R$ {Number(pedido.total).toFixed(2).replace('.', ',')}</span>
        </div>

        {/* ID do pedido */}
        <div className="flex justify-between">
          <span className="text-zinc-400">Ref. pedido</span>
          <span className="text-zinc-200 font-mono text-xs">{String(pedido.id).slice(0, 8).toUpperCase()}</span>
        </div>

        {/* Data */}
        <div className="flex justify-between">
          <span className="text-zinc-400">Data</span>
          <span className="text-zinc-200">{new Date(pedido.created_at).toLocaleString('pt-BR')}</span>
        </div>

        {/* Link de comprovante da InfinitePay, se salvo */}
        {pedido.comprovante_url && (
          <div className="pt-2 border-t border-zinc-800/50">
            <a
              href={pedido.comprovante_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline text-xs"
            >
              Ver comprovante InfinitePay ↗
            </a>
          </div>
        )}
      </div>

      {/* Botão de download do comprovante */}
      <button
        onClick={baixarComprovante}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-bold text-xs uppercase tracking-wider rounded transition-colors"
      >
        <FileDown size={15} />
        Baixar Comprovante (PDF/HTML)
      </button>
    </div>
  );
}

// --------------- Botão Marcar Em Produção ---------------
function BotaoEmProducao({ pedido, onAtualizado }) {
  const [status, setStatus] = useState('idle'); // idle | loading | error

  if (pedido.status !== 'Pago') return null;

  async function marcarEmProducao() {
    setStatus('loading');
    try {
      const res = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: pedido.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao atualizar status');
      onAtualizado(data.pedido);
    } catch (e) {
      console.error(e);
      setStatus('error');
      alert('Erro ao marcar como Em Produção: ' + e.message);
      return;
    }
    setStatus('idle');
  }

  return (
    <button
      onClick={marcarEmProducao}
      disabled={status === 'loading'}
      className="w-full flex items-center justify-center gap-2 py-3 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-50 border border-purple-500/20 text-purple-400 font-bold text-xs uppercase tracking-wider rounded transition-colors"
    >
      {status === 'loading'
        ? <><RefreshCw size={15} className="animate-spin" /> Atualizando...</>
        : <>Marcar como Em Produção</>
      }
    </button>
  );
}

// --------------- Botão Concluído ---------------
function BotaoConcluido({ pedido, onAtualizado }) {
  const [status, setStatus] = useState('idle');

  if (pedido.status !== 'Enviado') return null;

  async function marcarConcluido() {
    setStatus('loading');
    try {
      const res = await fetch('/api/concluido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: pedido.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao atualizar status');
      onAtualizado(data.pedido);
    } catch (e) {
      console.error(e);
      setStatus('error');
      alert('Erro ao marcar como Concluído: ' + e.message);
      return;
    }
    setStatus('idle');
  }

  return (
    <button
      onClick={marcarConcluido}
      disabled={status === 'loading'}
      className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 border border-emerald-500/20 text-emerald-400 font-bold text-xs uppercase tracking-wider rounded transition-colors mt-2"
    >
      {status === 'loading'
        ? <><RefreshCw size={15} className="animate-spin" /> Atualizando...</>
        : <><CheckCircle size={15} /> Marcar como Concluído</>
      }
    </button>
  );
}

// --------------- Botão Gerar Etiqueta ---------------
function BotaoEtiqueta({ pedido, onAtualizado }) {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [trackingUrl, setTrackingUrl] = useState(null);

  async function gerarEtiqueta() {
    setStatus('loading');
    try {
      const res = await fetch('/api/etiqueta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: pedido.id, pedido })
      });
      const data = await res.json();
      if (data.tracking_url || data.success) {
        setTrackingUrl(data.tracking_url || '#');
        setStatus('success');
        // Atualiza status do pedido no Supabase
        await supabase.from('pedidos').update({ status: 'Enviado' }).eq('id', pedido.id);
        
        if (onAtualizado) {
          onAtualizado({ id: pedido.id, status: 'Enviado' });
        }
      } else {
        throw new Error(data.error || 'Falha');
      }
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-green-400 text-sm font-bold">
          <CheckCircle size={16} /> Etiqueta gerada!
        </div>
        {trackingUrl && trackingUrl !== '#' && (
          <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
            className="text-blue-400 underline text-xs">
            Rastrear envio ↗
          </a>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={gerarEtiqueta}
      disabled={status === 'loading'}
      className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-50 border border-blue-500/20 text-blue-400 font-bold text-xs uppercase tracking-wider rounded transition-colors"
    >
      {status === 'loading'
        ? <><RefreshCw size={15} className="animate-spin" /> Gerando...</>
        : <><Truck size={15} /> Gerar Etiqueta</>
      }
      {status === 'error' && <span className="text-red-400 ml-1">(Erro)</span>}
    </button>
  );
}

// --------------- Página Principal Admin ---------------
export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const isAdmin = user && user.email === 'i.j.print26@gmail.com';

  async function cancelarPedido(pedidoId) {
    const motivo = window.prompt(
      `⚠️ CANCELAR PEDIDO #${String(pedidoId).slice(0, 8).toUpperCase()}\n\nIsso irá apagar o pedido e ENVIAR UM E-MAIL de cancelamento ao cliente.\n\nDigite o MOTIVO do cancelamento (ou deixe em branco para cancelar sem motivo específico):`
    );
    
    // Se clicou em cancelar no prompt, o retorno é null
    if (motivo === null) return;

    // Coloca o botão em estado de "carregando/deletando" se precisarmos (não temos flag no momento, então apenas um alerta visual pode bastar ou um bloqueio simples)
    // Para simplificar a UI existente sem quebrar, não adicionarei flag de loading global, o fetch cuidará.

    try {
      const res = await fetch('/api/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: pedidoId, motivo: motivo.trim() })
      });
      
      const responseData = await res.json();
      
      if (!res.ok) {
        throw new Error(responseData.error || 'Erro interno ao cancelar');
      }

      alert('Pedido deletado e cliente notificado via e-mail!');
      
      // Remove da lista local imediatamente sem precisar recarregar
      setPedidos(prev => prev.filter(p => p.id !== pedidoId));
      if (expandedId === pedidoId) setExpandedId(null);
      
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      alert('Falha ao cancelar: ' + error.message);
    }
  }

  useEffect(() => {
    if (user && !isAdmin) navigate("/");
  }, [user, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;

    async function fetchPedidos() {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`*, perfis ( nome, telefone )`)
        .order('created_at', { ascending: false });
      if (data) setPedidos(data);
      if (error) console.error("Erro ao buscar pedidos:", error);
      setLoading(false);
    }
    fetchPedidos();

    // Realtime: mantém o painel sincronizado com o banco. Sem isso, se o
    // webhook marcar um pedido como "Pago" enquanto o admin está com a
    // página aberta, o estado local fica desatualizado e o cronômetro
    // (que roda em cima desse estado velho) pode acabar apagando uma
    // venda que já foi paga.
    const canal = supabase
      .channel('admin-pedidos')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos' },
        (payload) => {
          setPedidos(prev =>
            prev.map(p =>
              // Preserva o relacionamento perfis que não vem no payload do realtime
              p.id === payload.new.id ? { ...payload.new, perfis: p.perfis } : p
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'pedidos' },
        (payload) => {
          setPedidos(prev => prev.filter(p => p.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [isAdmin]);

  if (!user) return (
    <div className="pt-32 pb-16 px-4 max-w-5xl mx-auto text-center text-zinc-400">
      <p>Acesso negado. Faça login.</p>
    </div>
  );

  if (!isAdmin) return null;

  return (
    <main className="pt-24 pb-16 px-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Package size={28} className="text-sand-400" />
        <h1 className="font-display text-3xl text-white tracking-tight uppercase">Painel de Pedidos</h1>
      </div>

      {loading ? (
        <div className="text-center py-20 text-zinc-500">
          <div className="w-8 h-8 border-2 border-sand-400/20 border-t-sand-400 rounded-full animate-spin mx-auto mb-4"></div>
          Carregando pedidos...
        </div>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-20 text-zinc-500 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <Package size={32} className="mx-auto mb-3 opacity-20" />
          Nenhum pedido recebido ainda.
        </div>
      ) : (
        <div className="space-y-4">
          {pedidos.map(pedido => (
            <div key={pedido.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden transition-all duration-300">

              {/* Cabeçalho Clicável */}
              <div
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
                onClick={() => setExpandedId(expandedId === pedido.id ? null : pedido.id)}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                    {new Date(pedido.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <p className="text-zinc-100 font-medium">
                    {pedido.perfis?.nome || pedido.endereco?.cliente_nome || pedido.endereco?.cliente_email || "Cliente Desconhecido"}
                  </p>
                  <p className="text-sand-400 font-bold text-sm">R$ {Number(pedido.total).toFixed(2).replace('.', ',')}</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded border ${
                      pedido.status === 'Aguardando Pagamento' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                      pedido.status === 'Pago' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                      pedido.status === 'Em Produção' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                      pedido.status === 'Enviado' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                      pedido.status === 'Concluído' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}>
                      {pedido.status}
                    </span>
                    {pedido.status === 'Aguardando Pagamento' && (
                      <span className="text-yellow-500/80 text-[10px] font-bold uppercase">
                        <ContagemRegressiva 
                          dataCriacao={pedido.created_at} 
                          onExpirar={async () => {
                            // Antes de deletar, confirma no banco se o pedido AINDA está
                            // "Aguardando Pagamento". O filtro .eq('status', ...) garante
                            // que, se o webhook já tiver marcado como "Pago" nesse meio
                            // tempo, o delete simplesmente não afeta nenhuma linha —
                            // evitando apagar uma venda que já foi paga.
                            const { data: deletados, error } = await supabase
                              .from('pedidos')
                              .delete()
                              .eq('id', pedido.id)
                              .eq('status', 'Aguardando Pagamento')
                              .select('id');

                            if (error) {
                              console.error('Erro ao expirar pedido:', error);
                              return;
                            }

                            if (deletados && deletados.length > 0) {
                              // Realmente estava pendente e foi removido.
                              setPedidos(prev => prev.filter(p => p.id !== pedido.id));
                            } else {
                              // Não deletou nada: o status mudou antes do cronômetro
                              // zerar. Busca o pedido atualizado pra refletir na tela.
                              const { data: atualizado } = await supabase
                                .from('pedidos')
                                .select(`*, perfis ( nome, telefone )`)
                                .eq('id', pedido.id)
                                .single();
                              if (atualizado) {
                                setPedidos(prev =>
                                  prev.map(p => (p.id === pedido.id ? atualizado : p))
                                );
                              }
                            }
                          }} 
                        />
                      </span>
                    )}
                  </div>
                  {expandedId === pedido.id ? <ChevronUp size={20} className="text-zinc-500" /> : <ChevronDown size={20} className="text-zinc-500" />}
                </div>
              </div>

              {/* Área Expandida */}
              {expandedId === pedido.id && (
                <div className="border-t border-zinc-800 p-5 bg-zinc-900/30 flex flex-col md:flex-row gap-8">

                  {/* Lista de Itens */}
                  <div className="flex-1 space-y-3">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                      <ShoppingCart size={14} /> Itens do Pedido
                    </h3>
                    <ul className="space-y-2">
                      {(pedido.itens || []).map((item, idx) => (
                        <li key={idx} className="text-sm text-zinc-300 bg-zinc-950 p-3 rounded border border-zinc-800/50">
                          <span className="font-bold text-sand-400 mr-2">{item.quantidade}x</span>
                          {item.nome}
                          {item.opcaoEscolhida && <span className="text-zinc-500 ml-1">({item.opcaoEscolhida})</span>}
                          {item.exigePersonalizacao && item.personalizacao && (
                            <div className="mt-2 pt-2 border-t border-zinc-800/50">
                              <span className="text-xs text-zinc-500 block mb-0.5">Personalização:</span>
                              <span className="text-xs text-zinc-300 italic">{item.personalizacao}</span>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Endereço + Ações */}
                  <div className="flex-1 space-y-5">
                    {/* Endereço */}
                    {pedido.endereco && (
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Endereço de Entrega</h3>
                        <div className="text-sm text-zinc-300 bg-zinc-950 p-4 rounded border border-zinc-800/50 leading-relaxed">
                          <p className="font-medium text-white mb-1">{pedido.endereco.logradouro}, {pedido.endereco.numero}</p>
                          {pedido.endereco.complemento && <p className="text-zinc-400">{pedido.endereco.complemento}</p>}
                          <p className="text-zinc-400">{pedido.endereco.bairro} - {pedido.endereco.cidade} / {pedido.endereco.uf}</p>
                          <p className="text-zinc-400 mt-1">CEP: <span className="text-zinc-300 font-mono">{pedido.endereco.cep}</span></p>
                          <div className="mt-3 pt-3 border-t border-zinc-800/50 text-sand-400 font-medium">
                          WhatsApp: {pedido.perfis?.telefone || "Não informado"}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Detalhes de Pagamento */}
                    <PainelPagamento pedido={pedido} />

                    {/* Botão Em Produção (só aparece quando status === 'Pago') */}
                    <BotaoEmProducao
                      pedido={pedido}
                      onAtualizado={(atualizado) => {
                        setPedidos(prev =>
                          prev.map(p => (p.id === atualizado.id ? { ...p, ...atualizado } : p))
                        );
                      }}
                    />

                    {/* Botão Etiqueta */}
                    <BotaoEtiqueta 
                      pedido={pedido} 
                      onAtualizado={(atualizado) => {
                        setPedidos(prev =>
                          prev.map(p => (p.id === atualizado.id ? { ...p, ...atualizado } : p))
                        );
                      }}
                    />

                    {/* Botão Concluído (só aparece quando status === 'Enviado') */}
                    <BotaoConcluido
                      pedido={pedido}
                      onAtualizado={(atualizado) => {
                        setPedidos(prev =>
                          prev.map(p => (p.id === atualizado.id ? { ...p, ...atualizado } : p))
                        );
                      }}
                    />

                    {/* Botão Cancelar / Deletar Pedido */}
                    <button
                      onClick={() => cancelarPedido(pedido.id)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 mt-1 bg-red-500/8 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 font-bold text-xs uppercase tracking-wider rounded transition-colors"
                    >
                      <Trash2 size={14} />
                      Cancelar e Deletar Pedido
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
