'use client';

/**
 * Sprint Onboarding Bloco 0 Fatia 0.1 (06/06/2026).
 * Página própria de criação de PlanoClube (padrão Tipo B — decisão UX 17/05).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';

const TIERS = ['', 'BRONZE', 'PRATA', 'OURO', 'DIAMANTE'];

export default function NovoPlanoClubePage() {
  const router = useRouter();

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valorMensal, setValorMensal] = useState('0.00');
  const [cobra, setCobra] = useState(true);
  const [tierMinimo, setTierMinimo] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const valor = Number(valorMensal.replace(',', '.'));
      if (cobra && valor <= 0) {
        throw new Error('Quando "Cobra mensalidade" está ligado, o valor mensal deve ser maior que zero. Pra clube grátis, desligue.');
      }
      const r = await api.post('/plano-clube', {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        valorMensal: valor,
        cobra,
        tierMinimo: tierMinimo || undefined,
      });
      router.push(`/dashboard/clube/planos/${r.data.id}`);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? e?.message ?? 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <Link href="/dashboard/clube/planos" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Novo plano do Clube</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSalvar} className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome do plano *</Label>
              <Input
                id="nome"
                placeholder="Ex: Clube Ouro"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                minLength={2}
                maxLength={120}
              />
            </div>

            <div>
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Input
                id="descricao"
                placeholder="Ex: Acesso completo ao Clube de Vantagens"
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
                <p className="text-xs text-gray-500 mt-1">
                  Use 0,00 se for grátis (e desligue "Cobra mensalidade").
                </p>
              </div>

              <div>
                <Label htmlFor="tier">Tier mínimo (opcional)</Label>
                {/* Select nativo dentro de form: padrão 19/05 */}
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
              <Switch
                id="cobra"
                checked={cobra}
                onCheckedChange={setCobra}
              />
              <div className="flex-1">
                <Label htmlFor="cobra" className="cursor-pointer">
                  {cobra ? 'Cobra mensalidade' : 'Clube grátis (não cobra)'}
                </Label>
                <p className="text-xs text-gray-600 mt-1">
                  {cobra
                    ? 'A mensalidade entra na cobrança do cooperado (ou da empresa em convênio), discriminada e somada depois do desconto de energia.'
                    : 'Cooperados são matriculados sem gerar linha de cobrança. Use pra clube oferecido como benefício grátis.'}
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
              <Button type="submit" disabled={salvando || !nome.trim()} className="gap-2">
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {salvando ? 'Salvando…' : 'Criar plano'}
              </Button>
              <Link href="/dashboard/clube/planos">
                <Button type="button" variant="outline" disabled={salvando}>
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
