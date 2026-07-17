/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cinza metálico extraído da logo IJ Print
        silver: {
          50:  "#F4F5F7",
          100: "#E8EAEE",
          200: "#D0D5DD",
          300: "#B8BEC8",
          400: "#A8B0BE",
          500: "#8E97A6",
          600: "#6B7280",
          700: "#4B5563",
          800: "#374151",
          900: "#1F2937",
        },
        // Bege arenoso fraco — extraído do fundo das fotos de produto
        sand: {
          50:  "#FCFBF9",
          100: "#F5F2EA",
          200: "#EBE3D1",
          300: "#E0D3B5",
          400: "#D4C3A3",  // TOM PRINCIPAL — areia amarelado fraco
          500: "#C2AF8B",
          600: "#A3916D",
          700: "#7A6C50",
          800: "#544B36",
          900: "#302B1E",
        },
      },
      backgroundImage: {
        "metal-gradient": "linear-gradient(135deg, #C8D0DC 0%, #A8B0BE 40%, #8E97A6 70%, #B8BEC8 100%)",
      },
    },
  },
  plugins: [],
};
