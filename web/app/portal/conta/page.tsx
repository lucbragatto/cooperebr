'use client';

import { useEffect, useState } from 'react';
import { getUsuario } from '@/lib/auth';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Lock, ShieldCheck } from 'lucide-react';

interface Cooperado {
  id: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  telefone: string | null;
  opcaoToken?: 'A' | 'B';
}

export default function PortalContaPage() {
  const usuario = getUsuario();
  const [cooperado, setCooperado] = useState<Cooperado | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Form dados pessoais
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msgDados, setMsgDados] = useState('');

  // Opção de benefício (Token A/B)
  const [opcaoToken, setOpcaoToken] = useState<'A' | 'B'>('A');
  const [salvandoOpcao, setSalvandoOpcao] = useState(false);
  const [msgOpcao, setMsgOpcao] = useState('');

  // Form alterar senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [msgSenha, setMsgSenha] = useState('');
  const [erroSenha, setErroSenha] = useState('');

  useEffect(() => {
    api
      .get('/cooperados/meu-perfil')
      .then((res) => {
        const c = res.data;
        setCooperado(c);
        setNome(c.nomeCompleto ?? '');
        setEmail(c.email ?? '');
        setTelefone(c.telefone ?? '');
        setOpcaoToken(c.opcaoToken ?? 'A');
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  async function handleSalvarDados(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMsgDados('');
    try {
      await api.put('/cooperados/meu-perfil', {
        nomeCompleto: nome,
        email,
        telefone: telefone || null,
      });
      setMsgDados('Dados atualizados com sucesso!');
    } catch {
      setMsgDados('Erro ao salvar dados. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarOpcaoToken(opcao: 'A' | 'B') {
    setSalvandoOpcao(true);
    setMsgOpcao('');
    try {
      await api.patch(`/cooperados/${cooperado?.id}`, { opcaoToken: opcao });
      setOpcaoToken(opcao);
      setMsgOpcao('Preferência salva!');
      setTimeout(() => setMsgOpcao(''), 3000);
    } catch {
      setMsgOpcao('Erro ao salvar preferência.');
    } finally {
      setSalvandoOpcao(false);
    }
  }

  async function handleAlterarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErroSenha('');
    setMsgSenha('');

    if (novaSenha.length < 6) {
      setErroSenha('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErroSenha('As senhas não coincidem.');
      return;
    }

    setSalvandoSenha(true);
    try {
      await api.post('/auth/alterar-senha', { senhaAtual, novaSenha });
      setMsgSenha('Senha alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch {
      setErroSenha('Senha atual incorreta ou erro ao alterar.');
    } finally {
      setSalvandoSenha(false);
    }
  }

  if (carregando) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800">Minha Conta</h1>

      {/* Dados pessoais */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
            <User className="w-4 h-4" />
            Dados pessoais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSalvarDados} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="h-11 text-base"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={cooperado?.cpf ?? usuario?.cpf ?? ''}
                disabled
                className="h-11 text-base bg-gray-50"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 text-base"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="h-11 text-base"
              />
            </div>

            {msgDados && (
              <p
                className={`text-sm px-3 py-2 rounded-lg ${
                  msgDados.includes('sucesso')
                    ? 'text-green-700 bg-green-50'
                    : 'text-red-600 bg-red-50'
                }`}
              >
                {msgDados}
              </p>
            )}

            <Button type="submit" className="w-full h-11" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Alterar senha */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Alterar senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAlterarSenha} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="senhaAtual">Senha atual</Label>
              <Input
                id="senhaAtual"
                type="password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                className="h-11 text-base"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="novaSenha">Nova senha</Label>
              <Input
                id="novaSenha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className="h-11 text-base"
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmarSenha">Confirmar nova senha</Label>
              <Input
                id="confirmarSenha"
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className="h-11 text-base"
                required
              />
            </div>

            {erroSenha && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erroSenha}</p>
            )}
            {msgSenha && (
              <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{msgSenha}</p>
            )}

            <Button type="submit" variant="outline" className="w-full h-11" disabled={salvandoSenha}>
              {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Opção de benefício CooperToken */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            🪙 Como desejo meu benefício
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-500">Escolha como deseja receber o benefício da sua cota de energia:</p>
          <div className="grid grid-cols-1 gap-3">
            {/* Opção A */}
            <button
              onClick={() => handleSalvarOpcaoToken('A')}
              disabled={salvandoOpcao}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                opcaoToken === 'A'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">💸</span>
                <span className="font-semibold text-sm text-gray-800">Opção A — Desconto direto</span>
                {opcaoToken === 'A' && <span className="ml-auto text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">Ativo</span>}
              </div>
              <p className="text-xs text-gray-500">Receba o desconto aplicado diretamente na sua mensalidade CoopereBR. Mais simples, economia imediata na fatura.</p>
            </button>

            {/* Opção B */}
            <button
              onClick={() => handleSalvarOpcaoToken('B')}
              disabled={salvandoOpcao}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                opcaoToken === 'B'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🪙</span>
                <span className="font-semibold text-sm text-gray-800">Opção B — Receber CooperTokens</span>
                {opcaoToken === 'B' && <span className="ml-auto text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">Ativo</span>}
              </div>
              <p className="text-xs text-gray-500">Pague o valor integral da mensalidade e receba tokens equivalentes ao desconto. Use no Clube de Vantagens: restaurantes, parceiros e muito mais.</p>
            </button>
          </div>
          {msgOpcao && (
            <p className={`text-xs px-3 py-2 rounded-lg ${msgOpcao.includes('Erro') ? 'text-red-600 bg-red-50' : 'text-green-700 bg-green-50'}`}>
              {msgOpcao}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recuperação */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-700">Recuperação de senha</p>
              <p className="text-xs text-gray-500 mt-1">
                Caso esqueça sua senha, você pode recuperá-la pelo email cadastrado ou via WhatsApp.
                Acesse a tela de login e clique em &quot;Esqueci minha senha&quot;.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
