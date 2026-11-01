import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { apiAutenticada } from '../../lib/apiAutenticada';
const empty = () => ({id:'',name:'',hex:'#ffffff',inStock:true,material:'PLA',effect:'solid'});
export default function FilamentStock() {
  const [open,setOpen]=useState(false),[rows,setRows]=useState([]),[color,setColor]=useState(empty),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function load() {
    const result=await supabase.from('filament_art_profiles').select('id,profile,in_stock').order('id');
    if(result.error)setError('Não foi possível carregar os filamentos.');else {setRows(result.data || []);setError('');}
  }
  async function save(e) {
    e.preventDefault();setBusy(true);setError('');
    try {
      const response=await apiAutenticada('/api/filament-art',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save-stock-color',color:{...color,id:color.id || crypto.randomUUID()}})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      setColor(empty());await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="mb-6 rounded-xl border border-zinc-700 bg-zinc-900 p-4"><button onClick={()=>{setOpen(!open);if(!open)load();}} aria-expanded={open} className="font-semibold text-sand-300">Cores e filamentos disponíveis</button>{open&&<div className="mt-4 space-y-4"><p className="text-sm text-zinc-400">Cadastre seus filamentos e marque os disponíveis. Os produtos paramétricos com SVG usam estas cores para o objeto e a gravura. As amostras na tela são aproximadas.</p><div className="flex flex-wrap gap-2">{rows.map(row=><button key={row.id} onClick={()=>setColor({id:row.id,name:row.profile.name,hex:row.profile.hex,inStock:row.in_stock,material:row.profile.material || 'PLA',effect:row.profile.effect || 'solid'})} className="rounded border border-zinc-700 px-3 py-2 text-sm"><span className="mr-2 inline-block h-4 w-4 rounded-full align-middle" style={{background:row.profile.hex}}/>{row.profile.name} ({row.profile.material}) · {row.in_stock?'Disponível':'Indisponível'}</button>)}</div><form onSubmit={save} className="flex flex-wrap items-end gap-4"><label className="text-sm">Nome da cor<input required maxLength={120} value={color.name} onChange={e=>setColor(c=>({...c,name:e.target.value}))} className="mt-1 block rounded bg-zinc-950 p-2"/></label><label className="text-sm">Cor<input aria-label="Cor do filamento" type="color" value={color.hex} onChange={e=>setColor(c=>({...c,hex:e.target.value}))} className="mt-1 block h-10"/></label><label className="text-sm">Material<select value={color.material} onChange={e=>setColor(c=>({...c,material:e.target.value}))} className="block rounded bg-zinc-950 p-2"><option>PLA</option><option>PETG</option></select></label><label className="text-sm">Acabamento<select value={color.effect} onChange={e=>setColor(c=>({...c,effect:e.target.value}))} className="block rounded bg-zinc-950 p-2"><option value="solid">Sólido</option><option value="silk">Silk</option><option value="marble">Mármore</option><option value="multicolor">Tricolor</option></select></label><label className="py-2 text-sm"><input type="checkbox" checked={color.inStock} onChange={e=>setColor(c=>({...c,inStock:e.target.checked}))}/> Disponível</label><button disabled={busy} className="rounded bg-sand-400 px-4 py-2 text-zinc-950 disabled:opacity-40">{busy?'Salvando…':'Salvar cor'}</button><button type="button" onClick={()=>setColor(empty())} className="py-2 text-sm underline">Nova cor</button></form>{error&&<p role="alert" className="text-sm text-red-300">{error}</p>}</div>}</section>;
}
