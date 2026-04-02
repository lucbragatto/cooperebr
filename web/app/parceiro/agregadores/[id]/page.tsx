'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowLeft, UserPlus, CheckCircle } from 'lucide-react';

interface AgregadorDetalhe {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  email: string;
  telefone: string;
  responsavelNome: string;
  ativo: boolean;
  createdAt: string;
}

interface UsuarioAgregador {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
}

export default function AgregadorDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const [agregador, setAgregador] = useState<AgregadorDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [usuarioAdmin, setUsuarioAdmin] = useState<UsuarioAgregador | null>(null);
  const [buscandoUsuario, setBuscandoUsuario] = useState(true);

  // Form criar acesso
  const [mostrarForm, setMostrarForm] = useState(false);
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSenha, setFormSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    api.get<AgregadorDetalhe>(`/administradoras/${params.id}`)
      .then(r => setAgregador(r.data))
      .catch(() => router.push('/parceiro/agregadores'))
      .finally(() => setCarregando(false));
  }, [params.id, router]);

  useEffect(() => {
    // Buscar se existe usuário admin vinculado a esse agregador
    api.get<UsuarioAgregador[]>('/auth/usuarios')
      .then(r => {
        const usuarios = r.data;
        const admin = usuarios.find((u: any) => u.administradoraId === params.id && u.perfil === 'AGREGADOR');
        setUsuarioAdmin(admin ?? null);
      })
      .catch(() => {})
      .finally(() => setBuscandoUsuario(false));
  }, [params.id]);

  async function criarAcesso() {
    if (!formNome || !formEmail || !formSenha) {
      setErro('Preencha todos os campos.');
      return;
    }
    if (formSenha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setSalvando(true);
    setErro('');
    setSucesso('');
    try {
      const { data } = await api.post('/auth/criar-usuario-agregador', {
        nome: formNome,
        email: formEmail,
        senha: formSenha,
        administradoraId: params.id,
      });
      setUsuarioAdmin(data);
      setMostrarForm(false);
      setSucesso('Usuário de acesso criado com sucesso!');
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Erro ao criar usuário');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <p className="text-sm text-gray-500 py-8 text-center">Carregando...</p>;
  }

  if (!agregador) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">{agregador.razaoSocial}</h1>
        {agregador.nomeFantasia && <span className="text-gray-500">({agregador.nomeFantasia})</span>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do Agregador</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Razão Social</p>
              <p className="font-medium">{agregador.razaoSocial}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">CNPJ</p>
              <p className="font-medium">{agregador.cnpj}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">{agregador.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Telefone</p>
              <p className="font-medium">{agregador.telefone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Responsável</p>
              <p className="font-medium">{agregador.responsavelNome}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge className={agregador.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                {agregador.ativo ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção: Usuário de Acesso */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuário de Acesso</CardTitle>
        </CardHeader>
        <CardContent>
          {buscandoUsuario ? (
            <p className="text-sm text-gray-500">Verificando...</p>
          ) : usuarioAdmin ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-gray-800">{usuarioAdmin.nome}</p>
                <p className="text-sm text-gray-500">{usuarioAdmin.email}</p>
              </div>
              <Badge className={usuarioAdmin.ativo ? 'bg-green-100 text-green-800 ml-auto' : 'bg-gray-100 text-gray-600 ml-auto'}>
                {usuarioAdmin.ativo ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-3">Nenhum usuário de acesso cadastrado para este agregador.</p>
              {!mostrarForm ? (
                <Button onClick={() => setMostrarForm(true)} size="sm">
                  <UserPlus className="h-4 w-4 mr-2" /> Criar acesso
                </Button>
              ) : (
                <div className="space-y-3 max-w-md">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Nome *</label>
                    <Input value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Nome do usuário" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Email *</label>
                    <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@exemplo.com" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Senha *</label>
                    <Input type="password" value={formSenha} onChange={e => setFormSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
                  </div>
                  {erro && <p className="text-sm text-red-600">{erro}</p>}
                  <div className="flex gap-2">
                    <Button onClick={criarAcesso} disabled={salvando} size="sm">
                      {salvando ? 'Criando...' : 'Criar usuário'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setMostrarForm(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          )}
          {sucesso && <p className="text-sm text-green-600 mt-3">{sucesso}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
