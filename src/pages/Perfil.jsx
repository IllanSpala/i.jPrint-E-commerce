import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Pencil, Plus, Check, X, Trash2 } from 'lucide-react';

export default function Perfil() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ nome: '', telefone: '', cpf: '' });
  const [enderecos, setEnderecos] = useState([]);

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');

  const [isEditingCpf, setIsEditingCpf] = useState(false);
  const [cpfInput, setCpfInput] = useState('');

  const [editingAddress, setEditingAddress] = useState(null); // null = not editing, 'new' = creating, or id = editing
  const [addressForm, setAddressForm] = useState({ rua: '', numero: '', bairro: '', cidade: '', uf: '', cep: '', padrao: false });

  // Password Recovery States
  const [isRecovery, setIsRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  useEffect(() => {
    // Verifica se o usuário veio de um link de recuperação de senha
    if (window.location.hash && window.location.hash.includes('type=recovery')) {
      setIsRecovery(true);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    if (!user) return;
    // Fetch profile
    const { data: prof } = await supabase.from('perfis').select('*').eq('id', user.id).single();
    if (prof) {
      setProfile({ nome: prof.nome || user.email.split('@')[0], telefone: prof.telefone || '', cpf: prof.cpf || '' });
      setPhoneInput(prof.telefone || '');
      setCpfInput(prof.cpf || '');
    }

    // Fetch addresses
    const { data: ends } = await supabase.from('enderecos').select('*').eq('user_id', user.id).order('padrao', { ascending: false });
    if (ends) setEnderecos(ends);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handlePhoneChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);
    if (val.length > 2) {
      val = `(${val.slice(0, 2)}) ${val.slice(2)}`;
    }
    if (val.length > 10) {
      val = `${val.slice(0, 10)}-${val.slice(10)}`;
    }
    setPhoneInput(val);
  };

  const handleCepChange = async (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);
    
    let formatted = val;
    if (val.length > 5) {
      formatted = `${val.slice(0, 5)}-${val.slice(5)}`;
    }
    
    setAddressForm(prev => ({ ...prev, cep: formatted }));

    if (val.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${val}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setAddressForm(prev => ({
            ...prev,
            rua: data.logradouro || prev.rua,
            bairro: data.bairro || prev.bairro,
            cidade: data.localidade || prev.cidade,
            uf: data.uf || prev.uf
          }));
        }
      } catch (err) {
        console.error("Erro ao buscar CEP:", err);
      }
    }
  };

  const handleSavePhone = async () => {
    const numbersOnly = phoneInput.replace(/\D/g, '');
    if (numbersOnly.length < 10 || numbersOnly.length > 11) {
      alert("Por favor, insira um telefone válido com DDD (Ex: 11999999999).");
      return;
    }

    const formatted = numbersOnly.length === 11
      ? `(${numbersOnly.slice(0, 2)}) ${numbersOnly.slice(2, 7)}-${numbersOnly.slice(7)}`
      : `(${numbersOnly.slice(0, 2)}) ${numbersOnly.slice(2, 6)}-${numbersOnly.slice(6)}`;

    const { error } = await supabase.from('perfis').update({ telefone: formatted }).eq('id', user.id);
    if (error) {
      console.error("Erro ao salvar telefone:", error);
      alert("Erro ao salvar telefone: " + error.message);
      return;
    }

    setProfile({ ...profile, telefone: formatted });
    setIsEditingPhone(false);
  };

  const handleCpfChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);
    if (val.length > 9) val = `${val.slice(0,3)}.${val.slice(3,6)}.${val.slice(6,9)}-${val.slice(9)}`;
    else if (val.length > 6) val = `${val.slice(0,3)}.${val.slice(3,6)}.${val.slice(6)}`;
    else if (val.length > 3) val = `${val.slice(0,3)}.${val.slice(3)}`;
    setCpfInput(val);
  };

  const handleSaveCpf = async () => {
    const nums = cpfInput.replace(/\D/g, '');
    if (nums.length !== 11) {
      alert('Por favor, insira um CPF válido com 11 dígitos.');
      return;
    }
    const formatted = `${nums.slice(0,3)}.${nums.slice(3,6)}.${nums.slice(6,9)}-${nums.slice(9)}`;
    const { error } = await supabase.from('perfis').update({ cpf: formatted }).eq('id', user.id);
    if (error) { alert('Erro ao salvar CPF: ' + error.message); return; }
    setProfile({ ...profile, cpf: formatted });
    setIsEditingCpf(false);
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();

    const cepNumbers = addressForm.cep.replace(/\D/g, '');
    if (cepNumbers.length !== 8) {
      alert("Por favor, insira um CEP válido de 8 dígitos.");
      return;
    }
    const formattedCep = `${cepNumbers.slice(0, 5)}-${cepNumbers.slice(5)}`;
    const finalForm = { ...addressForm, cep: formattedCep };

    if (finalForm.padrao) {
      // Unset previous padrao
      await supabase.from('enderecos').update({ padrao: false }).eq('user_id', user.id);
    }

    let err;
    if (editingAddress === 'new') {
      const { error } = await supabase.from('enderecos').insert({ ...finalForm, user_id: user.id });
      err = error;
    } else {
      const { error } = await supabase.from('enderecos').update(finalForm).eq('id', editingAddress);
      err = error;
    }

    if (err) {
      console.error("Erro ao salvar endereço:", err);
      alert("Erro ao salvar endereço: " + err.message);
      return;
    }

    setEditingAddress(null);
    fetchData();
  };

  const handleDeleteAddress = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este endereço?")) return;

    const { error } = await supabase.from('enderecos').delete().eq('id', id);
    if (error) {
      alert("Erro ao excluir: " + error.message);
      return;
    }
    fetchData();
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setRecoveryLoading(true);

    // Atualiza a senha no Supabase usando a sessão atual
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      alert("Erro ao atualizar senha: " + error.message);
    } else {
      alert("Senha atualizada com sucesso!");
      setIsRecovery(false);
      // Remove os parâmetros sensíveis e de recovery da URL para limpar a tela
      window.history.replaceState(null, '', window.location.pathname);
    }
    setRecoveryLoading(false);
  };

  if (!user) return null;

  if (isRecovery) {
    return (
      <main className="min-h-screen bg-zinc-950 pt-24 pb-16 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-bold text-sand-400 mb-6 text-center">Criar Nova Senha</h2>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Nova Senha</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-sand-400"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={recoveryLoading}
              className="w-full bg-sand-400 hover:bg-sand-300 text-zinc-950 font-bold py-2 rounded transition-colors uppercase tracking-widest text-sm disabled:opacity-50 mt-4"
            >
              {recoveryLoading ? 'Salvando...' : 'Salvar Nova Senha'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 pt-24 pb-16 px-4">
      <div className="max-w-xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/" className="text-zinc-400 hover:text-sand-400 transition-colors">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold text-sand-400 tracking-wider">PERFIL</h1>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-4 mt-6">
          <div className="w-14 h-14 bg-zinc-900 rounded-full flex items-center justify-center text-sand-400 text-xl font-bold uppercase border border-zinc-800">
            {profile.nome.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-200">{profile.nome}</h2>
            <p className="text-sm text-zinc-500">{user.email} • via Email</p>
          </div>
        </div>

        {/* Telefone Section */}
        <div className="mt-8">
          {isEditingPhone ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Editar Telefone</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={phoneInput}
                  onChange={handlePhoneChange}
                  placeholder="(11) 99999-9999"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-sand-400"
                />
                <button onClick={handleSavePhone} className="p-2 bg-sand-400 text-zinc-950 rounded hover:bg-sand-300">
                  <Check size={18} />
                </button>
                <button onClick={() => setIsEditingPhone(false)} className="p-2 bg-zinc-800 text-zinc-400 rounded hover:text-zinc-200">
                  <X size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div onClick={() => setIsEditingPhone(true)} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between group hover:border-zinc-700 transition-colors cursor-pointer">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block">Telefone</span>
                <p className="text-zinc-300 text-sm font-medium">{profile.telefone || 'Adicionar telefone'}</p>
              </div>
              <Pencil size={16} className="text-zinc-500 group-hover:text-sand-400 transition-colors" />
            </div>
          )}
        </div>

        {/* Endereços Section */}
        <div className="mt-6">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 ml-1">Endereços</h3>

          <div className="space-y-3">
            {enderecos.map(end => (
              editingAddress === end.id ? null : (
                <div key={end.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-zinc-700 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-zinc-300 text-sm font-medium">{end.rua}, {end.numero}</p>
                      {end.padrao && (
                        <span className="text-[9px] font-bold text-sand-400 border border-sand-400/30 px-1.5 py-0.5 rounded-full uppercase">Padrão</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">CEP: {end.cep} • {end.bairro} • {end.cidade}</p>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button onClick={() => { setEditingAddress(end.id); setAddressForm(end); }} className="p-2 text-zinc-500 hover:text-sand-400 transition-colors">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDeleteAddress(end.id)} className="p-2 text-zinc-500 hover:text-red-400 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            ))}

            {editingAddress ? (
              <form onSubmit={handleSaveAddress} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
                <h4 className="text-sm font-bold text-sand-400">{editingAddress === 'new' ? 'Novo Endereço' : 'Editar Endereço'}</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">CEP *</label>
                    <input required value={addressForm.cep} onChange={handleCepChange} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-sand-400" placeholder="00000-000" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Rua *</label>
                    <input required value={addressForm.rua} onChange={e => setAddressForm({ ...addressForm, rua: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-sand-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Número *</label>
                    <input required value={addressForm.numero} onChange={e => setAddressForm({ ...addressForm, numero: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-sand-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Bairro</label>
                    <input value={addressForm.bairro} onChange={e => setAddressForm({ ...addressForm, bairro: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-sand-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Cidade *</label>
                    <input required value={addressForm.cidade} onChange={e => setAddressForm({ ...addressForm, cidade: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-sand-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">UF *</label>
                    <input required maxLength={2} value={addressForm.uf} onChange={e => setAddressForm({ ...addressForm, uf: e.target.value.toUpperCase() })} placeholder="SP" className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-sand-400" />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input type="checkbox" checked={addressForm.padrao} onChange={e => setAddressForm({ ...addressForm, padrao: e.target.checked })} className="accent-sand-400" />
                  <span className="text-sm text-zinc-300">Tornar este o endereço padrão</span>
                </label>

                <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                  <button type="button" onClick={() => setEditingAddress(null)} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-200 uppercase tracking-wider">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-sand-400 text-zinc-950 text-xs font-bold rounded hover:bg-sand-300 uppercase tracking-wider">Salvar</button>
                </div>
              </form>
            ) : (
              <button onClick={() => { setEditingAddress('new'); setAddressForm({ rua: '', numero: '', bairro: '', cidade: '', uf: '', cep: '', padrao: enderecos.length === 0 }); }} className="w-full flex items-center justify-center gap-2 border border-dashed border-zinc-800 hover:border-sand-400/50 rounded-xl p-4 text-zinc-400 hover:text-sand-400 text-xs font-bold uppercase tracking-widest transition-colors">
                <Plus size={16} /> Adicionar Endereço
              </button>
            )}
          </div>
        </div>

        {/* CPF Section */}
        <div className="mt-4">
          {isEditingCpf ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Editar CPF</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cpfInput}
                  onChange={handleCpfChange}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-sand-400"
                />
                <button onClick={handleSaveCpf} className="p-2 bg-sand-400 text-zinc-950 rounded hover:bg-sand-300">
                  <Check size={18} />
                </button>
                <button onClick={() => setIsEditingCpf(false)} className="p-2 bg-zinc-800 text-zinc-400 rounded hover:text-zinc-200">
                  <X size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div onClick={() => setIsEditingCpf(true)} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between group hover:border-zinc-700 transition-colors cursor-pointer">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 block">CPF <span className="text-zinc-600 normal-case">(necessário para envio)</span></span>
                <p className="text-zinc-300 text-sm font-medium">{profile.cpf || 'Adicionar CPF'}</p>
              </div>
              <Pencil size={16} className="text-zinc-500 group-hover:text-sand-400 transition-colors" />
            </div>
          )}
        </div>

        {/* Logout */}
        <div className="pt-8 flex justify-center">
          <button
            onClick={handleLogout}
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            sair da conta
          </button>
        </div>
      </div>
    </main>
  );
}
