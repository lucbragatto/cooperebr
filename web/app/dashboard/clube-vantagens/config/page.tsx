'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { getUsuario } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Save, Trophy } from 'lucide-react';

interface NivelConfig {
  nivel: string;
  kwhMinimo: number;
  kwhMaximo: number;
  beneficioPercentual: number;
  beneficioReaisKwh: number;
}

const DEFAULT_NIVEIS: NivelConfig[] = [
  { nivel: 'BRONZE', kwhMinimo: 0, kwhMaximo: 499, beneficioPercentual: 0, beneficioReaisKwh: 0 },
  { nivel: 'PRATA', kwhMinimo: 500, kwhMaximo: 1999, beneficioPercentual: 2, beneficioReaisKwh: 0 },
  { nivel: 'OURO', kwhMinimo: 2000, kwhMaximo: 4999, beneficioPercentual: 5, beneficioReaisKwh: 0 },
  { nivel: 'DIAMANTE', kwhMinimo: 5000, kwhMaximo: 999999, beneficioPercentual: 10, beneficioReaisKwh: 0 },
];

const NIVEL_EMOJI: Record<string, string> = {
  BRONZE: '🥉',
  PRATA: '🥈',
  OURO: '🥇',
  DIAMANTE: '💎',
};

export default function ClubeVantagensConfigPage() {
  const [ativo, setAtivo] = useState(false);
  const [criterio, setCriterio] = useState('KWH_INDICADO_ACUMULADO');
  const [niveis, setNiveis] = useState<NivelConfig[]>(DEFAULT_NIVEIS);
  const [bonusAniversario, setBonusAniversario] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const usuario = getUsuario() as any;
  const isSuperAdmin = usuario?.perfil === 'SUPER_ADMIN';
  const cooperativaIdFixa = usuario?.cooperativaId as string | undefined;

  const [cooperativas, setCooperativas] = useState<{ id: string; nome: string }[]>([]);
  const [cooperativaIdSelecionada, setCooperativaIdSelecionada] = useState('');

  const cooperativaId = cooperativaIdFixa || cooperativaIdSelecionada;

  useEffect(() => {
    if (isSuperAdmin && !cooperativaIdFixa) {
      api.get('/cooperativas').then((r) => setCooperativas(r.data || [])).catch(() => {});
    }
  }, [isSuperAdmin, cooperativaIdFixa]);

  useEffect(() => {
    if (!cooperativaId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const params = isSuperAdmin ? `?cooperativaId=${cooperativaId}` : '';
    api.get(`/clube-vantagens/config${params}`)
      .then((res) => {
        if (res.data) {
          setAtivo(res.data.ativo);
          setCriterio(res.data.criterio || 'KWH_INDICADO_ACUMULADO');
          setBonusAniversario(res.data.bonusAniversario || 0);
          if (Array.isArray(res.data.niveisConfig) && res.data.niveisConfig.length > 0) {
            setNiveis(res.data.niveisConfig);
          }
        }
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [cooperativaId, isSuperAdmin]);

  const salvar = async () => {
    if (!cooperativaId) {
      setMensagem('Selecione uma cooperativa antes de salvar.');
      return;
    }
    setSalvando(true);
    setMensagem('');
    try {
      await api.put('/clube-vantagens/config', {
        ativo,
        criterio,
        niveisConfig: niveis,
        bonusAniversario,
        ...(isSuperAdmin ? { cooperativaId } : {}),
      });
      setMensagem('Configuração salva com sucesso!');
      setTimeout(() => setMensagem(''), 3000);
    } catch {
      setMensagem('Erro ao salvar configuração.');
    } finally {
      setSalvando(false);
    }
  };

  const atualizarNivel = (index: number, campo: keyof NivelConfig, valor: string) => {
    setNiveis((prev) => {
      const copia = [...prev];
      (copia[index] as any)[campo] = campo === 'nivel' ? valor : Number(valor);
      return copia;
    });
  };

  if (carregando) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-500" />
          Clube de Vantagens
        </h2>
        <Button onClick={salvar} disabled={salvando}>
          <Save className="h-4 w-4 mr-2" />
          {salvando ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      {isSuperAdmin && !cooperativaIdFixa && (
        <Card>
          <CardContent className="pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Selecione a cooperativa</label>
            <select
              value={cooperativaIdSelecionada}
              onChange={(e) => setCooperativaIdSelecionada(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">-- Selecione --</option>
              {cooperativas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {mensagem && (
        <div className={`p-3 rounded-lg text-sm ${mensagem.includes('sucesso') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {mensagem}
        </div>
      )}

      {/* Toggle ativar/desativar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800">Ativar Clube de Vantagens</p>
              <p className="text-sm text-gray-500">
                Habilita o sistema de tiers e progressão por indicações
              </p>
            </div>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </CardContent>
      </Card>

      {/* Critério de progressão */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Critério de Progressão</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={criterio}
            onChange={(e) => setCriterio(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="KWH_INDICADO_ACUMULADO">kWh indicado acumulado</option>
            <option value="NUMERO_INDICADOS_ATIVOS">Número de indicados ativos</option>
            <option value="RECEITA_INDICADOS">Receita dos indicados (R$)</option>
          </select>
        </CardContent>
      </Card>

      {/* Tabela de níveis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração dos Níveis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Nível</th>
                  <th className="text-left py-2 px-2">kWh Mínimo</th>
                  <th className="text-left py-2 px-2">kWh Máximo</th>
                  <th className="text-left py-2 px-2">Benefício %</th>
                  <th className="text-left py-2 px-2">R$/kWh</th>
                </tr>
              </thead>
              <tbody>
                {niveis.map((n, i) => (
                  <tr key={n.nivel} className="border-b last:border-0">
                    <td className="py-2 px-2">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span>{NIVEL_EMOJI[n.nivel]}</span>
                        {n.nivel}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        value={n.kwhMinimo}
                        onChange={(e) => atualizarNivel(i, 'kwhMinimo', e.target.value)}
                        className="w-28"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        value={n.kwhMaximo}
                        onChange={(e) => atualizarNivel(i, 'kwhMaximo', e.target.value)}
                        className="w-28"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        step="0.1"
                        value={n.beneficioPercentual}
                        onChange={(e) => atualizarNivel(i, 'beneficioPercentual', e.target.value)}
                        className="w-24"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={n.beneficioReaisKwh}
                        onChange={(e) => atualizarNivel(i, 'beneficioReaisKwh', e.target.value)}
                        className="w-24"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bônus aniversário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bônus de Aniversário</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              step="0.1"
              value={bonusAniversario}
              onChange={(e) => setBonusAniversario(Number(e.target.value))}
              className="w-32"
            />
            <span className="text-sm text-gray-500">% de bônus extra no mês de aniversário do cooperado</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
