import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, FileUp, Info, LockKeyhole, Move, Rotate3D, X, ZoomIn } from "lucide-react";
import ModeloStl from "./ModeloStl";

const CORES = [
  { nome: "Vermelho", valor: "#ef4444" },
  { nome: "Laranja", valor: "#f97316" },
  { nome: "Amarelo", valor: "#eab308" },
  { nome: "Verde", valor: "#22c55e" },
  { nome: "Azul", valor: "#3b82f6" },
  { nome: "Anil", valor: "#4f46e5" },
  { nome: "Violeta", valor: "#a855f7" },
];

function corNome(valor) {
  return CORES.find((cor) => cor.valor === valor)?.nome || valor;
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

function ExemploSvg({ bom }) {
  return (
    <div className={`rounded-xl border p-4 ${bom ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
      <div className="h-28 rounded-lg bg-zinc-950 flex items-center justify-center overflow-hidden mb-3">
        {bom ? (
          <svg viewBox="0 0 120 90" className="w-24 h-20 text-emerald-400" aria-hidden="true">
            <path fill="currentColor" d="M60 8 73 35h30L79 52l10 30-29-18-29 18 10-30-24-17h30z" />
          </svg>
        ) : (
          <svg viewBox="0 0 120 90" className="w-24 h-20" aria-hidden="true">
            <defs><linearGradient id="ruim"><stop stopColor="#f43f5e"/><stop offset="1" stopColor="#60a5fa"/></linearGradient></defs>
            <rect x="8" y="8" width="104" height="74" rx="3" fill="white" />
            <path fill="url(#ruim)" stroke="#18181b" strokeWidth=".5" d="M60 11 66 39h34L70 48l4 30-14-21-14 21 4-30-30-9h34z" />
          </svg>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={`grid place-items-center w-5 h-5 rounded-full ${bom ? "bg-emerald-500 text-zinc-950" : "bg-red-500 text-white"}`}>{bom ? <Check size={13}/> : <X size={13}/>}</span>
        <strong className="text-sm text-zinc-100">{bom ? "Ideal para imprimir" : "Evite este formato"}</strong>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed mt-2">
        {bom ? "Formas fechadas, traços espessos, uma cor sólida e sem fundo." : "Fundo branco, degradês, detalhes muito finos e cores sobrepostas."}
      </p>
    </div>
  );
}

function SeletorCor({ titulo, valor, onChange }) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">{titulo}</legend>
      <div className="flex flex-wrap gap-2">
        {CORES.map((cor) => (
          <label key={cor.valor} className="relative cursor-pointer" title={cor.nome}>
            <input className="peer sr-only" type="radio" name={titulo} value={cor.valor} checked={valor === cor.valor} onChange={() => onChange(cor.valor)} />
            <span style={{ backgroundColor: cor.valor }} className="block w-8 h-8 rounded-full border-2 border-zinc-700 ring-offset-2 ring-offset-zinc-900 peer-checked:ring-2 peer-checked:ring-sand-400 peer-checked:border-white" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PreviewPersonalizacao({ personalizacao, compact = false, modelo3d, capturaRef, aplicacaoSvg }) {
  if (compact && personalizacao.previewImagem) return <img src={personalizacao.previewImagem} alt="Peça personalizada vista de frente, mostrando o topo e a gravura" className="w-full aspect-square object-contain bg-[#17191d]" />;
  return (
    <div className={`relative overflow-hidden bg-[#17191d] ${compact ? "h-32" : "h-full min-h-0"}`}>
      {!compact && modelo3d ? <ModeloStl arquivo={modelo3d} capturaRef={capturaRef} {...personalizacao} /> : <><div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(#71717a 1px, transparent 1px), linear-gradient(90deg, #71717a 1px, transparent 1px)", backgroundSize: compact ? "18px 18px" : "34px 34px", transform: "perspective(500px) rotateX(62deg) scale(1.45)", transformOrigin: "center 76%" }} />
      <div className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2">
        <div className={`${compact ? "w-24 h-16" : "w-64 h-40 md:w-80 md:h-48"} relative rounded-[48%_48%_36%_36%/30%_30%_55%_55%] shadow-[inset_-28px_-18px_45px_rgba(0,0,0,.35),0_30px_45px_rgba(0,0,0,.45)] border border-white/10`} style={{ backgroundColor: personalizacao.corObjeto, transform: `perspective(800px) rotateX(${personalizacao.povX || -5}deg) rotateY(${personalizacao.povY || -10}deg)` }}>
          <div className="absolute inset-x-[12%] top-[-8%] h-[25%] rounded-[50%] bg-zinc-950 border-4 border-white/10" />
          <div className="absolute inset-x-[16%] top-[22%] bottom-[12%] flex items-center justify-center overflow-hidden" style={{ color: personalizacao.corGravura }}>
            <div style={{ width: `${personalizacao.escala || 45}%`, transform: `translate(${personalizacao.x || 0}px, ${personalizacao.y || 0}px)` }} dangerouslySetInnerHTML={{ __html: personalizacao.svg }} />
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
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [erro, setErro] = useState("");
  const [processando, setProcessando] = useState(false);
  const [corObjeto, setCorObjeto] = useState("#3b82f6");
  const [corGravura, setCorGravura] = useState("#eab308");
  const [escala, setEscala] = useState(46);
  const [anguloSvg, setAnguloSvg] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [posicao, setPosicao] = useState({ x: 0, y: 0 });
  const [pov, setPov] = useState(aplicacaoSvg?.camera || { x: -5, y: -10 });
  const [ferramenta, setFerramenta] = useState("rotacionar");
  const drag = useRef(null);
  const capturaRef = useRef(null);
  function concluir() {
    try {
      if (modelo3d && !capturaRef.current) throw new Error("Aguarde o carregamento do modelo antes de concluir.");
      const previewImagem = modelo3d ? capturaRef.current() : undefined;
      setErro("");
      onConcluir({ ...configuracao, svgOriginal, previewImagem, modelo3d, aplicacaoSvg, superficie: aplicacaoSvg?.eixo || "+Z" });
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

  const configuracao = useMemo(() => ({ svg, corObjeto, corGravura, escala, anguloSvg, zoom, x: posicao.x, y: posicao.y, povX: pov.x, povY: pov.y, nomeArquivo, corObjetoNome: corNome(corObjeto), corGravuraNome: corNome(corGravura) }), [svg, corObjeto, corGravura, escala, anguloSvg, zoom, posicao, pov, nomeArquivo]);

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
      const otimizado = limparSvg(texto);
      await new Promise((resolve) => setTimeout(resolve, 550));
      setSvg(otimizado);
      setSvgOriginal(texto);
      setPosicao({ x: 0, y: 0 });
      setAnguloSvg(0);
      setPov(aplicacaoSvg?.camera || { x: -5, y: -10 });
      setNomeArquivo(file.name);
      setEtapa("editor");
    } catch (e) {
      setErro(e.message || "Não foi possível processar o SVG.");
    } finally {
      setProcessando(false);
    }
  }

  if (!aberto) return null;

  return (
    <div className={`fixed inset-0 z-[80] bg-zinc-950 text-zinc-100 ${etapa === "guia" ? "overflow-y-auto" : "overflow-hidden"}`} role="dialog" aria-modal="true" aria-label="Personalizador 3D">
      {etapa === "guia" ? (
        <div className="max-w-5xl mx-auto px-5 py-8 md:py-12">
          <div className="flex justify-between items-start gap-5 mb-8">
            <div>
              <span className="text-sand-400 text-xs font-bold uppercase tracking-[.2em]">Antes de personalizar</span>
              <h2 className="font-display text-3xl md:text-5xl uppercase mt-2">Prepare seu SVG</h2>
              <p className="text-zinc-400 mt-3 max-w-2xl leading-relaxed">Seu desenho será transformado em uma gravação em relevo. Arquivos simples produzem bordas mais limpas e uma impressão mais resistente.</p>
            </div>
            <button onClick={onFechar} className="p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white" aria-label="Fechar"><X size={20}/></button>
          </div>

          <div className="grid md:grid-cols-[1fr_1.1fr] gap-6">
            <section className="md:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-300">
              <h3 className="font-semibold text-white mb-3">Só tem uma imagem PNG? Transforme em SVG</h3>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Escolha um desenho simples, com bom contraste e poucos detalhes.</li>
                <li>Abra o <a href="https://convertio.co/pt/png-svg/" target="_blank" rel="noopener noreferrer" className="text-sand-300 underline">conversor PNG para SVG do Convertio</a> e selecione sua imagem.</li>
                <li>Escolha SVG como saída, converta e baixe o arquivo. O serviço oferece conversões básicas gratuitas, sujeitas aos limites do site.</li>
                <li>Volte aqui, carregue o SVG e confira o desenho no topo da peça antes de concluir.</li>
              </ol>
              <p className="mt-3 text-zinc-400">Prefira vetores com formas e caminhos; uma foto apenas embutida em um SVG não vira uma gravura. Seu arquivo e as configurações serão guardados com o pedido para preparação da impressão.</p>
            </section>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:p-6">
              <h3 className="font-semibold text-lg mb-5">O que funciona melhor</h3>
              <div className="space-y-5">
                {[
                  ["Espessura", "Use traços com no mínimo 1,2 mm para não desaparecerem na impressão."],
                  ["Cores", "Prefira uma única cor sólida. Degradês e transparências serão convertidos."],
                  ["Profundidade", "Detalhes serão aplicados como relevo de 0,8 mm na superfície da peça."],
                  ["Fundo", "O fundo branco e elementos externos serão removidos automaticamente."],
                ].map(([titulo, texto], index) => (
                  <div key={titulo} className="flex gap-3">
                    <span className="shrink-0 grid place-items-center w-7 h-7 rounded-full bg-sand-400 text-zinc-950 text-xs font-bold">{index + 1}</span>
                    <div><strong className="text-sm text-zinc-100">{titulo}</strong><p className="text-sm text-zinc-400 mt-1 leading-relaxed">{texto}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <ExemploSvg bom />
              <ExemploSvg />
              <label className="sm:col-span-2 min-h-36 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-sand-400/60 bg-zinc-900/60 flex flex-col items-center justify-center cursor-pointer transition-colors px-5 text-center">
                <FileUp className="text-sand-400 mb-3" size={28}/>
                <strong className="text-sm">{processando ? "Removendo fundo e otimizando..." : "Carregar arquivo SVG"}</strong>
                <span className="text-xs text-zinc-500 mt-1">Somente .svg, até 2 MB</span>
                <input disabled={processando} type="file" accept=".svg,image/svg+xml" className="sr-only" onChange={(event) => lerArquivo(event.target.files?.[0])}/>
              </label>
              {erro && <p className="sm:col-span-2 text-sm text-red-400" role="alert">{erro}</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="h-[100dvh] min-h-0 flex flex-col">
          <header className="h-16 shrink-0 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 md:px-6">
            <div><strong className="text-sm">Editor de personalização</strong><span className="hidden sm:inline text-xs text-zinc-500 ml-3">{nomeArquivo} · fundo removido · otimizado</span></div>
            <div className="flex gap-2">
              <button onClick={() => setEtapa("guia")} className="px-3 py-2 rounded-lg border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800">Trocar SVG</button>
              <button onClick={concluir} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sand-400 text-zinc-950 text-xs font-bold uppercase tracking-wider hover:bg-sand-300">Concluído <ChevronRight size={15}/></button>
            </div>
          </header>
          {erro && <p role="alert" className="px-5 py-2 text-sm text-red-400">{erro}</p>}
          <div className="flex-1 grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-1 md:grid-cols-[320px_minmax(0,1fr)] min-h-0">
            <aside className="personalizador-controles order-2 md:order-1 min-h-0 border-t md:border-t-0 md:border-r border-zinc-800 bg-zinc-900 p-3 space-y-3 overflow-y-auto md:overflow-hidden">
              <div className="flex items-center gap-2 text-xs text-zinc-400"><LockKeyhole size={14} className="text-sand-400"/> Objeto centralizado e bloqueado</div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Ferramenta do mouse</p>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                  <button onClick={() => setFerramenta("rotacionar")} className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors ${ferramenta === "rotacionar" ? "bg-sand-400 text-zinc-950" : "text-zinc-400 hover:text-white"}`}><Rotate3D size={14}/> Rotacionar</button>
                  <button onClick={() => setFerramenta("mover")} className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors ${ferramenta === "mover" ? "bg-sand-400 text-zinc-950" : "text-zinc-400 hover:text-white"}`}><Move size={14}/> Mover SVG</button>
                </div>
              </div>
              <SeletorCor titulo="Cor do objeto" valor={corObjeto} onChange={setCorObjeto}/>
              <SeletorCor titulo="Cor da gravura" valor={corGravura} onChange={setCorGravura}/>
              <div>
                <label htmlFor="escala-svg" className="flex justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3"><span>Tamanho do SVG</span><span>{escala}%</span></label>
                <input id="escala-svg" type="range" min="20" max="80" value={escala} onChange={(e) => setEscala(Number(e.target.value))} className="w-full accent-sand-400"/>
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
                <button type="button" onClick={() => setZoom(1)} className="text-xs text-sand-300 underline">Restaurar zoom</button>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-500 leading-relaxed"><Info size={14} className="inline mr-2 text-sand-400"/>{ferramenta === "rotacionar" ? "Arraste em qualquer ponto da área para girar a peça." : "Arraste sobre a peça para posicionar a gravura."}</div>
            </aside>
            <main className={`order-1 md:order-2 relative min-h-0 min-w-0 overflow-hidden select-none touch-none ${ferramenta === "rotacionar" ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
              onPointerDown={(event) => {
                if (ferramenta !== "rotacionar") return;
                drag.current = { tipo: "rotacionar", clientX: event.clientX, clientY: event.clientY, x: pov.x, y: pov.y };
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (!drag.current) return;
                if (drag.current.tipo === "rotacionar") {
                  setPov({ x: Math.max(-75, Math.min(75, drag.current.x - (event.clientY - drag.current.clientY) * .45)), y: drag.current.y + (event.clientX - drag.current.clientX) * .55 });
                } else {
                  setPosicao({ x: drag.current.x + event.clientX - drag.current.clientX, y: drag.current.y + event.clientY - drag.current.clientY });
                }
              }}
              onPointerUp={(event) => { drag.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId); }}>
              <PreviewPersonalizacao personalizacao={{...configuracao, aplicacaoSvg}} modelo3d={modelo3d} capturaRef={capturaRef}/>
              {modelo3d && <div className="absolute right-4 top-28 w-[120px] grid grid-cols-3 gap-2" onPointerDown={(event) => event.stopPropagation()}>
                {[["X", 35, 48], ["Y", 35, 138], ["Z", -55, -42]].map(([eixo, px, py]) => <button key={eixo} aria-label={`Vista ${eixo}`} className="rounded bg-zinc-900 border border-zinc-700 py-2 text-sm text-zinc-200" onClick={() => setPov({ x: px, y: py })}>{eixo}</button>)}
              </div>}
              <button aria-label="Arrastar gravura" className={`absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 w-52 h-28 md:w-64 md:h-32 cursor-move ${ferramenta === "mover" ? "pointer-events-auto" : "pointer-events-none"}`} onPointerDown={(event) => { event.stopPropagation(); drag.current = { tipo: "mover", clientX: event.clientX, clientY: event.clientY, ...posicao }; event.currentTarget.parentElement.setPointerCapture?.(event.pointerId); }}/>
              <div className="absolute left-4 bottom-4 flex gap-2 text-[11px] text-zinc-400"><span className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-950/80">{ferramenta === "rotacionar" ? <Rotate3D size={12}/> : <Move size={12}/>} Arrastar para {ferramenta === "rotacionar" ? "girar" : "mover"}</span><span className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-950/80"><ZoomIn size={12}/> Controle lateral</span></div>
              {!modelo3d && <div className="absolute right-6 top-7 w-24 h-28 flex flex-col items-center pointer-events-none">
                <div className="relative w-14 h-14" style={{ perspective: "220px" }}>
                  <div className="absolute inset-0 transition-transform duration-100" style={{ transform: `rotateX(${-pov.x}deg) rotateY(${-pov.y}deg)`, transformStyle: "preserve-3d" }}>
                    {[
                      ["Z", "translateZ(28px)", "bg-sand-400/90 text-zinc-950"],
                      ["Z", "rotateY(180deg) translateZ(28px)", "bg-zinc-700/90 text-zinc-200"],
                      ["X", "rotateY(90deg) translateZ(28px)", "bg-red-500/90 text-white"],
                      ["X", "rotateY(-90deg) translateZ(28px)", "bg-red-900/90 text-red-100"],
                      ["Y", "rotateX(90deg) translateZ(28px)", "bg-emerald-500/90 text-zinc-950"],
                      ["Y", "rotateX(-90deg) translateZ(28px)", "bg-emerald-900/90 text-emerald-100"],
                    ].map(([eixo, transform, cores], index) => <div key={index} className={`absolute inset-0 grid place-items-center border border-white/25 text-xs font-black ${cores}`} style={{ transform, backfaceVisibility: "hidden" }}>{eixo}</div>)}
                  </div>
                </div>
                <span className="mt-5 text-[10px] tracking-widest text-zinc-500">X · Y · Z</span>
              </div>}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
