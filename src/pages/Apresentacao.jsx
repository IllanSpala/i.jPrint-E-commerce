import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import { prontaEntrega } from '../data/prontaEntrega.js';
import { carregarProntaEntrega } from '../lib/estadoProntaEntrega.js';
import { supabase } from '../lib/supabase.js';

const destaque = {
  id: 'destaque-setembro',
  imagem: '/pronta-entrega/destaque_setembro.png',
  alt: 'Seleção de peças impressas e finalizadas pela I.J Print',
};

// A peça continua no catálogo, mas não participa do carrossel de abertura.
const itensOcultosNoCarrossel = new Set(['pronta-jax']);

export default function Apresentacao() {
  const [indice, setIndice] = useState(0);
  const [pecas, setPecas] = useState(prontaEntrega.filter(peca => !itensOcultosNoCarrossel.has(peca.id)).map(peca => ({ ...peca, esgotado: false })));
  const [pausado, setPausado] = useState(false);
  const slides = [destaque, ...pecas];
  const atual = slides[indice] || destaque;

  useEffect(() => {
    let montado = true;
    carregarProntaEntrega(supabase).then(resultado => {
      if (montado && Array.isArray(resultado.data)) {
        setPecas(resultado.data.filter(peca => !itensOcultosNoCarrossel.has(peca.id)));
      }
    }).catch(() => {});
    return () => { montado = false; };
  }, []);

  useEffect(() => {
    if (pausado || slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => setIndice(valor => (valor + 1) % slides.length), 5500);
    return () => window.clearInterval(timer);
  }, [pausado, slides.length]);

  function navegar(direcao) {
    setIndice(valor => (valor + direcao + slides.length) % slides.length);
  }

  return <main className="entrada-loja">
    <section
      className="entrada-carrossel"
      aria-roledescription="carrossel"
      aria-label="Conheça a I.J Print e as peças de pronta entrega"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocusCapture={() => setPausado(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPausado(false); }}
    >
      <img key={atual.id} className="entrada-fundo" src={atual.imagem} alt={indice === 0 ? atual.alt : ''} />
      <div className="entrada-sombra" aria-hidden="true" />

      {indice === 0 ? <section className="aviso-compra" aria-labelledby="entrada-titulo">
        <div className="aviso-marca"><Info size={20} aria-hidden="true" /><span>Antes de escolher sua peça</span></div>
        <h1 id="entrada-titulo" className="font-display">Como comprar na I.J Print</h1>
        <p className="entrada-resumo">Impressão 3D com acabamento artesanal. Escolha a forma de pedir:</p>
        <dl className="entrada-opcoes">
          <div><dt>Catálogo sob encomenda</dt><dd>Você escolhe o modelo. Nós produzimos e finalizamos para você.</dd></div>
          <div><dt>Pronta entrega</dt><dd>Peças já impressas e finalizadas, em uma área própria dentro do catálogo.</dd></div>
          <div><dt><Link to="/pedido-personalizado">Pedido personalizado ↗</Link></dt><dd>Envie uma descrição, fotos, vídeo ou link para avaliarmos seu projeto.</dd></div>
        </dl>
        <Link to="/catalogo" className="entrada-prosseguir">Prosseguir para o catálogo <ArrowRight size={19} aria-hidden="true" /></Link>
      </section> : <article className="entrada-peca">
        <span className={`entrada-status ${atual.esgotado ? 'esgotado' : ''}`}>
          {atual.esgotado ? 'Esgotado' : 'Disponível agora'}
        </span>
        <p className="vitrine-eyebrow">Pronta entrega</p>
        <h2 className="font-display">{atual.nome}</h2>
        <p>{atual.descricao}</p>
        <Link to="/catalogo?secao=pronta-entrega" className="entrada-prosseguir">
          {atual.esgotado ? 'Ver pronta entrega' : 'Ver peça no catálogo'} <ArrowRight size={19} aria-hidden="true" />
        </Link>
      </article>}

      <div className="entrada-controles">
        <button type="button" onClick={() => navegar(-1)} aria-label="Slide anterior"><ArrowLeft size={18} /></button>
        <div className="entrada-pontos" aria-label={`Slide ${indice + 1} de ${slides.length}`}>
          {slides.map((slide, i) => <button key={slide.id} type="button" className={i === indice ? 'ativo' : ''} onClick={() => setIndice(i)} aria-label={`Mostrar slide ${i + 1}`} aria-current={i === indice ? 'true' : undefined} />)}
        </div>
        <button type="button" onClick={() => navegar(1)} aria-label="Próximo slide"><ArrowRight size={18} /></button>
      </div>
    </section>
  </main>;
}
