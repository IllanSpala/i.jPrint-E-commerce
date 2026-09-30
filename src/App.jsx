import { useLayoutEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { CarrinhoProvider } from "./context/CarrinhoContext";
import { AuthProvider } from "./context/AuthContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import SidebarCarrinho from "./components/SidebarCarrinho";
import ConsentBanner from "./components/ConsentBanner";
import Home from "./pages/Home";
import PaginaProduto from "./pages/PaginaProduto";
import Login from "./pages/Login";
import Perfil from "./pages/Perfil";
import Admin from "./pages/Admin";
import PaginaSucesso from "./pages/PaginaSucesso";

import Apresentacao from "./pages/Apresentacao";
import PaginaPersonalizado from "./pages/PaginaPersonalizado";
import "./components/VitrineExperiencia.css";

function PosicaoDaPagina() {
  const { pathname } = useLocation();
  useLayoutEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [pathname]);
  return null;
}
function RodapeDaLoja() {
  const { pathname } = useLocation();
  return pathname === '/ajuda' ? null : <Footer />;
}
export default function App() {
  return (
    <BrowserRouter>
      <PosicaoDaPagina />
      <AuthProvider>
        <CarrinhoProvider>
          <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
            <Header />
            <div className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/ajuda" element={<Apresentacao />} />
                <Route path="/catalogo" element={<Home />} />
                <Route path="/pedido-personalizado" element={<PaginaPersonalizado />} />
                <Route path="/produto/:id" element={<PaginaProduto />} />
                <Route path="/login"       element={<Login />} />
                <Route path="/perfil"      element={<Perfil />} />
                <Route path="/admin"       element={<Admin />} />
                <Route path="/pedido-confirmado" element={<PaginaSucesso />} />
              </Routes>
            </div>
            <RodapeDaLoja />
          </div>
          <SidebarCarrinho />
          <ConsentBanner />
        </CarrinhoProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
