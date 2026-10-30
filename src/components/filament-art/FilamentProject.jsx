import { useEffect, useRef, useState } from 'react';
import { apiAutenticada } from '../../lib/apiAutenticada';
import { virtualPalette } from '../../lib/filament-art/opticalModel.js';
import { download } from '../../lib/filament-art/exporters.js';
export default function FilamentProject({ reference, admin = false }) {
  const [loaded,setLoaded]=useState(null),[error,setError]=useState('');
  const [downloading,setDownloading]=useState(false);
  const canvas=useRef(null);
  async function downloadOriginal() {
    setDownloading(true); setError('');
    try {
      // Renova o link no clique: o painel pode ficar aberto por mais de cinco minutos.
      const response = await apiAutenticada('/api/filament-art', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'load',id:reference.id})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível recuperar a imagem original.');
      const original = await fetch(data.originalUrl);
      if (!original.ok) throw new Error('Não foi possível baixar a imagem original. Tente novamente.');
      const blob = await original.blob();
      const extension = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[blob.type] || 'png';
      download(blob, data.originalFile?.name || `${reference.id}-original.${extension}`, data.originalFile?.type || blob.type);
      setLoaded(data);
    } catch (e) { setError(e.message); } finally { setDownloading(false); }
  }
  useEffect(()=>{
    let active=true;setLoaded(null);setError('');
    apiAutenticada('/api/filament-art',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'load',id:reference.id})})
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);return data;})
      .then(data=>{if(active)setLoaded(data);}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[reference.id]);
  useEffect(()=>{
    if(!loaded || !canvas.current)return;
    const {input,map,order}=loaded.project;
    try {
      if (input.mode === 'image-preview') {
        const palette = input.palette.map(hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)));
        const pixels = new Uint8ClampedArray(input.raster.indices.length * 4);
        input.raster.indices.forEach((index,i) => pixels.set([...palette[index],255],i*4));
        canvas.current.width = input.raster.width; canvas.current.height = input.raster.height;
        canvas.current.getContext('2d').putImageData(new ImageData(pixels,input.raster.width,input.raster.height),0,0);
        canvas.current.style.borderRadius = input.shape === 'circle' ? '50%' : '0';
        return;
      }
      const palette=virtualPalette(input.plan,input.profiles,order),pixels=new Uint8ClampedArray(map.length*4);
      map.forEach((k,i)=>pixels.set([...palette[k].rgb,255],i*4));
      canvas.current.width=input.raster.width;canvas.current.height=input.raster.height;
      canvas.current.getContext('2d').putImageData(new ImageData(pixels,input.raster.width,input.raster.height),0,0);
    } catch {setError('Não foi possível reproduzir esta versão do projeto.');}
  },[loaded]);
  return <div className="space-y-2 text-xs">
    {loaded ? <canvas ref={canvas} className={admin?'max-h-64 max-w-full object-contain':'h-full w-full object-contain'} aria-label="Previsão do quadro aprovado"/> : <span>{error || 'Carregando quadro…'}</span>}
    {admin && loaded && <><p>{loaded.summary.status}</p><p>{loaded.summary.plan.widthMm} × {loaded.summary.plan.heightMm} mm · formato: {loaded.project.input.shape || 'square'} · hash {reference.hash.slice(0,12)}</p><div className="flex flex-wrap gap-3"><button type="button" disabled={downloading} onClick={downloadOriginal} className="rounded bg-sand-400 px-3 py-2 font-semibold text-zinc-950 disabled:opacity-50">{downloading ? "Baixando…" : "Baixar foto original para produção"}</button><a href={loaded.originalUrl} target="_blank" rel="noreferrer" className="underline text-sand-300">Abrir imagem original (link temporário)</a><button type="button" onClick={()=>download(JSON.stringify(loaded.project,null,2),`${reference.id}-configuracao.json`,'application/json')}>Baixar configuração</button></div><p className="text-zinc-400">A finalização do HueForge acontece no software externo de produção.</p></>}
    {error && loaded && <p role="alert" className="text-red-300">{error}</p>}
  </div>;
}
