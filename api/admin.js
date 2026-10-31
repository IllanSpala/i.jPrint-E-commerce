import status from './_lib/status.js';
import produtoAtivo from './_lib/produto-ativo.js';

// Public aliases are rewritten here to stay within the Hobby function limit.
// Both handlers retain their existing admin authentication and validation.
const operations = new Map([['status', status], ['produto-ativo', produtoAtivo]]);

export default function handler(req, res) {
  const operation = operations.get(req.query?.operation);
  if (!operation) return res.status(404).json({ error: 'Rota de API não encontrada.' });
  return operation(req, res);
}
