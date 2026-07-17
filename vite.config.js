import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Para GitHub Pages, defina base com o nome do seu repositório:
  base: "/i.jPrint-E-commerce/",
});
