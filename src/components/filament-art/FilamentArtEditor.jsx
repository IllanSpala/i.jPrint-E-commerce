import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, FileUp, Info, LockKeyhole, Move, Rotate3D, X } from 'lucide-react';
import ModeloStl from '../ModeloStl';
import ViewportPersonalizacao from '../ViewportPersonalizacao';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { apiAutenticada } from '../../lib/apiAutenticada';
import { A1 } from '../../lib/filament-art/opticalModel.js';
import { loadImage } from '../../lib/filament-art/imagePipeline.js';
import { imagePalette, preparePreviewSource, previewCanvas, serializePreviewRaster, validateImagePreview } from '../../lib/filament-art/previewColors.js';
import { BUCKET } from '../../lib/filament-art/projectSerializer.js';



const SHAPES = [['square', 'Quadrado'], ['circle', 'Círculo']];
const CAMERA_INICIAL = { x: -20, y: -42 };

export default function FilamentArtEditor({ onClose, onConfirm }) {
  const { user } = useAuth();
  const [etapa, setEtapa] = useState('guia');
  const [shape, setShape] = useState('square');
  const [source, setSource] = useState(null);
  const [palette, setPalette] = useState(['#ffffff']);
  const [sourcePalette,setSourcePalette] = useState(['#ffffff']);
  const [imageScale,setImageScale] = useState(100);
  const [imageRotation,setImageRotation] = useState(0);
  const [posicao,setPosicao] = useState({x:0,y:0});
  const [ferramenta,setFerramenta] = useState('rotacionar');
  const escalaValida = Number.isFinite(imageScale) && imageScale > 0;
  const [background, setBackground] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [review, setReview] = useState(false);
  const [pov, setPov] = useState(CAMERA_INICIAL);
  const [panCamera, setPanCamera] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const capturaRef = useRef(null);
  const originalRef = useRef(null);
  const request = useRef(0);
  const dialog = useRef(null);
  const preparedSource = useMemo(() => source ? preparePreviewSource(source.canvas, sourcePalette, palette, background) : null, [source, sourcePalette, palette, background]);
  const texture = useMemo(() => source ? previewCanvas(source.canvas, palette, shape, palette[background], {preparedSource,imageScale:escalaValida ? imageScale : 100,imageRotation,position:posicao}) : null, [source, palette, shape, background, preparedSource, imageScale, escalaValida, imageRotation, posicao]);
  const guidePreview = useMemo(() => etapa === 'guia' && texture ? texture.toDataURL('image/png') : null, [etapa, texture]);
  function enterEditor() { setEtapa('editor'); }
  useEffect(() => { setApplied(false); }, [texture]);
  useEffect(() => {
    const previous = document.activeElement, old = document.body.style.overflow;
    dialog.current?.focus(); document.body.style.overflow = 'hidden';
    return () => { request.current++; document.body.style.overflow = old; previous?.focus(); };
  }, []);

  async function choose(file) {
    if (!file) return;
    const id = ++request.current;
    setLoading(true); setError('');
    try {
      const image = await loadImage(file);
      if (id !== request.current) return;
      const pixels = image.canvas.getContext('2d').getImageData(0, 0, image.canvas.width, image.canvas.height);
      const extracted = imagePalette(pixels.data); setSourcePalette(extracted); setPalette(extracted); setImageScale(100); setImageRotation(0); setPosicao({x:0,y:0}); setBackground(0); setSource(image);
      setApplied(false); setPov(CAMERA_INICIAL); setPanCamera({ x: 0, y: 0 }); setZoom(1);
    } catch (e) { if (id === request.current) setError(e.message || 'Não foi possível carregar a imagem.'); }
    finally { if (id === request.current) setLoading(false); }
  }

  async function confirm(reviewConfirmed = false) {
    if (!source || !texture || !escalaValida) return;
    if (!applied) {
      try { capturaRef.current(); setApplied(true); setError(''); } catch (e) { setError(e.message); }
      return;
    }
    if (!reviewConfirmed) { setReview(true); return; }
    setReview(false);
    if (!user) { setError('Entre na sua conta para guardar a configuração.'); return; }
    setBusy(true); setError('');
    try {
      const previewImagem = capturaRef.current();
      const plan = { ...A1, shape };
      const pixels = texture.getContext('2d').getImageData(0, 0, texture.width, texture.height);
      const raster = serializePreviewRaster(pixels, palette, palette[background]);
      const input = { mode: 'image-preview', plan, shape, palette, background: palette[background], raster, imageScale, imageRotation, position:posicao, sourcePalette };
      validateImagePreview(input);
      let path = originalRef.current?.file === source.file && originalRef.current?.userId === user.id ? originalRef.current.path : null;
      if (!path) {
        const authorization = await apiAutenticada('/api/filament-art', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prepare-original', size: source.file.size, type: source.metadata.type }) });
        const authorized = await authorization.json().catch(() => { throw new Error('O serviço de salvamento não está disponível. Tente novamente em instantes.'); });
        if (!authorization.ok) throw new Error(authorized.error || 'Não foi possível autorizar o envio da imagem.');
        const upload = await supabase.storage.from(BUCKET).uploadToSignedUrl(authorized.path, authorized.token, source.file, { contentType: source.metadata.type });
        if (upload.error) throw new Error('O envio da foto não foi concluído. Verifique sua conexão e tente novamente; sua prévia foi mantida.');
        path = authorized.path;
        originalRef.current = { file: source.file, userId: user.id, path };
      }
      const response = await apiAutenticada('/api/filament-art', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', input, originalPath: path, originalName: source.file.name }) });
      const saved = await response.json().catch(() => { throw new Error('A foto foi enviada, mas o serviço não respondeu corretamente. Tente concluir novamente.'); });
      if (!response.ok) throw new Error(saved.error || 'Não foi possível guardar a configuração.');
      onConfirm({ ...saved, shape, shapeLabel: SHAPES.find(([id]) => id === shape)[1], colors: palette, previewUrl: previewImagem, plan, status: 'Prévia aprovada' });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  const upload = <label className="min-h-36 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-sand-400/60 bg-zinc-900/60 flex flex-col items-center justify-center cursor-pointer px-5 py-6 text-center">
    <FileUp className="text-sand-400 mb-3" size={28}/><strong className="text-sm">{loading ? 'Carregando imagem…' : source ? 'Trocar imagem' : 'Carregar imagem'}</strong>
    <span className="text-xs text-zinc-500 mt-1">PNG, JPEG ou WebP · até 8 MB</span>
    <input disabled={loading || busy} aria-label="Carregar imagem HueForge" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="sr-only" onChange={e => { choose(e.target.files?.[0]); e.target.value = ''; }}/>
  </label>;
  const shapes = <fieldset><legend className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Formato da peça</legend><div className="grid grid-cols-2 gap-2">{SHAPES.map(([id, label]) => <button type="button" aria-pressed={shape === id} key={id} onClick={() => setShape(id)} className={`rounded-lg border px-2 py-3 text-xs ${shape === id ? 'border-sand-400 bg-sand-400 text-zinc-950' : 'border-zinc-700 text-zinc-300'}`}>{label}</button>)}</div></fieldset>;

  return <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Personalizador 3D HueForge" className={`fixed inset-0 z-[80] bg-zinc-950 text-zinc-100 ${etapa === 'guia' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
    {etapa === 'guia' ? <div className="max-w-5xl mx-auto px-5 py-8 md:py-12">
      <div className="flex justify-between items-start gap-5 mb-8"><div><span className="text-sand-400 text-xs font-bold uppercase tracking-[.2em]">Antes de personalizar</span><h2 className="font-display text-3xl md:text-5xl uppercase mt-2">Prepare sua arte</h2><p className="text-zinc-400 mt-3 max-w-2xl">Sua imagem sobre uma peça 3D, com até quatro cores. Escolha o formato e confira a prévia.</p></div><button onClick={onClose} className="p-2 rounded-lg border border-zinc-800" aria-label="Fechar"><X size={20}/></button></div>
      <section aria-labelledby="hueforge-photo-guide" className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 id="hueforge-photo-guide" className="font-semibold text-sand-300 mb-3">Que tipo de imagem funciona bem?</h3>
        <div className="grid md:grid-cols-2 gap-5 text-sm text-zinc-300">
          <div><h4 className="font-semibold text-white mb-2">Prefira</h4><ul className="list-disc pl-5 space-y-1"><li>Desenhos, logos, ilustrações e artes vetoriais com cores sólidas.</li><li>Até quatro cores, contornos bem definidos e bom contraste.</li><li>Fundo simples, imagem nítida e detalhes grandes.</li></ul></div>
          <div><h4 className="font-semibold text-white mb-2">Evite</h4><ul className="list-disc pl-5 space-y-1"><li>Fotos com muitas cores ou fundos muito detalhados.</li><li>Muitas sombras, degradês, reflexos e iluminação irregular.</li><li>Imagens borradas, textos pequenos e traços muito finos.</li></ul></div>
        </div>
        <p className="mt-4 text-sm text-zinc-400">Fotos complexas não reproduzem bem neste formato: tons parecidos serão unidos para respeitar o limite de quatro cores. Artes em SVG funcionam bem como origem; exporte para PNG em boa resolução antes de enviar. O envio aceita PNG, JPEG e WebP.</p>
        <p className="mt-3 text-xs text-sand-300">Sua foto original será guardada com o pedido para prepararmos o HueForge.</p>
      </section>
      <div className="grid md:grid-cols-2 gap-6"><section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-5">{shapes}{upload}{source && <p className="text-xs text-zinc-400">{source.file.name} · {source.canvas.width} × {source.canvas.height} px · {palette.length} cores</p>}{error && <p role="alert" className="text-sm text-red-400">{error}</p>}<button disabled={!source || loading} onClick={enterEditor} className="w-full rounded-lg bg-sand-400 py-3 font-bold text-zinc-950 disabled:opacity-40">Personalizar em 3D <ChevronRight className="inline" size={16}/></button></section>
      <div className="min-h-80 rounded-2xl bg-[#17191d] flex items-center justify-center p-6">{texture ? <img alt="Prévia da imagem em até quatro cores" src={guidePreview} className={`max-h-80 max-w-full object-contain ${shape === 'circle' ? 'rounded-full' : ''}`}/> : <p className="text-sm text-zinc-500">Carregue uma imagem para conferir o formato.</p>}</div></div>
    </div> : <div className="h-[100dvh] min-h-0 flex flex-col">
      <header className="h-16 shrink-0 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 md:px-6"><div><strong className="text-sm">Editor de personalização</strong><span className="hidden sm:inline text-xs text-zinc-500 ml-3">{source.file.name} · {palette.length} cores</span></div><div className="flex gap-2"><button disabled={busy} onClick={() => setEtapa('guia')} className="px-3 py-2 rounded-lg border border-zinc-700 text-xs text-zinc-300">Trocar imagem</button><button disabled={busy || !escalaValida} onClick={() => confirm()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sand-400 text-zinc-950 text-xs font-bold uppercase tracking-wider disabled:opacity-50">{busy ? 'Guardando…' : applied ? 'Concluído' : 'Aplicar'}<ChevronRight size={15}/></button><button disabled={busy} onClick={onClose} aria-label="Fechar" className="p-2 text-zinc-400"><X size={18}/></button></div></header>
      {error && <p role="alert" className="px-5 py-2 text-sm text-red-400">{error}</p>}
      <div className="flex-1 grid grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-1 md:grid-cols-[320px_minmax(0,1fr)] min-h-0">
        <aside className="personalizador-controles order-2 md:order-1 min-h-0 border-t md:border-t-0 md:border-r border-zinc-800 bg-zinc-900 p-3 space-y-3 overflow-y-auto overscroll-contain">
          <div className="flex items-center gap-2 text-xs text-zinc-400"><LockKeyhole size={14} className="text-sand-400"/> Objeto centralizado e bloqueado</div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Ferramenta do mouse</p>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                  <button onClick={() => setFerramenta("rotacionar")} className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors ${ferramenta === "rotacionar" ? "bg-sand-400 text-zinc-950" : "text-zinc-400 hover:text-white"}`}><Rotate3D size={14}/> Rotacionar</button>
                  <button onClick={() => setFerramenta("mover")} className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors ${ferramenta === "mover" ? "bg-sand-400 text-zinc-950" : "text-zinc-400 hover:text-white"}`}><Move size={14}/> Mover imagem</button>
                </div>
              </div>
          {shapes}
          <fieldset><legend className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Cores da imagem · máximo 4</legend><div className="flex gap-3">{palette.map((color,index)=><label key={index} className="text-xs text-zinc-400">Cor {index+1}<input type="color" aria-label={`Cor ${index+1}`} value={color} onChange={e=>setPalette(list=>list.map((v,i)=>i===index?e.target.value:v))} className="mt-2 block h-9 w-12 cursor-pointer bg-transparent"/></label>)}</div><button onClick={()=>setPalette([...sourcePalette])} className="mt-3 text-xs text-sand-300 underline">Restaurar cores da imagem</button><p className="mt-2 text-xs text-zinc-500">Ajuste apenas se desejar. A escolha dos filamentos será feita pela loja.</p></fieldset>
          <label className="block text-xs text-zinc-400">Cor do fundo<select aria-label="Cor do fundo" value={background} onChange={e => setBackground(Number(e.target.value))} className="mt-2 block w-full rounded border border-zinc-700 bg-zinc-950 p-2">{palette.map((color, index) => <option key={index} value={index}>Cor {index + 1} · {color}</option>)}</select></label>

              <div>
                <label htmlFor="escala-imagem" className="flex justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3"><span>Tamanho da imagem</span><span>{imageScale}%</span></label>
                <input id="escala-imagem" type="number" inputMode="decimal" step="any" value={imageScale} aria-invalid={!escalaValida} onChange={(e) => setImageScale(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"/>
                <p className="mt-2 text-xs text-zinc-400">Sem limite máximo de tamanho. O excesso é recortado nos limites da peça.</p>
                <p role="status" className={`mt-2 text-xs ${applied ? "text-emerald-400" : "text-sand-300"}`}>{applied ? "Imagem aplicada à superfície. Pronto para concluir." : "Ajuste a arte e clique em Aplicar para conferir o recorte."}</p>
              </div>
              <div className="space-y-3">
                <label htmlFor="angulo-imagem" className="flex justify-between text-sm text-zinc-300"><span>Rotacionar imagem</span><output>{imageRotation}°</output></label>
                <p className="text-xs text-zinc-400">Gire à esquerda ou à direita, mantendo a arte sobre a superfície.</p>
                <div className="flex gap-2">
                  <button type="button" aria-label="Girar imagem 5 graus à esquerda" onClick={() => setImageRotation(a => Math.max(-180, a - 5))} className="flex-1 rounded border border-zinc-700 py-2 text-sm">↶ Esquerda</button>
                  <button type="button" aria-label="Girar imagem 5 graus à direita" onClick={() => setImageRotation(a => Math.min(180, a + 5))} className="flex-1 rounded border border-zinc-700 py-2 text-sm">Direita ↷</button>
                </div>
                <input id="angulo-imagem" type="range" min="-180" max="180" step="1" value={imageRotation} onChange={e => setImageRotation(Number(e.target.value))} className="w-full accent-sand-400" />
                <div aria-hidden="true" className="h-3 border-b border-zinc-600" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #71717a 0 1px, transparent 1px 12.5%)' }} />
                <div className="flex justify-between text-xs text-zinc-400"><span>−180°</span><span>−90°</span><span>0°</span><span>90°</span><span>180°</span></div>
                <button type="button" onClick={() => setImageRotation(0)} className="text-xs text-sand-300 underline">Alinhar em 0°</button>
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
                  <button type="button" onClick={() => { setPanCamera({ x: 0, y: 0 }); setZoom(1); setPov(CAMERA_INICIAL); }} className="text-xs text-sand-300 underline">Centralizar câmera</button>
                </div>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-500 leading-relaxed"><Info size={14} className="inline mr-2 text-sand-400"/>Shift + arrastar ou botão do meio: deslocar câmera. Arrastar: {ferramenta === "rotacionar" ? "orbitar câmera." : "mover imagem."}</div>
          <p role="status" className="text-xs text-sand-300">{applied ? 'Imagem aplicada. Pronto para concluir.' : 'Confira a imagem e clique em Aplicar.'}</p>
        </aside>
        <ViewportPersonalizacao ferramenta={ferramenta} posicao={posicao} setPosicao={setPosicao} pov={pov} setPov={setPov} panCamera={panCamera} setPanCamera={setPanCamera}>
          <div className="absolute inset-0 bg-[#17191d]"><ModeloStl placa={shape} imagemCanvas={texture} corObjeto={palette[background]} povX={pov.x} povY={pov.y} zoom={zoom} panCamera={panCamera} capturaRef={capturaRef} onErro={setError}/></div>
        </ViewportPersonalizacao>
      </div>
    </div>}
    {review && <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/75 p-5">
      <section role="alertdialog" aria-modal="true" aria-labelledby="hueforge-preview-notice" aria-describedby="hueforge-preview-description" className="w-full max-w-md rounded-2xl border border-sand-400/40 bg-zinc-900 p-6 shadow-2xl">
        <h2 id="hueforge-preview-notice" className="text-lg font-semibold text-sand-300">Esta é uma pré-visualização</h2>
        <p id="hueforge-preview-description" className="mt-3 text-sm leading-relaxed text-zinc-300">As cores exibidas são uma referência e estão sujeitas a mudanças na preparação do HueForge e na impressão. O resultado final pode apresentar diferenças de tonalidade em relação à tela.</p>
        <p className="mt-3 text-sm text-zinc-400">Sua imagem original será enviada junto às configurações para prepararmos o arquivo de impressão.</p>
        <div className="mt-6 flex gap-3"><button autoFocus onClick={() => setReview(false)} className="flex-1 rounded-lg border border-zinc-700 px-3 py-3 text-sm">Voltar à prévia</button><button onClick={() => confirm(true)} className="flex-1 rounded-lg bg-sand-400 px-3 py-3 text-sm font-bold text-zinc-950">Entendi, finalizar</button></div>
      </section>
    </div>}
  </div>;
}
