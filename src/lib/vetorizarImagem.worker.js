import { vetorizarImagem } from './vetorizarImagem.js';
self.onmessage = ({ data }) => {
  try { self.postMessage(vetorizarImagem(data)); }
  catch (error) { self.postMessage({ error: error.message || 'Não foi possível converter a imagem.' }); }
};
