import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, FileUp, Info, LockKeyhole, Move, Rotate3D, X } from "lucide-react";
import ModeloStl from "./ModeloStl";
import ViewportPersonalizacao from "./ViewportPersonalizacao";
import ConversorImagem from "./ConversorImagem";

import { supabase } from '../lib/supabase';

function corNome(valor, cores) {
  return cores.find(cor => cor.valor === valor)?.nome || valor;
}

function limparSvg(texto) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(texto, "image/svg+xml");
  if (doc.querySelector("parsererror") || doc.documentElement.tagName.toLowerCase() !== "svg") {
    throw new Error("O arquivo não contém um SVG válido.");
  }

  doc.querySelectorAll("script, foreignObject, iframe, image, metadata, title, desc").forEach((el) => el.remove());
  doc.querySelectorAll("rect").forEach((rect) => {
    const fill = (rect.getAttribute("fill") || "").toLowerCase();
    const pareceFundo = rect.parentElement === doc.documentElement && (/100%/.test(rect.getAttribute("width") || "") || /100%/.test(rect.getAttribute("height") || ""));
    if (pareceFundo || ["#fff", "#ffffff", "white", "rgb(255,255,255)"].includes(fill)) rect.remove();
  });
  doc.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (/^on/i.test(attr.name) || /(?:javascript:|https?:)/i.test(attr.value)) el.removeAttribute(attr.name);
    });
  });

  const svg = doc.documentElement;
  if (!svg.getAttribute("viewBox")) {
    const width = parseFloat(svg.getAttribute("width")) || 100;
    const height = parseFloat(svg.getAttribute("height")) || 100;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.querySelectorAll("path, circle, ellipse, polygon, polyline, line, text, g").forEach((el) => {
    if (el.getAttribute("fill") && el.getAttribute("fill") !== "none") el.setAttribute("fill", "currentColor");
    if (!el.getAttribute("fill") && !el.getAttribute("stroke") && el.tagName.toLowerCase() !== "g") el.setAttribute("fill", "currentColor");
    if (el.getAttribute("stroke") && el.getAttribute("stroke") !== "none") el.setAttribute("stroke", "currentColor");
  });
  return new XMLSerializer().serializeToString(svg).replace(/>\s+</g, "><").trim();
}

