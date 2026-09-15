import { useEffect, useRef, useState } from 'react';
import './ConversorImagem.css';

export default function ConversorImagem({ onUsarSvg }) {
  const [fonte, setFonte] = useState(null), [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(''), [ocupado, setOcupado] = useState(false);
  const [config, setConfig] = useState({ removerFundo: true, tolerancia: 32, modo: 'contraste', limiar: 180, inverter: false, ruido: 4 });
  const tarefa = useRef(null), versao = useRef(0);
  function cancelar() { tarefa.current?.worker.terminate(); clearTimeout(tarefa.current?.timer); tarefa.current = null; }
  useEffect(() => () => { versao.current++; cancelar(); }, []);
  useEffect(() => () => { if (fonte) URL.revokeObjectURL(fonte.url); }, [fonte]);
  function alterar(chave, valor) { setConfig(c => ({ ...c, [chave]: valor })); setResultado(null); }

  async function carregar(file) {
    if (!file) return;
    const id = ++versao.current;
    cancelar(); setFonte(null); setResultado(null); setErro(''); setOcupado(true);
    let bitmap;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Envie uma imagem de até 8 MB.');
      const h = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const png = h[0] === 137 && h[1] === 80 && h[2] === 78 && h[3] === 71;
      const jpg = h[0] === 255 && h[1] === 216 && h[2] === 255;
      const webp = String.fromCharCode(...h.slice(0, 4)) === 'RIFF' && String.fromCharCode(...h.slice(8, 12)) === 'WEBP';
      if (!png && !jpg && !webp) throw new Error('Formatos compatíveis: PNG, JPG/JPEG e WebP.');
      bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 20_000_000) throw new Error('Reduza a imagem para até 20 megapixels antes de enviar.');
      const ratio = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * ratio)), height = Math.max(1, Math.round(bitmap.height * ratio));
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0, width, height);
      const pixels = ctx.getImageData(0, 0, width, height);
      let transparente = false;
      for (let i = 3; i < pixels.data.length; i += 4) if (pixels.data[i] < 128) { transparente = true; break; }
      if (id !== versao.current) return;
      setFonte({ url: URL.createObjectURL(file), pixels, nome: file.name, formato: png ? 'PNG' : jpg ? 'JPEG' : 'WebP' });
      setConfig(c => ({ ...c, modo: transparente ? 'silhueta' : 'contraste', removerFundo: !transparente }));
    } catch (error) { if (id === versao.current) setErro(error.message || 'Não foi possível abrir a imagem.'); }
    finally { bitmap?.close(); if (id === versao.current) setOcupado(false); }
  }

  function converter() {
    if (!fonte || ocupado) return;
    setOcupado(true); setErro(''); setResultado(null);
    try {
      const worker = new Worker(new URL('../lib/vetorizarImagem.worker.js', import.meta.url), { type: 'module' });
      const terminar = () => { cancelar(); setOcupado(false); };
      worker.onmessage = ({ data }) => { terminar(); if (data.error) setErro(data.error); else setResultado(data); };
      worker.onerror = () => { terminar(); setErro('Falha na conversão. Tente outra imagem ou use o conversor externo.'); };
      const timer = setTimeout(() => { terminar(); setErro('A imagem demorou demais para converter. Use uma imagem mais simples.'); }, 15_000);
      tarefa.current = { worker, timer };
      const data = fonte.pixels.data.slice();
      worker.postMessage({ data, width: fonte.pixels.width, height: fonte.pixels.height, ...config }, [data.buffer]);
    } catch (error) { cancelar(); setOcupado(false); setErro(error.message); }
  }

  return <section className="conversor-imagem rounded-xl border border-sand-400/40 bg-zinc-900 p-5 space-y-4">
    <h3 className="font-semibold text-white">Converter imagem aqui no site</h3>
    <p className="text-sm text-zinc-400">PNG, JPG/JPEG ou WebP · até 8 MB e 20 megapixels. A conversão usa até 1024 px no maior lado e é feita no seu navegador, sem enviar a imagem a um serviço externo.</p>
    <label className={`conversor-upload ${ocupado ? 'is-disabled' : ''}`}>
      <span className="conversor-upload-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m-4 4 4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg></span>
      <span className="min-w-0"><strong className="block text-sm">{ocupado ? 'Processando imagem…' : fonte ? 'Trocar imagem' : 'Selecionar imagem'}</strong><span className="block text-xs text-zinc-400 mt-1 break-all">{fonte ? fonte.nome : 'PNG, JPG ou WebP · até 8 MB'}</span></span>
      <span className="conversor-upload-action" aria-hidden="true">Procurar</span>
      <input aria-label="Selecionar imagem para converter" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="sr-only" disabled={ocupado} onChange={e => { carregar(e.target.files?.[0]); e.target.value = ''; }}/>
    </label>
    {fonte && <>
      <fieldset disabled={ocupado} className="grid sm:grid-cols-2 gap-4 text-sm disabled:opacity-60">
        <label className="flex items-center gap-2"><input type="checkbox" checked={config.removerFundo} onChange={e => alterar('removerFundo', e.target.checked)}/>Remover fundo uniforme</label>
        <label>Modo<select value={config.modo} onChange={e => alterar('modo', e.target.value)} className="mt-1 block w-full rounded bg-zinc-950 p-2"><option value="contraste">Contraste: desenho escuro ou claro</option><option value="silhueta">Silhueta: todas as cores restantes</option></select></label>
        <label>Tolerância do fundo: {config.tolerancia}<input type="range" min="0" max="100" value={config.tolerancia} disabled={!config.removerFundo} onChange={e => alterar('tolerancia', Number(e.target.value))} className="block w-full accent-sand-400"/></label>
        <label>Contraste: {config.limiar}<input type="range" min="0" max="255" value={config.limiar} disabled={config.modo !== 'contraste'} onChange={e => alterar('limiar', Number(e.target.value))} className="block w-full accent-sand-400"/></label>
        <label className="flex items-center gap-2"><input type="checkbox" disabled={config.modo !== 'contraste'} checked={config.inverter} onChange={e => alterar('inverter', e.target.checked)}/>Desenho claro em fundo escuro</label>
        <label>Limpeza de pequenos detalhes<select value={config.ruido} onChange={e => alterar('ruido', Number(e.target.value))} className="mt-1 block w-full rounded bg-zinc-950 p-2"><option value="0">Preservar todos</option><option value="4">Leve</option><option value="16">Média</option><option value="64">Forte</option></select></label>
      </fieldset>
      <p className="text-xs text-zinc-400">A remoção estima a cor predominante nas bordas; não reconhece pessoas ou objetos. Se partes da arte sumirem, diminua a tolerância ou desative a remoção. No modo contraste, áreas claras podem virar furos.</p>
      <button type="button" disabled={ocupado} onClick={converter} className="rounded border border-sand-400 px-4 py-2 text-sm text-sand-300 disabled:opacity-50">{ocupado ? 'Convertendo…' : 'Gerar prévia SVG'}</button>
      <div className="grid grid-cols-2 gap-3">
        <figure><img src={fonte.url} alt="Imagem original" className="w-full h-40 object-contain rounded bg-zinc-200"/><figcaption className="mt-1 text-xs text-zinc-400">Imagem original</figcaption></figure>
        <figure>{resultado ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(resultado.svg)}`} alt="Prévia do SVG convertido, desenho preto sobre fundo claro" className="w-full h-40 object-contain rounded bg-zinc-200"/> : <div className="h-40 rounded bg-zinc-950 grid place-items-center text-xs text-zinc-500 text-center px-3">Gere a prévia após ajustar os controles.</div>}<figcaption className="mt-1 text-xs text-zinc-400">Vetor de uma cor · confira furos e detalhes</figcaption></figure>
      </div>
      {resultado && <button type="button" onClick={() => onUsarSvg(resultado.svg, fonte.nome.replace(/\.[^.]+$/, '') + '.svg', { nomeOriginal: fonte.nome, formatoOriginal: fonte.formato, conversor: 'contornos-monocromaticos-v1', width: resultado.width, height: resultado.height, ...config })} className="rounded bg-sand-400 px-4 py-3 text-sm font-bold text-zinc-950">Aprovar SVG e abrir editor 3D</button>}
    </>}
    {ocupado && !fonte && <p role="status" className="text-sm text-zinc-400">Abrindo imagem…</p>}
    {erro && <p role="alert" className="text-sm text-red-400">{erro}</p>}
  </section>;
}
