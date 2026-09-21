// Em Vercel, não publicar uma loja aparentemente funcional sem backend.
if (process.env.VERCEL === '1') {
  const obrigatorias = ['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','INFINITEPAY_HANDLE','MELHOR_ENVIO_TOKEN','ORIGEM_CEP','RESEND_API_KEY','CRON_SECRET'];
  const ausentes = obrigatorias.filter(k => !process.env[k]);
  if (ausentes.length) {
    console.error('Deploy bloqueado. Configure as variáveis: ' + ausentes.join(', '));
    process.exit(1);
  }
}
