import { Link } from 'react-router-dom';
import { Info, ArrowRight } from 'lucide-react';

export default function Apresentacao() {
  return <main className="entrada-loja">
    <section className="aviso-compra" aria-labelledby="entrada-titulo">
      <div className="aviso-marca"><Info size={20} aria-hidden="true" /><span>Antes de escolher sua peça</span></div>
      <h1 id="entrada-titulo" className="font-display">Como comprar na I.J Print</h1>
      <p className="entrada-resumo">Impressão 3D com acabamento artesanal. Escolha a forma de pedir:</p>
      <dl className="entrada-opcoes">
        <div><dt>Catálogo sob encomenda</dt><dd>Você escolhe o modelo. Nós produzimos e finalizamos para você.</dd></div>
        <div><dt>Pronta entrega</dt><dd>Peças já impressas e finalizadas, em uma área própria dentro do catálogo.</dd></div>
        <div><dt><Link to="/pedido-personalizado">Pedido personalizado ↗</Link></dt><dd>Envie uma descrição, fotos, vídeo ou link para avaliarmos seu projeto.</dd></div>
      </dl>
      <p className="entrada-nota">Confirme os detalhes e o prazo de cada peça antes de pedir.</p>
      <Link to="/catalogo" className="entrada-prosseguir">Prosseguir para o catálogo <ArrowRight size={19} aria-hidden="true" /></Link>
    </section>
  </main>;
}