function SeletorCor({ titulo, valor, onChange, cores }) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">{titulo}: <span className="text-zinc-200">{corNome(valor, cores)}</span></legend>
      <div className="flex flex-wrap gap-2">
        {cores.map((cor) => (
          <label key={cor.id} className="relative cursor-pointer" title={cor.nome}>
            <input className="peer sr-only" type="radio" name={titulo} aria-label={cor.nome} value={cor.valor} checked={valor === cor.valor} onChange={() => onChange(cor.valor)} />
            <span style={{ backgroundColor: cor.valor }} className="block w-8 h-8 rounded-full border-2 border-zinc-700 ring-offset-2 ring-offset-zinc-900 peer-checked:ring-2 peer-checked:ring-sand-400 peer-checked:border-white" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PreviewPersonalizacao({ personalizacao, compact = false, modelo3d, capturaRef, aplicarRef, onErro, aplicacaoSvg }) {
  if (compact && personalizacao.previewImagem) return <img src={personalizacao.previewImagem} alt="Peça personalizada vista de frente, mostrando o topo e a gravura" className="w-full aspect-square object-contain bg-[#17191d]" />;
  return (
    <div className={`relative overflow-hidden bg-[#17191d] ${compact ? "h-32" : "h-full min-h-0"}`}>
      {!compact && modelo3d ? <ModeloStl arquivo={modelo3d} capturaRef={capturaRef} aplicarRef={aplicarRef} onErro={onErro} {...personalizacao} /> : <><div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(#71717a 1px, transparent 1px), linear-gradient(90deg, #71717a 1px, transparent 1px)", backgroundSize: compact ? "18px 18px" : "34px 34px", transform: "perspective(500px) rotateX(62deg) scale(1.45)", transformOrigin: "center 76%" }} />
      <div className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2">
        <div className={`${compact ? "w-24 h-16" : "w-64 h-40 md:w-80 md:h-48"} relative rounded-[48%_48%_36%_36%/30%_30%_55%_55%] shadow-[inset_-28px_-18px_45px_rgba(0,0,0,.35),0_30px_45px_rgba(0,0,0,.45)] border border-white/10`} style={{ backgroundColor: personalizacao.corObjeto, transform: `perspective(800px) rotateX(${personalizacao.povX || -5}deg) rotateY(${personalizacao.povY || -10}deg)` }}>
          <div className="absolute inset-x-[12%] top-[-8%] h-[25%] rounded-[50%] bg-zinc-950 border-4 border-white/10" />
          <div className="absolute inset-x-[16%] top-[22%] bottom-[12%] flex items-center justify-center overflow-hidden" style={{ color: personalizacao.corGravura }}>
            <img alt="Prévia da personalização" style={{ width: `${personalizacao.escala || 45}%`, transform: `translate(${personalizacao.x || 0}px, ${personalizacao.y || 0}px)` }} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(personalizacao.svg)}`} />
          </div>
        </div>
      </div>
      </>}
    </div>
  );
}

export default function Personalizador3D({ aberto, onFechar, onConcluir, modelo3d, aplicacaoSvg }) {
  const [etapa, setEtapa] = useState("guia");
  const [svg, setSvg] = useState("");
  const [svgOriginal, setSvgOriginal] = useState("");
  const [origemImagem, setOrigemImagem] = useState(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [erro, setErro] = useState("");
  const [processando, setProcessando] = useState(false);
  const [cores, setCores] = useState([]);
  const [erroCores, setErroCores] = useState('');
  const [carregandoCores, setCarregandoCores] = useState(true);
  const [recarregarCores, setRecarregarCores] = useState(0);
  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    setCarregandoCores(true);
    setErroCores('');
    (async () => {
      try {
        const {data,error} = await supabase.from('filament_art_profiles').select('id,profile,in_stock').eq('in_stock',true).order('id');
        if (error) throw error;
        if (!ativo) return;
        const disponiveis = (data || []).filter(row=>/^#[0-9a-f]{6}$/i.test(row.profile?.hex)).map(row=>({id:row.id,nome:row.profile.name,valor:row.profile.hex.toLowerCase()}));
        setCores(disponiveis);
        if (!disponiveis.length) setErroCores('Nenhuma cor disponível no momento.');
        else {
          setCorObjeto(atual=>disponiveis.some(c=>c.valor===atual)?atual:disponiveis[0].valor);
          setCorGravura(atual=>disponiveis.some(c=>c.valor===atual)?atual:(disponiveis[1] || disponiveis[0]).valor);
        }
      } catch { if(ativo) {setCores([]);setErroCores('Não foi possível carregar as cores da loja.');} }
      finally {if(ativo) setCarregandoCores(false);}
    })();
    return ()=>{ativo=false;};
  }, [aberto,recarregarCores]);
  const [corObjeto, setCorObjeto] = useState("#3b82f6");
  const [corGravura, setCorGravura] = useState("#eab308");
  const [escala, setEscala] = useState(46);
  const [anguloSvg, setAnguloSvg] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [panCamera, setPanCamera] = useState({ x: 0, y: 0 });
  const [posicao, setPosicao] = useState({ x: 0, y: 0 });
  const cameraInicial = aplicacaoSvg?.tipo === "corpo" ? { x: 35, y: 48 } : { x: -55, y: -42 };
  const [pov, setPov] = useState(cameraInicial);
  const [ferramenta, setFerramenta] = useState("rotacionar");
  const capturaRef = useRef(null);
  const aplicarRef = useRef(null);
  const [aplicacao, setAplicacao] = useState(null);
  const [aplicando, setAplicando] = useState(false);
  const escalaValida = Number.isFinite(Number(escala)) && Number(escala) > 0;
  useEffect(() => { setAplicacao(null); }, [svg, escala, anguloSvg, posicao.x, posicao.y, aberto]);
  async function aplicar() {
    setErro("");
    setAplicando(true);
    try {
      if (!escalaValida) throw new Error("Informe um tamanho maior que zero.");
      // Permite pintar o estado ocupado antes do recorte geométrico.
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
      if (!aplicarRef.current) throw new Error("Aguarde o carregamento do modelo antes de aplicar.");
      const resultado = await aplicarRef.current();
      setAplicacao(resultado);
    } catch (error) {
      setErro(error.message || "Não foi possível aplicar o SVG na superfície.");
    } finally { setAplicando(false); }
  }
  function concluir() {
    try {
      if (modelo3d && !aplicacao) throw new Error("Aplique o SVG na superfície antes de concluir.");
      if (modelo3d && !capturaRef.current) throw new Error("Aguarde o carregamento do modelo antes de concluir.");
      const previewImagem = modelo3d ? capturaRef.current() : undefined;
      setErro("");
      onConcluir({ ...configuracao, svgOriginal, origemImagem, previewImagem, modelo3d, aplicacaoSvg, aplicacaoSuperficie: aplicacao, superficie: aplicacaoSvg?.eixo || "+Z" });
    } catch (error) {
      setErro(error.message || "Não foi possível gerar a prévia. Tente novamente.");
    }
  }

  useEffect(() => {
    if (!aberto) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => event.key === "Escape" && onFechar();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", onKey);
    };
  }, [aberto, onFechar]);

  const configuracao = useMemo(() => ({ svg, corObjeto, corGravura, escala, anguloSvg, zoom, x: posicao.x, y: posicao.y, povX: pov.x, povY: pov.y, nomeArquivo, corObjetoNome: corNome(corObjeto, cores), corGravuraNome: corNome(corGravura, cores) }), [svg, corObjeto, corGravura, escala, anguloSvg, zoom, posicao, pov, nomeArquivo, cores]);

  function usarSvg(texto, nome, origem = null) {
    try {
      const otimizado = limparSvg(texto);
      setSvg(otimizado);
      setSvgOriginal(texto);
      setOrigemImagem(origem);
      setPosicao({ x: 0, y: 0 });
      setPanCamera({ x: 0, y: 0 });
      setZoom(1);
      setAnguloSvg(0);
      setPov(cameraInicial);
      setNomeArquivo(nome);
      setErro("");
      setEtapa("editor");
    } catch (error) { setErro(error.message || "Não foi possível preparar o SVG."); }
  }

  async function lerArquivo(file) {
    setErro("");
    if (!file || (!file.name.toLowerCase().endsWith(".svg") && file.type !== "image/svg+xml")) {
      setErro("Selecione um arquivo .svg.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErro("O SVG deve ter no máximo 2 MB.");
      return;
    }
    setProcessando(true);
    try {
      const texto = await file.text();
      usarSvg(texto, file.name);
    } catch (e) {
      setErro(e.message || "Não foi possível processar o SVG.");
    } finally {
      setProcessando(false);
    }
  }

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-zinc-950 text-zinc-100" role="dialog" aria-modal="true" aria-label="Personalizador 3D">
      {etapa === "guia" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-sm p-3 sm:p-6">
          <section onKeyDown={event => {
            if (event.key !== 'Tab') return;
            const items = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, a[href]')].filter(el => el.getClientRects().length);
            const first = items[0], last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }} role="dialog" aria-modal="true" aria-labelledby="svg-setup-title" className="w-full max-w-6xl max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl border border-zinc-700/70 bg-zinc-900 shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-5 sm:px-6">
              <div><p className="text-xs text-sand-300 mb-1">Personalização</p><h2 id="svg-setup-title" className="text-xl font-semibold">Escolha seu desenho</h2><p className="mt-2 text-sm text-zinc-400">Envie uma imagem, confira a gravura e personalize seu produto.</p></div>
              <button autoFocus onClick={onFechar} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white focus-visible:outline focus-visible:outline-sand-400" aria-label="Fechar configuração"><X size={20}/></button>
            </header>
            <div className="grid items-start gap-5 p-5 sm:p-6 md:grid-cols-[minmax(0,1.6fr)_minmax(240px,0.8fr)]">
              <div className="min-w-0"><ConversorImagem onUsarSvg={usarSvg}/></div>
              <div className="min-w-0 space-y-4">
              <h3 className="text-sm font-medium text-zinc-300">Já tem uma arte pronta?</h3>
              <label className="relative flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-zinc-600 p-5 transition-colors hover:border-sand-400 hover:bg-zinc-800/50 focus-within:ring-2 focus-within:ring-sand-400">
                <FileUp size={24} className="shrink-0 text-sand-300"/>
                <span><strong className="block text-sm font-medium">{processando ? "Preparando arquivo…" : "Enviar arquivo SVG"}</strong><span className="mt-1 block text-xs text-zinc-400">Arquivo vetorial · até 2 MB</span></span>
                <input aria-label="Carregar SVG pronto" disabled={processando} type="file" accept=".svg,image/svg+xml" className="sr-only" onChange={event=>{lerArquivo(event.target.files?.[0]);event.target.value='';}}/>
              </label>
              {erro && <p role="alert" className="text-sm text-red-400">{erro}</p>}
              <p className="text-xs leading-relaxed text-zinc-400">Prefira desenhos simples, traços largos e bom contraste. Fotos e degradês perdem detalhes na gravura de uma cor.</p>
              <p className="text-xs leading-relaxed text-zinc-400">Depois do envio, ajuste tamanho, posição e cores no grid.</p>
              <p className="text-xs text-zinc-500">O SVG aprovado e seus ajustes serão enviados com o pedido.</p>
              </div>

            </div>
            {svg && <footer className="border-t border-zinc-800 px-5 py-4 sm:px-6"><button onClick={()=>{setErro('');setEtapa('editor');}} className="text-sm text-sand-300 hover:text-sand-200">Voltar à edição atual</button></footer>}
          </section>
        </div>
      )}
      <div inert={etapa === "guia" ? "" : undefined} aria-hidden={etapa === "guia" ? true : undefined}>
        <div className="h-[100dvh] min-h-0 flex flex-col">
          <header className="h-16 shrink-0 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 md:px-6">
            <div><strong className="text-sm">Editor de personalização</strong><span className="hidden sm:inline text-xs text-zinc-500 ml-3">{nomeArquivo} · {origemImagem ? "convertido de imagem" : "SVG preparado"}</span></div>
            <div className="flex gap-2">
              <button onClick={() => setEtapa("guia")} className="px-3 py-2 rounded-lg border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800">Trocar SVG</button>
              <button disabled={aplicando || !escalaValida || carregandoCores || !cores.length} onClick={aplicacao || !modelo3d ? concluir : aplicar} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sand-400 text-zinc-950 text-xs font-bold uppercase tracking-wider hover:bg-sand-300 disabled:opacity-50">{aplicando ? "Aplicando…" : aplicacao || !modelo3d ? "Concluído" : "Aplicar"} <ChevronRight size={15}/></button>
            </div>
          </header>
          {erro && <p role="alert" className="px-5 py-2 text-sm text-red-400">{erro}</p>}
          <div className="flex-1 grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-1 md:grid-cols-[320px_minmax(0,1fr)] min-h-0">
            <aside className="personalizador-controles order-2 md:order-1 min-h-0 border-t md:border-t-0 md:border-r border-zinc-800 bg-zinc-900 p-3 space-y-3 overflow-y-auto overscroll-contain">
              <div className="flex items-center gap-2 text-xs text-zinc-400"><LockKeyhole size={14} className="text-sand-400"/> Objeto centralizado e bloqueado</div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Ferramenta do mouse</p>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                  <button onClick={() => setFerramenta("rotacionar")} className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors ${ferramenta === "rotacionar" ? "bg-sand-400 text-zinc-950" : "text-zinc-400 hover:text-white"}`}><Rotate3D size={14}/> Rotacionar</button>
                  <button onClick={() => setFerramenta("mover")} className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors ${ferramenta === "mover" ? "bg-sand-400 text-zinc-950" : "text-zinc-400 hover:text-white"}`}><Move size={14}/> Mover SVG</button>
                </div>
              </div>
              {carregandoCores && <p role="status" className="text-xs text-zinc-400">Carregando cores disponíveis…</p>}
              {erroCores && <p role="alert" className="text-xs text-red-300">{erroCores} <button onClick={()=>setRecarregarCores(v=>v+1)} className="underline">Tentar novamente</button></p>}
              <SeletorCor titulo="Cor do objeto" valor={corObjeto} onChange={setCorObjeto} cores={cores}/>
              <SeletorCor titulo="Cor da gravura" valor={corGravura} onChange={setCorGravura} cores={cores}/>
              <div>
                <label htmlFor="escala-svg" className="flex justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3"><span>Tamanho do SVG</span><span>{escala}%</span></label>
                <input id="escala-svg" type="number" inputMode="decimal" step="any" value={escala} aria-invalid={!escalaValida} onChange={(e) => setEscala(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"/>
                <p className="mt-2 text-xs text-zinc-400">Sem limite máximo de tamanho. Em Aplicar, o excesso é recortado nos limites da superfície; nas laterais, a arte acompanha a curvatura.</p>
                <p role="status" className={`mt-2 text-xs ${aplicacao ? "text-emerald-400" : "text-sand-300"}`}>{aplicacao ? "SVG aplicado e preso à superfície. Pronto para concluir." : "Ajuste a arte e clique em Aplicar para conferir o recorte."}</p>
              </div>
              <div className="space-y-3">
                <label htmlFor="angulo-svg" className="flex justify-between text-sm text-zinc-300"><span>Rotacionar SVG</span><output>{anguloSvg}°</output></label>
                <p className="text-xs text-zinc-400">Gire à esquerda ou à direita, mantendo a arte sobre a superfície.</p>
                <div className="flex gap-2">
                  <button type="button" aria-label="Girar SVG 5 graus à esquerda" onClick={() => setAnguloSvg(a => Math.max(-180, a - 5))} className="flex-1 rounded border border-zinc-700 py-2 text-sm">↶ Esquerda</button>
                  <button type="button" aria-label="Girar SVG 5 graus à direita" onClick={() => setAnguloSvg(a => Math.min(180, a + 5))} className="flex-1 rounded border border-zinc-700 py-2 text-sm">Direita ↷</button>
                </div>
                <input id="angulo-svg" type="range" min="-180" max="180" step="1" value={anguloSvg} onChange={e => setAnguloSvg(Number(e.target.value))} className="w-full accent-sand-400" />
                <div aria-hidden="true" className="h-3 border-b border-zinc-600" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #71717a 0 1px, transparent 1px 12.5%)' }} />
                <div className="flex justify-between text-xs text-zinc-400"><span>−180°</span><span>−90°</span><span>0°</span><span>90°</span><span>180°</span></div>
                <button type="button" onClick={() => setAnguloSvg(0)} className="text-xs text-sand-300 underline">Alinhar em 0°</button>
              </div>
              <div className="space-y-3">
                <span className="text-sm text-zinc-300">Zoom da visualização</span>
                <div className="flex items-center justify-between gap-2">
                  <button type="button" aria-label="Diminuir zoom" disabled={zoom <= 0.6} onClick={() => setZoom(z => Math.max(0.6, +(z - 0.1).toFixed(1)))} className="rounded border border-zinc-700 px-4 py-2 disabled:opacity-40">−</button>
                  <output className="text-sm">{Math.round(zoom * 100)}%</output>
                  <button type="button" aria-label="Aumentar zoom" disabled={zoom >= 2} onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))} className="rounded border border-zinc-700 px-4 py-2 disabled:opacity-40">+</button>
                </div>
                <div className="flex justify-between gap-2">
                  <button type="button" onClick={() => setZoom(1)} className="text-xs text-sand-300 underline">Restaurar zoom</button>
                  <button type="button" onClick={() => { setPanCamera({ x: 0, y: 0 }); setZoom(1); setPov(cameraInicial); }} className="text-xs text-sand-300 underline">Centralizar câmera</button>
                </div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-500 leading-relaxed"><Info size={14} className="inline mr-2 text-sand-400"/>Shift + arrastar ou botão do meio: deslocar câmera. Arrastar: {ferramenta === "rotacionar" ? "orbitar câmera." : "mover SVG."}</div>
            </aside>
            <ViewportPersonalizacao ferramenta={ferramenta} panCamera={panCamera} setPanCamera={setPanCamera} pov={pov} setPov={setPov} posicao={posicao} setPosicao={setPosicao} modelo3d={modelo3d}>
              <PreviewPersonalizacao personalizacao={{...configuracao, aplicacaoSvg, panCamera}} modelo3d={modelo3d} capturaRef={capturaRef} aplicarRef={aplicarRef} onErro={setErro}/>
            </ViewportPersonalizacao>
          </div>
        </div>
      </div>
    </div>
  );
}
