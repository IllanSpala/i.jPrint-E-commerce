import { gerarReciboSeguro } from '../lib/reciboSeguro.js';
import { apiAutenticada } from '../lib/apiAutenticada';
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import {
  Package, Truck, CreditCard, ChevronDown, ChevronUp,
  ShoppingCart, FileDown, CheckCircle, Clock, XCircle, RefreshCw, Trash2, FileText
} from "lucide-react";
import { arquivosPersonalizacao, baixarArquivoPersonalizacao } from "../lib/arquivosPersonalizacao";

// --------------- Componente de Detalhes de Pagamento ---------------
function PainelPagamento({ pedido }) {
  const pago = pedido.status === 'Pago' || pedido.status === 'Em Produção' || pedido.status === 'Enviado' || pedido.status === 'Concluído';
  const aguardando = pedido.status === 'Aguardando Pagamento';

  // Gera e baixa uma "nota fiscal" / comprovante em formato de texto HTML imprimível
  function baixarComprovante() {
    const html = gerarReciboSeguro(pedido);

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
        {/^https:\/\/(?:[a-z0-9-]+\.)?infinitepay\.io\//.test(pedido.comprovante_url || '') && (
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
      const res = await apiAutenticada('/api/status', {
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
      const res = await apiAutenticada('/api/concluido', {
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
  const [status, setStatus] = useState('idle');
  const [trackingUrl, setTrackingUrl] = useState(pedido.tracking_url || null);
  const [cartId, setCartId] = useState(pedido.melhor_envio_cart_id || null);
  const [htmlRecibo, setHtmlRecibo] = useState(null);

  const logradouro = (pedido.endereco?.logradouro || pedido.endereco?.rua || '').toLowerCase();
  const isRetirada = pedido.modo_entrega === 'retirada' || pedido.modo_entrega === 'digital';
  const jaProcessado = pedido.status === 'Enviado' || pedido.status === 'Conclu\u00eddo';

  async function confirmarEnvio() {
    if (!window.confirm('Confirma que o pedido foi realmente postado ou está pronto para retirada?')) return;
    const codigo = isRetirada ? '' : window.prompt('Informe o código de rastreio da postagem:');
    if (!isRetirada && !codigo) return;
    try {
      const response = await apiAutenticada('/api/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pedido_id: pedido.id, acao: 'enviado', codigo_rastreio: codigo }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onAtualizado?.(data.pedido);
    } catch (error) { alert(error.message); }
  }

  async function gerarEtiqueta() {
    setStatus('loading');
    try {
      const res = await apiAutenticada('/api/etiqueta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: pedido.id, pedido })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Falha');

      const newTrackingUrl = data.tracking_url || null;
      const newCartId = data.cart_id || null;
      setTrackingUrl(newTrackingUrl);
      setCartId(newCartId);
      if (data.html_recibo) setHtmlRecibo(data.html_recibo);
      setStatus('success');

      if (onAtualizado) onAtualizado({ id: pedido.id, melhor_envio_cart_id: newCartId });

    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }

  function abrirReciboInterno() {
    if (!htmlRecibo) { alert('Gere a etiqueta primeiro.'); return; }
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-modals');
    iframe.title = 'Recibo do pedido';
    iframe.style.cssText = 'position:fixed;inset:5%;width:90%;height:90%;z-index:9999;background:white';
    iframe.srcdoc = htmlRecibo;
    const fechar = document.createElement('button');
    fechar.textContent = 'Fechar recibo';
    fechar.style.cssText = 'position:fixed;top:1%;right:5%;z-index:10000;background:#fff;color:#111;padding:8px';
    fechar.onclick = () => { iframe.remove(); fechar.remove(); };
    document.body.append(iframe, fechar);
  }

  const mostrarBotoesPos = jaProcessado || status === 'success';

  if (mostrarBotoesPos) {
    // O padrão antigo (melhorenvio.com.br/envios/{uuid}) era uma URL interna que retorna 404.
    // Detectamos esse padrão para não exibi-lo como link público de rastreio.
    const isUrlAntiga = trackingUrl && /melhorenvio\.com\.br\/envios\/[a-z0-9-]+/i.test(trackingUrl);

    // URL pública de rastreio — só válida se não for o padrão antigo quebrado
    const publicTrackingUrl = (!isUrlAntiga && /^https:\/\/rastreamento\.correios\.com\.br\//.test(trackingUrl || '')) ? trackingUrl : null;

    // URL do admin no Melhor Envio — usa cartId se disponível, senão abre a lista
    const melhorEnvioAdminUrl = cartId
      ? `https://melhorenvio.com.br/envios/${cartId}`
      : 'https://melhorenvio.com.br/envios';

    return (
      <div className="space-y-2 mt-2">
        {pedido.status === 'Em Produção' && <button type="button" onClick={confirmarEnvio} className="text-sm text-sand-400 underline">Confirmar postagem / retirada pronta</button>}
        <div className="flex items-center gap-2 text-green-400 text-sm font-bold mb-1">
          <CheckCircle size={16} /> {isRetirada ? 'Recibo disponível. Confirme quando estiver pronto para retirada.' : 'Envio preparado. Confirme a postagem após despachar.'}
        </div>
        <div className="grid grid-cols-1 gap-2">
          {!isRetirada && (
            <>
              {/* Botão admin: abre o painel do Melhor Envio (exige estar logado) */}
              <a
                href="https://melhorenvio.com.br/envios"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 font-bold text-xs uppercase tracking-wider rounded transition-colors"
              >
                <Package size={14} /> Abrir Painel Melhor Envio ↗
              </a>

              {/* Botão de rastreio público — só aparece se a URL for válida (não o padrão antigo) */}
              {publicTrackingUrl ? (
                <a
                  href={publicTrackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider rounded transition-colors"
                >
                  <Truck size={14} /> Rastrear Envio (Correios) ↗
                </a>
              ) : (
                <div className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-500 text-xs rounded cursor-default">
                  <Truck size={14} /> Código de rastreio disponível após comprar a etiqueta no Melhor Envio
                </div>
              )}
            </>
          )}
          {htmlRecibo && (
            <button
              onClick={abrirReciboInterno}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider rounded transition-colors"
            >
              <FileText size={14} /> Recibo Interno (I.J Print)
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={gerarEtiqueta}
      disabled={status === 'loading'}
      className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-50 border border-blue-500/20 text-blue-400 font-bold text-xs uppercase tracking-wider rounded transition-colors mt-2"
    >
      {status === 'loading'
        ? <><RefreshCw size={15} className="animate-spin" /> Gerando...</>
        : <><Truck size={15} /> {isRetirada ? 'Gerar Recibo e Enviar Email de Retirada' : 'Gerar Etiqueta Correios + Recibo'}</>
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

  const [isAdmin, setIsAdmin] = useState(null);
  useEffect(() => {
    let ativo = true;
    setIsAdmin(null);
    supabase.rpc('sou_admin').then(({ data, error }) => { if (ativo) setIsAdmin(!error && data === true); });
    return () => { ativo = false; };
  }, [user?.id]);

  async function cancelarPedido(pedidoId) {
    const motivo = window.prompt(
      `⚠️ CANCELAR PEDIDO #${String(pedidoId).slice(0, 8).toUpperCase()}\n\nO cancelamento exige conciliação com a operadora. O pedido será preservado.\n\nDigite o MOTIVO do cancelamento (ou deixe em branco para cancelar sem motivo específico):`
    );
    
    // Se clicou em cancelar no prompt, o retorno é null
    if (motivo === null) return;

    // Coloca o botão em estado de "carregando/deletando" se precisarmos (não temos flag no momento, então apenas um alerta visual pode bastar ou um bloqueio simples)
    // Para simplificar a UI existente sem quebrar, não adicionarei flag de loading global, o fetch cuidará.

    try {
      const res = await apiAutenticada('/api/cancelar', {
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
    if (user && isAdmin === false) navigate("/");
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
                          {item.personalizacoes?.length > 0 && <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
                            <p className="text-sm font-semibold">Arquivos para produção</p>
                            <p className="text-xs text-zinc-400">SVG original do cliente, versão processada e configurações. Importe o SVG no Blender e confira as medidas antes de imprimir.</p>
                            {arquivosPersonalizacao([item]).map(arquivo => <button key={arquivo.nome} onClick={() => baixarArquivoPersonalizacao(arquivo)} className="block text-xs text-sand-300 underline break-all">Baixar {arquivo.nome}</button>)}
                          </div>}
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
                          <p className="font-medium text-white mb-1">{(pedido.endereco.logradouro || pedido.endereco.rua)}, {pedido.endereco.numero}</p>
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
