'use client';

/**
 * Sprint Onboarding Bloco 0 Fatia 0.1 (06/06/2026).
 * Página própria de edição/desativação de PlanoClube.
 */
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';

const TIERS = ['', 'BRONZE', 'PRATA', 'OURO', 'DIAMANTE'];

interface PlanoClube {
  id: string;
  nome: string;
  descricao: string | null;
  valorMensal: string;
  cobra: boolean;
  ativo: boolean;
  tierMinimo: string | null;
}

export default function EditarPlanoClubePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string;

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [plano, setPlano] = useState<PlanoClube | null>(null);

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valorMensal, setValorMensal] = useState('0.00');
  const [cobra, setCobra] = useState(true);
  const [tierMinimo, setTierMinimo] = useState('');
  const [ativo, setAtivo] = useState(true);

  const [salvando, setSalvando] = useState(false);
  const [desativando, setDesativando] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .get<PlanoClube>(`/plano-clube/${id}`)
      .then((r) => {
        setPlano(r.data);
        setNome(r.data.nome);
        setDescricao(r.data.descricao ?? '');
        setValorMensal(String(r.data.valorMensal));
        setCobra(r.data.cobra);
        setTierMinimo(r.data.tierMinimo ?? '');
        setAtivo(r.data.ativo);
      })
      .catch((e) => setErro(e?.response?.data?.message ?? e?.message ?? 'Erro ao carregar'))
      .finally(() => setCarregando(false));
  }, [id]);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const valor = Number(valorMensal.replace(',', '.'));
      if (cobra && valor <= 0) {
        throw new Error('Quando "Cobra mensalidade" está ligado, o valor mensal deve ser maior que zero.');
      }
      await api.patch(`/plano-clube/${id}`, {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        valorMensal: valor,
        cobra,
        ativo,
        tierMinimo: tierMinimo || null,
      });
      router.push('/dashboard/clube/planos');
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? e?.message ?? 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function handleDesativar() {
    if (!confirm('Desativar este plano? Ele deixa de aparecer pra novas adesões. Cobranças passadas e atuais continuam intactas.')) return;
    setErro(null);
    setDesativando(true);
    try {
      await api.delete(`/plano-clube/${id}`);
      router.push('/dashboard/clube/planos');
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? e?.message ?? 'Erro ao desativar');
    } finally {
      setDesativando(false);
    }
  }

  if (carregando) {
    return <div className="p-6 text-gray-500">Carregando…</div>;
  }

  if (!plano) {
    return (
      <div className="p-6">
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 text-red-800 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-medium">Plano não encontrado</p>
              {erro && <p className="text-sm">{erro}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <Link href="/dashboard/clube/planos" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Editar plano do Clube</span>
            {!ativo && <Badge variant="outline" className="text-gray-500">Inativo</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSalvar} className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome do plano *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                minLength={2}
                maxLength={120}
              />
            </div>

            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                maxLength={500}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="valor">Valor mensal (R$) *</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  max="999999.99"
                  value={valorMensal}
                  onChange={(e) => setValorMensal(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="tier">Tier mínimo</Label>
                <select
                  id="tier"
                  className="w-full h-10 border border-gray-300 rounded-md px-3 text-sm"
                  value={tierMinimo}
                  onChange={(e) => setTierMinimo(e.target.value)}
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>{t || '(nenhum)'}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-3">
              <Switch id="cobra" checked={cobra} onCheckedChange={setCobra} />
              <div className="flex-1">
                <Label htmlFor="cobra" className="cursor-pointer">
                  {cobra ? 'Cobra mensalidade' : 'Clube grátis (não cobra)'}
                </Label>
                <p className="text-xs text-gray-600 mt-1">
                  {cobra
                    ? 'A mensalidade entra na cobrança discriminada após desconto de energia.'
                    : 'Matricula sem gerar linha de cobrança.'}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex items-start gap-3">
              <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
              <div className="flex-1">
                <Label htmlFor="ativo" className="cursor-pointer">
                  {ativo ? 'Plano ativo' : 'Plano inativo'}
                </Label>
                <p className="text-xs text-gray-600 mt-1">
                  Plano inativo não aparece pra novas adesões, mas vínculos existentes seguem intactos.
                </p>
              </div>
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2 text-sm text-red-800">
                <AlertCircle className="w-5 h-5 mt-0.5" />
                {erro}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={salvando || desativando || !nome.trim()} className="gap-2">
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {salvando ? 'Salvando…' : 'Salvar alterações'}
              </Button>
              <Link href="/dashboard/clube/planos">
                <Button type="button" variant="outline" disabled={salvando || desativando}>
                  Cancelar
                </Button>
              </Link>
              {ativo && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDesativar}
                  disabled={salvando || desativando}
                  className="ml-auto text-red-700 border-red-300 hover:bg-red-50 gap-2"
                >
                  {desativando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {desativando ? 'Desativando…' : 'Desativar'}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
