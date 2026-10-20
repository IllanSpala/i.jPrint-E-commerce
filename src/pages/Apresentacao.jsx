import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';

// Conteúdo editorial fixo: novos produtos não criam slides de ajuda.
const slides = [
  {
    id: 'processo',
    titulo: 'Da impressão ao acabamento',
    resumo: 'Conheça as etapas que dão forma à sua peça e saiba como pedir.',
    imagem: '/pronta-entrega/destaque_setembro.png',
    topicos: [
      ['Impressão 3D em PLA premium', 'O modelo digital ganha forma camada por camada. Pequenas linhas da impressão podem fazer parte da superfície da peça.'],
      ['Pós-processamento e pintura', 'Após a impressão, a peça passa pela remoção de suportes e pelo acabamento. A preparação e a pintura seguem a opção descrita no produto ou combinada no pedido.'],
      ['Como fazer seu pedido', 'Escolha pronta-entrega ou um modelo do catálogo, confira medidas, acabamento e valor e adicione ao carrinho. Revise o frete e os dados de entrega antes de finalizar.'],
    ],
    links: [{ para: '/catalogo?secao=pronta-entrega', texto: 'Escolher minha peça' }],
  },
  {
    id: 'formas-de-comprar',
    titulo: 'Pronta-entrega ou catálogo?',
    resumo: 'Duas formas de comprar, com momentos diferentes de produção.',
    imagem: '/pronta-entrega/xenonita_real.png',
    topicos: [
      ['Pronta-entrega', 'São peças já impressas e finalizadas, com o acabamento mostrado nas fotos. Escolha entre os itens disponíveis; o prazo de transporte depende do frete.'],
      ['Catálogo sob encomenda', 'Você escolhe um modelo para ser produzido. Confira as opções de personalização na página da peça e considere o tempo de produção, além do transporte.'],
    ],
    links: [
      { para: '/catalogo?secao=pronta-entrega', texto: 'Ver pronta-entrega', salvia: true },
      { para: '/catalogo?secao=catalogo', texto: 'Ver catálogo sob encomenda' },
    ],
  },
  {
    id: 'personalizados',
    titulo: 'Sua ideia, um pedido personalizado',
    resumo: 'Não encontrou o que procura? Conte o que você quer criar.',
    imagem: '/pronta-entrega/luffy_real.png',
    topicos: [
      ['Envie sua ideia e referências', 'Descreva a peça, o tamanho desejado, a quantidade e o acabamento. Fotos, vídeos e links ajudam a explicar o projeto.'],
      ['Avaliação e orçamento', 'Avaliamos a viabilidade da impressão e os detalhes necessários para definir o valor e o prazo. O envio da solicitação inicia essa conversa.'],
      ['Combine os detalhes antes da produção', 'Modelo, medidas, cores e acabamento precisam estar alinhados para transformar sua referência em uma peça personalizada.'],
    ],
    links: [{ para: '/pedido-personalizado', texto: 'Solicitar pedido personalizado' }],
  },
];

export default function Apresentacao() {
  const [indice, setIndice] = useState(0);
  const atual = slides[indice];

  function navegar(direcao) {
    setIndice(valor => (valor + direcao + slides.length) % slides.length);
  }

  return <main className="entrada-loja">
    <section className={`entrada-carrossel entrada-guia-${atual.id}`} aria-roledescription="carrossel" aria-label="Como comprar na I.J Print">
      <img key={atual.id} className="entrada-fundo" src={atual.imagem} alt="" />
      <div className="entrada-sombra" aria-hidden="true" />
      <section key={`conteudo-${atual.id}`} className="aviso-compra" aria-labelledby="entrada-titulo" aria-live="polite" aria-atomic="true">
        <div className="aviso-marca"><Info size={20} aria-hidden="true" /><span>Guia de compra · {indice + 1} de {slides.length}</span></div>
        <h1 id="entrada-titulo" className="font-display">{atual.titulo}</h1>
        <p className="entrada-resumo">{atual.resumo}</p>
        <dl className="entrada-opcoes">
          {atual.topicos.map(([titulo, descricao]) => <div key={titulo}><dt>{titulo}</dt><dd>{descricao}</dd></div>)}
        </dl>
        <div className="entrada-acoes">
          {atual.links.map(link => <Link key={link.para} to={link.para} className={`entrada-prosseguir${link.salvia ? ' entrada-prosseguir-salvia' : ''}`}>
            {link.texto}<ArrowRight size={19} aria-hidden="true" />
          </Link>)}
        </div>
      </section>
      <div className="entrada-controles">
        <button type="button" onClick={() => navegar(-1)} aria-label="Slide anterior"><ArrowLeft size={18} /></button>
        <div className="entrada-pontos" aria-label={`Slide ${indice + 1} de ${slides.length}`}>
          {slides.map((slide, i) => <button key={slide.id} type="button" className={i === indice ? 'ativo' : ''} onClick={() => setIndice(i)} aria-label={`Mostrar slide ${i + 1}: ${slide.titulo}`} aria-current={i === indice ? 'true' : undefined} />)}
        </div>
        <button type="button" onClick={() => navegar(1)} aria-label="Próximo slide"><ArrowRight size={18} /></button>
      </div>
    </section>
  </main>;
}
