import { Link, useLocation } from 'react-router-dom';
import PedidoPersonalizado from '../components/PedidoPersonalizado';

export default function PaginaPersonalizado() {
  const { state } = useLocation();
  return <main className="pagina-personalizado max-w-7xl mx-auto px-4 pt-24 pb-12">
    <nav className="loja-navegacao" aria-label="Navegação do pedido"><Link to="/">Como comprar</Link><Link to="/catalogo">Voltar ao catálogo →</Link></nav>
    <PedidoPersonalizado consulta={state?.consulta} />
  </main>;
}
