import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ImagePlus, LoaderCircle, Mail, Sparkles } from 'lucide-react';
import './PedidoPersonalizado.css';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { apiAutenticada } from '../lib/apiAutenticada';
import { carregarCadastro } from '../lib/cadastroCompleto';
import { Link } from 'react-router-dom';
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
  const { user } = useAuth();
  const [cadastro, setCadastro] = useState(null);
  const [avisoCadastro, setAvisoCadastro] = useState('Verificando cadastro…');
  useEffect(() => {
    let ativo = true;
    const verificar = () => { setCadastro(null); carregarCadastro(supabase, user).then(d => { if (ativo) { setCadastro(d); setAvisoCadastro(''); } }).catch(e => { if (ativo) setAvisoCadastro(e.message); }); };
    verificar(); window.addEventListener('focus', verificar);
    return () => { ativo = false; window.removeEventListener('focus', verificar); };
  }, [user]);
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
    if (enviando || !cadastro) return;
    const form = e.currentTarget;
    const valores = new FormData(form);
    const dados = { nome: valores.get('nome').trim(), email: valores.get('email').trim(), descricao: descricao.trim(), referencia: valores.get('referencia').trim() };
    const problema = validarPedido(dados) || validarArquivos(arquivos);
    if (problema) { setErro(problema); return; }
    setEnviando(true); setErro(''); setSucesso(false);
    try {
      await carregarCadastro(supabase, user);
      chave.current ||= crypto.randomUUID();
      const anexos = await Promise.all(arquivos.map(lerArquivo));
      const response = await apiAutenticada('/api/pedido-personalizado', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...dados, anexos, chave: chave.current }), signal:AbortSignal.timeout(20000) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'Não foi possível enviar. Tente novamente em instantes.');
      setSucesso(true); form.reset(); setDescricao(''); setArquivos([]); chave.current = null;
    } catch (error) { setErro(error.name === 'TimeoutError' ? 'O envio demorou mais que o esperado. Tente novamente; sua referência foi mantida.' : error.message); }
    finally { setEnviando(false); }
  }
  return <section id="personalizado" className="personalizado" aria-labelledby="personalizado-titulo">
    <div className="projeto-cabecalho-compacto">
      <Sparkles size={20} aria-hidden="true" />
      <h1 id="personalizado-titulo">Pedido personalizado</h1>
      <p>Você imagina. A gente dá forma.</p>
    </div>
    <form onSubmit={enviar} onChange={() => { chave.current = null; setSucesso(false); }} aria-busy={enviando}>
      <div className="projeto-form-cabecalho"><span className="vitrine-eyebrow">PEDIDO PERSONALIZADO</span><h2>Vamos criar algo seu?</h2><p>Preencha os detalhes para avaliarmos seu projeto.</p></div>
      {!cadastro && <div className="projeto-mensagem projeto-erro" role="status">{avisoCadastro}<br /><Link className="underline" to={user ? '/perfil' : '/login'}>{user ? 'Completar meu cadastro' : 'Entrar ou criar conta'}</Link></div>}
      <fieldset disabled={enviando || !cadastro}>
        <div className="projeto-secao-titulo"><span>01</span> Seus dados</div>
        <div className="projeto-contatos">
        <label>Seu nome<input name="nome" value={cadastro?.nome || ''} readOnly autoComplete="name" required minLength={2} maxLength={100} placeholder="Como podemos chamar você?" /></label>
        <label>E-mail para retorno<input name="email" value={cadastro?.email || ''} readOnly type="email" autoComplete="email" required maxLength={254} placeholder="voce@email.com" /></label>
        <label>Celular com DDD (obrigatório)<input name="telefone" value={cadastro?.telefone || ''} readOnly type="tel" autoComplete="tel-national" required aria-required="true" aria-describedby="telefone-cadastro-ajuda" placeholder="(11) 99999-9999" /></label></div>
        <small id="telefone-cadastro-ajuda">Usaremos o celular cadastrado para contato sobre o pedido. <Link to="/perfil" className="underline text-sand-300">Cadastrar ou atualizar celular no perfil</Link>.</small>
        <div className="projeto-secao-titulo"><span>02</span> Sua ideia</div>
        <label>Conte sua ideia<textarea ref={texto} name="descricao" required minLength={20} maxLength={4000} rows={5} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="O que você quer criar? Conte o tamanho aproximado, as cores, a quantidade e como imagina o acabamento…" /><small className="projeto-contagem">Mínimo de 20 caracteres <span>{descricao.length}/4000</span></small></label>
        <div className="projeto-secao-titulo"><span>03</span> Referências <small>opcional</small></div>
        <label>Link de referência (opcional)<input name="referencia" type="url" maxLength={2000} placeholder="https://" /></label>
        <label className="projeto-upload"><ImagePlus size={27} aria-hidden="true" /><strong>Adicione imagens ou um vídeo</strong><span>Escolha arquivos para mostrar o que tem em mente</span><input type="file" accept={TIPOS_ANEXOS.join(',')} multiple aria-describedby="anexos-ajuda" onChange={e => {
          const lista = [...arquivos, ...Array.from(e.target.files || [])]; const problema = validarArquivos(lista);
          setErro(problema); if (!problema) setArquivos(lista); e.target.value = '';
        }} /><small id="anexos-ajuda">Até 3 arquivos, somando 3 MB. JPG, PNG, WebP, MP4 ou WebM. Para vídeos maiores, use o link de referência.</small></label>
        {previews.length > 0 && <ul className="anexo-lista">{previews.map(({ file, url }, i) => <li key={url}>{file.type.startsWith('image/') ? <img src={url} alt={`Referência: ${file.name}`} /> : <video src={url} controls preload="metadata" aria-label={file.name} />}<span>{file.name}</span><br /><button type="button" onClick={() => { setArquivos(a => a.filter((_, j) => i !== j)); chave.current = null; }} aria-label={`Remover ${file.name}`}>Remover</button></li>)}</ul>}
        <small className="projeto-privacidade">Seus dados e referências serão usados apenas para responder a esta solicitação.</small>
        <button type="submit" className="projeto-enviar">{enviando ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowUpRight size={19} />}{enviando ? 'Enviando…' : 'Enviar minha ideia'}</button><span className="projeto-retorno"><Mail size={14} /> A conversa continua pelo seu e-mail.</span>
      </fieldset>
      {erro && <p role="alert" className="projeto-mensagem projeto-erro">{erro} Se precisar, fale com <a className="underline" href="mailto:i.j.print26@gmail.com">i.j.print26@gmail.com</a>.</p>}
      {sucesso && <p role="status" className="projeto-mensagem projeto-sucesso"><Check size={20} /> Solicitação enviada! Retornaremos pelo e-mail informado para combinar os próximos passos.</p>}
    </form>
  </section>;
}
