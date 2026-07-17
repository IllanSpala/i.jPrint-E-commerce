import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CarrinhoProvider } from "./context/CarrinhoContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import SidebarCarrinho from "./components/SidebarCarrinho";
import Home from "./pages/Home";
import PaginaProduto from "./pages/PaginaProduto";

export default function App() {
  return (
    <BrowserRouter>
      <CarrinhoProvider>
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
          <Header />
          <div className="flex-1">
            <Routes>
              <Route path="/"            element={<Home />} />
              <Route path="/produto/:id" element={<PaginaProduto />} />
            </Routes>
          </div>
          <Footer />
        </div>
        <SidebarCarrinho />
      </CarrinhoProvider>
    </BrowserRouter>
  );
}
