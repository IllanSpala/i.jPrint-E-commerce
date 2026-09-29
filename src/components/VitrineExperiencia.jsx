import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import './VitrineExperiencia.css';

const pecas = [
  { nome: 'Robô articulado', descricao: 'Textura envelhecida e articulações que dão movimento à peça.', fotos: ['59', '58', '57'] },
  { nome: 'Coelho de macacão', descricao: 'Cores suaves, silhueta alongada e detalhes dourados.', fotos: ['50'] },
  { nome: 'Engenheira florestal', descricao: 'Figura com capacete, colete e base temática de engenharia florestal.', fotos: ['51'] },
  { nome: 'Miniaturas de criaturas', descricao: 'Pequenos personagens com acabamento em vermelho e tons naturais.', fotos: ['55'] },
];

function Peca({ peca, onConsultar }) {
  const [foto, setFoto] = useState(0);
  return <article className="peca-pronta">
    <img src={`/pronta-entrega/${peca.fotos[foto]}.webp`} alt={`${peca.nome}, fotografia ${foto + 1}`} loading="lazy" width="800" height="1000" />
    {peca.fotos.length > 1 && <div className="angulos" aria-label="Ângulos da peça">{peca.fotos.map((id, i) => <button key={id} type="button" onClick={() => setFoto(i)} aria-pressed={foto === i} aria-label={`Ver ângulo ${i + 1}`}>{i + 1}</button>)}</div>}
    <h3>{peca.nome}</h3><p>{peca.descricao}</p>
    <button type="button" className="vitrine-link" onClick={() => onConsultar(peca.nome)}>Consultar esta peça <ArrowUpRight size={17} aria-hidden="true" /></button>
  </article>;
}

export default function VitrineExperiencia({ onConsultar }) {
  useEffect(() => {
    document.documentElement.dataset.vitrineTema = 'salvia';
    return () => { delete document.documentElement.dataset.vitrineTema; };
  }, []);
  return <div className="vitrine-experiencia">
    <section id="pronta-entrega" className="pronta-entrega" aria-labelledby="pronta-titulo">
      <div className="pronta-cabecalho"><div><span className="vitrine-eyebrow">O que já ganhou forma</span><h2 id="pronta-titulo" className="font-display">Pronta entrega.</h2></div><p>Da nossa bancada para o seu espaço. Conheça as peças finalizadas e consulte valores, disponibilidade e prazo de envio.</p></div>
      <div className="pecas-grid">{pecas.map(peca => <Peca key={peca.nome} peca={peca} onConsultar={onConsultar} />)}</div>
      <p className="pronta-nota">Fotografias das nossas peças finalizadas. A consulta confirma a disponibilidade atual e não reserva o item.</p>

    </section>
  </div>;
}
