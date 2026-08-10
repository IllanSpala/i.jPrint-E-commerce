import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState('');
  const [isReset, setIsReset] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    let error;
    if (isReset) {
      const res = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/perfil',
      });
      error = res.error;
      if (!error) {
        setMessage('Verifique seu email para redefinir a senha!');
        setIsReset(false);
      }
    } else if (isSignUp) {
      // Passa o nome no metadata para que o AuthContext possa criar o perfil com esse nome
      const res = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: { full_name: nome }
        }
      });
      error = res.error;
      if (!error) {
        if (res.data?.session) {
          navigate('/perfil');
        } else {
          setMessage('Sucesso! Verifique seu email para confirmar a conta.');
        }
      }
    } else {
      const res = await supabase.auth.signInWithPassword({ email, password });
      error = res.error;
      if (!error) navigate('/perfil');
    }

    if (error) setMessage(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col pt-24 pb-16 px-4">
      <div className="max-w-md w-full mx-auto">
        <Link to="/" className="flex items-center gap-1.5 text-zinc-400 hover:text-sand-400 text-sm mb-8 transition-colors">
          <ArrowLeft size={15} /> Voltar
        </Link>
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-sand-400 mb-6 text-center">
            {isReset ? 'Redefinir Senha' : isSignUp ? 'Criar Conta' : 'Acessar Conta'}
          </h2>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && !isReset && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-sand-400"
                  placeholder="Seu nome"
                />
              </div>
            )}
            
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-sand-400"
                placeholder="seu@email.com"
              />
            </div>
            
            {!isReset && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Senha</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-sand-400"
                  placeholder="••••••••"
                />
              </div>
            )}
            
            {message && <p className="text-sand-400 text-sm text-center bg-sand-400/10 p-2 rounded">{message}</p>}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sand-400 hover:bg-sand-300 text-zinc-950 font-bold py-3 rounded transition-colors uppercase tracking-widest text-sm disabled:opacity-50 mt-4"
            >
              {loading ? 'Aguarde...' : isReset ? 'Enviar Email' : isSignUp ? 'Criar Minha Conta' : 'Entrar'}
            </button>
          </form>
          
          <div className="mt-6 flex flex-col gap-3 text-center">
            {!isReset && (
              <button
                type="button"
                onClick={() => { setIsReset(true); setIsSignUp(false); setMessage(''); }}
                className="text-zinc-500 text-xs hover:text-sand-400 transition-colors"
              >
                Esqueceu ou quer mudar sua senha?
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isReset) setIsReset(false);
                else setIsSignUp(!isSignUp);
                setMessage('');
              }}
              className="text-zinc-400 text-sm hover:text-sand-400 transition-colors"
            >
              {isReset ? 'Voltar para o Login' : isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Crie aqui'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
