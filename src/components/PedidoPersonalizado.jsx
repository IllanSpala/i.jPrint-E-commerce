import { useEffect, useRef, useState } from 'react';
import { validarArquivos, validarPedido, TIPOS_ANEXOS } from '../lib/pedidoPersonalizado';

function lerArquivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler um dos anexos. Selecione-o novamente.'));
    reader.onload = () => resolve({ nome: file.name, tipo: file.type, conteudo: reader.result.split(',')[1] });
    reader.readAsDataURL(file);
  });
}
export default function PedidoPersonalizado({ consulta }) {
  const [descricao, setDescricao] = useState('');
  const [arquivos, setArquivos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const texto = useRef(null);
  const chave = useRef(null);
  useEffect(() => {
    if (consulta) {
      setDescricao(`Olá! Gostaria de consultar o valor e a disponibilidade da peça pronta: ${consulta.nome}.`);
      setSucesso(false);
      texto.current?.focus({ preventScroll: true });
      document.getElementById('personalizado')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }, [consulta]);
  useEffect(() => {
    const lista = arquivos.map(file => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(lista);
    return () => lista.forEach(p => URL.revokeObjectURL(p.url));
  }, [arquivos]);
  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    const form = e.currentTarget;
    const valores = new FormData(form);
    const dados = { nome: valores.get('nome').trim(), email: valores.get('email').trim(), descricao: descricao.trim(), referencia: valores.get('referencia').trim() };
    const problema = validarPedido(dados) || validarArquivos(arquivos);
    if (problema) { setErro(problema); return; }
    setEnviando(true); setErro(''); setSucesso(false);
    try {
      chave.current ||= crypto.randomUUID();
      const anexos = await Promise.all(arquivos.map(lerArquivo));
      const response = await fetch('/api/pedido-personalizado', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...dados, anexos, chave: chave.current }), signal:AbortSignal.timeout(20000) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'Não foi possível enviar. Tente novamente em instantes.');
      setSucesso(true); form.reset(); setDescricao(''); setArquivos([]); chave.current = null;
    } catch (error) { setErro(error.name === 'TimeoutError' ? 'O envio demorou mais que o esperado. Tente novamente; sua referência foi mantida.' : error.message); }
    finally { setEnviando(false); }
  }
  return <section id="personalizado" className="personalizado" aria-labelledby="personalizado-titulo">
    <div><span className="vitrine-eyebrow text-sand-400">Seu próximo projeto</span><h2 id="personalizado-titulo" className="font-display">Pedido<br /><span className="text-sand-400">personalizado.</span></h2><p>Conte o que quer criar: tamanho, cores, quantidade e os detalhes que importam. Envie imagens, um vídeo curto ou um link de referência.</p><p className="mt-4">Retornamos por e-mail para alinhar viabilidade, valor e prazo antes de produzir. Você também pode consultar aqui uma peça pronta.</p></div>
    <form onSubmit={enviar} onChange={() => { chave.current = null; setSucesso(false); }} aria-busy={enviando}>
      <fieldset disabled={enviando}>
        <label>Seu nome<input name="nome" autoComplete="name" required minLength={2} maxLength={100} /></label>
        <label>E-mail para retorno<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label>Conte sua ideia<textarea ref={texto} name="descricao" required minLength={20} maxLength={4000} rows={5} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Quero uma peça de aproximadamente 15 cm…" /></label>
        <label>Link de referência (opcional)<input name="referencia" type="url" maxLength={2000} placeholder="https://" /></label>
        <label>Imagens ou vídeo (opcional)<input type="file" accept={TIPOS_ANEXOS.join(',')} multiple aria-describedby="anexos-ajuda" onChange={e => {
          const lista = [...arquivos, ...Array.from(e.target.files || [])]; const problema = validarArquivos(lista);
          setErro(problema); if (!problema) setArquivos(lista); e.target.value = '';
        }} /><small id="anexos-ajuda">Até 3 arquivos, somando 3 MB. JPG, PNG, WebP, MP4 ou WebM. Para vídeos maiores, use o link de referência.</small></label>
        {previews.length > 0 && <ul className="anexo-lista">{previews.map(({ file, url }, i) => <li key={url}>{file.type.startsWith('image/') ? <img src={url} alt={`Referência: ${file.name}`} /> : <video src={url} controls preload="metadata" aria-label={file.name} />}<span>{file.name}</span><br /><button type="button" onClick={() => { setArquivos(a => a.filter((_, j) => i !== j)); chave.current = null; }} aria-label={`Remover ${file.name}`}>Remover</button></li>)}</ul>}
        <small>Seus dados e referências serão usados para responder a esta solicitação.</small>
        <button type="submit" className="bg-sand-400 hover:bg-sand-300 text-zinc-950 rounded px-6 py-3 font-semibold disabled:opacity-60">{enviando ? 'Enviando…' : 'Enviar para avaliação'}</button>
      </fieldset>
      {erro && <p role="alert" className="!text-red-300">{erro} Se precisar, fale com <a className="underline" href="mailto:i.j.print26@gmail.com">i.j.print26@gmail.com</a>.</p>}
      {sucesso && <p role="status" className="!text-sand-200">Solicitação enviada! Retornaremos pelo e-mail informado para combinar os próximos passos.</p>}
    </form>
  </section>;
}
