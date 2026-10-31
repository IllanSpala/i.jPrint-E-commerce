import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { apiLocal } from './scripts/api-local.js';

export default defineConfig({
  plugins: [react(), apiLocal()],
  // Para GitHub Pages, defina base com o nome do seu repositório:
  // base: "/", // Removido para funcionar perfeitamente na Vercel
});
