import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CarrinhoProvider } from "./context/CarrinhoContext";
import { AuthProvider } from "./context/AuthContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import SidebarCarrinho from "./components/SidebarCarrinho";
import CookieBanner from "./components/CookieBanner";
import Home from "./pages/Home";
import PaginaProduto from "./pages/PaginaProduto";
import Login from "./pages/Login";
import Perfil from "./pages/Perfil";
import Admin from "./pages/Admin";
import PaginaSucesso from "./pages/PaginaSucesso";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CarrinhoProvider>
          <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
            <Header />
            <div className="flex-1">
              <Routes>
                <Route path="/"            element={<Home />} />
                <Route path="/produto/:id" element={<PaginaProduto />} />
                <Route path="/login"       element={<Login />} />
                <Route path="/perfil"      element={<Perfil />} />
                <Route path="/admin"       element={<Admin />} />
                <Route path="/pedido-confirmado" element={<PaginaSucesso />} />
              </Routes>
            </div>
            <Footer />
          </div>
          <SidebarCarrinho />
          <CookieBanner />
        </CarrinhoProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
