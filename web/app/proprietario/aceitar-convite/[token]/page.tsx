'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2,
  Sun,
  CheckCircle,
  AlertTriangle,
  Mail,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

interface DadosConvite {
  valido: boolean;
  motivo?: string;
  dados?: {
    usinaId: string;
    usinaNome: string;
    email: string;
    expiresAt: string;
  };
}

function calcularForca(senha: string): { nivel: 'fraca' | 'media' | 'forte'; cor: string } {
  if (senha.length < 8) return { nivel: 'fraca', cor: 'bg-red-400' };
  const temLetra = /[a-zA-Z]/.test(senha);
  const temNumero = /\d/.test(senha);
  const temEspecial = /[^a-zA-Z0-9]/.test(senha);
  const score = [senha.length >= 12, temLetra, temNumero, temEspecial].filter(Boolean).length;
  if (score <= 2) return { nivel: 'fraca', cor: 'bg-red-400' };
  if (score === 3) return { nivel: 'media', cor: 'bg-yellow-400' };
  return { nivel: 'forte', cor: 'bg-green-500' };
}

export default function AceitarConvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [validacao, setValidacao] = useState<DadosConvite | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sucesso, setSucesso] = useState<{ usinaNome: string } | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!token) return;
    api
      .get<DadosConvite>(`/proprietario/aceitar-convite/${token}`)
      .then((r) => setValidacao(r.data))
      .catch((e) => setValidacao({ valido: false, motivo: e?.response?.data?.message ?? 'Erro ao validar.' }))
      .finally(() => setCarregando(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');

    if (senha.length < 8) {
      setErro('Senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (!/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) {
      setErro('Senha deve conter ao menos 1 letra e 1 número.');
      return;
    }
    if (senha !== confirmar) {
      setErro('As senhas não conferem.');
      return;
    }

    setSubmitting(true);
    try {
      const r = await api.post<{ usuarioId: string; email: string; usinaNome: string }>(
        `/proprietario/aceitar-convite/${token}`,
        { senhaNova: senha },
      );
      setSucesso({ usinaNome: r.data.usinaNome });
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Falha ao aceitar convite.');
    } finally {
      setSubmitting(false);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  // Token inválido / expirado / usado
  if (!validacao?.valido) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-6 h-6" /> Convite inválido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-700">{validacao?.motivo ?? 'Token não encontrado ou expirado.'}</p>
            <p className="text-xs text-gray-500">
              Se você acredita que isso é um erro, peça pra a cooperativa enviar um novo convite.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sucesso
  if (sucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-6 h-6" /> Conta criada com sucesso!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-700">
              Sua conta proprietário foi criada. Você agora tem acesso ao painel da usina <strong>{sucesso.usinaNome}</strong>.
            </p>
            <Button className="w-full bg-amber-600 hover:bg-amber-700" onClick={() => router.push('/login')}>
              Fazer login agora
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Use o email do convite + a senha que você acabou de definir.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Form definir senha
  const dados = validacao.dados!;
  const forca = calcularForca(senha);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-100 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="w-6 h-6 text-amber-500" />
            Bem-vindo ao Portal Proprietário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4 text-sm">
            <p className="font-medium text-amber-900">
              Você está aceitando o convite para acessar dados da usina{' '}
              <span className="font-bold">{dados.usinaNome}</span>.
            </p>
            <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
              <Mail className="w-3 h-3" /> {dados.email}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="senha">Defina sua senha</Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres com letra e número"
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                  onClick={() => setMostrarSenha((v) => !v)}
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {senha.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    <div className={`h-1 flex-1 rounded ${forca.cor}`} />
                    <div className={`h-1 flex-1 rounded ${forca.nivel !== 'fraca' ? forca.cor : 'bg-gray-200'}`} />
                    <div className={`h-1 flex-1 rounded ${forca.nivel === 'forte' ? forca.cor : 'bg-gray-200'}`} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Força: {forca.nivel}</p>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="confirmar">Confirmar senha</Label>
              <Input
                id="confirmar"
                type={mostrarSenha ? 'text' : 'password'}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Repita a senha"
                required
              />
              {confirmar.length > 0 && confirmar !== senha && (
                <p className="text-xs text-red-500 mt-1">As senhas não conferem.</p>
              )}
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <Button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700"
              disabled={submitting || senha.length < 8 || senha !== confirmar}
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
              Criar conta e acessar painel
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Convite expira em {new Date(dados.expiresAt).toLocaleDateString('pt-BR')}.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
