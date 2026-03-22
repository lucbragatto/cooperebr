'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Settings, Loader2 } from 'lucide-react';
import type { ModeloCobrancaConfig, Usina } from '@/types';

type ModeloFormData = {
  ativo: boolean;
  escopo: 'COOPERATIVA' | 'USINA';
  usinaId: string | null;
  descontoBase: number;
  descontoMinimo: number | null;
  descontoMaximo: number | null;
  temPromocao: boolean;
  descontoPromocional: number | null;
  promocaoInicio: string | null;
  promocaoFim: string | null;
  temProgressivo: boolean;
  descontoProgressivo: number | null;
  progressivoAteCap: number | null;
  baseCalculo: 'TUSD_TE' | 'TOTAL_FATURA' | 'CONFIGURAVEL';
};

const modeloSchema = z.object({
  ativo: z.boolean(),
  escopo: z.enum(['COOPERATIVA', 'USINA']),
  usinaId: z.string().nullable(),
  descontoBase: z.coerce.number().min(0).max(100),
  descontoMinimo: z.coerce.number().min(0).max(100).nullable(),
  descontoMaximo: z.coerce.number().min(0).max(100).nullable(),
  temPromocao: z.boolean(),
  descontoPromocional: z.coerce.number().min(0).max(100).nullable(),
  promocaoInicio: z.string().nullable(),
  promocaoFim: z.string().nullable(),
  temProgressivo: z.boolean(),
  descontoProgressivo: z.coerce.number().min(0).max(100).nullable(),
  progressivoAteCap: z.coerce.number().min(0).max(100).nullable(),
  baseCalculo: z.enum(['TUSD_TE', 'TOTAL_FATURA', 'CONFIGURAVEL']),
});

const TIPO_LABELS: Record<string, string> = {
  FIXO_MENSAL: 'Fixo Mensal',
  CREDITOS_COMPENSADOS: 'Créditos Compensados',
  CREDITOS_DINAMICO: 'Créditos Dinâmico',
};

const BASE_CALCULO_LABELS: Record<string, string> = {
  TUSD_TE: 'TUSD + TE',
  TOTAL_FATURA: 'Total da Fatura',
  CONFIGURAVEL: 'Configurável',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().split('T')[0];
}

export default function ModelosCobrancaPage() {
  const [modelos, setModelos] = useState<ModeloCobrancaConfig[]>([]);
  const [usinas, setUsinas] = useState<Usina[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modeloAtual, setModeloAtual] = useState<ModeloCobrancaConfig | null>(null);
  const [salvando, setSalvando] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<ModeloFormData>({ resolver: zodResolver(modeloSchema) as any });

  const escopo = watch('escopo');
  const temPromocao = watch('temPromocao');
  const temProgressivo = watch('temProgressivo');
  const ativo = watch('ativo');

  const buscarDados = useCallback(async () => {
    try {
      const [modelosRes, usinasRes] = await Promise.all([
        api.get('/modelos-cobranca'),
        api.get('/usinas'),
      ]);
      setModelos(modelosRes.data);
      setUsinas(usinasRes.data);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscarDados();
  }, [buscarDados]);

  function abrirConfigurar(modelo: ModeloCobrancaConfig) {
    setModeloAtual(modelo);
    reset({
      ativo: modelo.ativo,
      escopo: modelo.escopo as 'COOPERATIVA' | 'USINA',
      usinaId: modelo.usinaId,
      descontoBase: Number(modelo.descontoBase),
      descontoMinimo: modelo.descontoMinimo != null ? Number(modelo.descontoMinimo) : null,
      descontoMaximo: modelo.descontoMaximo != null ? Number(modelo.descontoMaximo) : null,
      temPromocao: modelo.temPromocao,
      descontoPromocional:
        modelo.descontoPromocional != null ? Number(modelo.descontoPromocional) : null,
      promocaoInicio: formatDate(modelo.promocaoInicio),
      promocaoFim: formatDate(modelo.promocaoFim),
      temProgressivo: modelo.temProgressivo,
      descontoProgressivo:
        modelo.descontoProgressivo != null ? Number(modelo.descontoProgressivo) : null,
      progressivoAteCap:
        modelo.progressivoAteCap != null ? Number(modelo.progressivoAteCap) : null,
      baseCalculo: modelo.baseCalculo as 'TUSD_TE' | 'TOTAL_FATURA' | 'CONFIGURAVEL',
    });
    setSheetOpen(true);
  }

  async function onSubmit(formData: ModeloFormData) {
    if (!modeloAtual) return;
    setSalvando(true);
    try {
      const payload = {
        ...formData,
        usinaId: formData.escopo === 'USINA' ? formData.usinaId : null,
        descontoMinimo: formData.descontoMinimo ?? undefined,
        descontoMaximo: formData.descontoMaximo ?? undefined,
        descontoPromocional: formData.temPromocao ? formData.descontoPromocional : null,
        promocaoInicio: formData.temPromocao && formData.promocaoInicio
          ? new Date(formData.promocaoInicio).toISOString()
          : null,
        promocaoFim: formData.temPromocao && formData.promocaoFim
          ? new Date(formData.promocaoFim).toISOString()
          : null,
        descontoProgressivo: formData.temProgressivo ? formData.descontoProgressivo : null,
        progressivoAteCap: formData.temProgressivo ? formData.progressivoAteCap : null,
      };
      await api.put(`/modelos-cobranca/${modeloAtual.id}`, payload);
      setSheetOpen(false);
      buscarDados();
    } finally {
      setSalvando(false);
    }
  }

  function restaurarPadrao() {
    if (!modeloAtual) return;
    reset({
      ativo: true,
      escopo: 'COOPERATIVA',
      usinaId: null,
      descontoBase: 20,
      descontoMinimo: 15,
      descontoMaximo: 30,
      temPromocao: false,
      descontoPromocional: null,
      promocaoInicio: null,
      promocaoFim: null,
      temProgressivo: false,
      descontoProgressivo: null,
      progressivoAteCap: null,
      baseCalculo: 'TUSD_TE',
    });
  }

  if (carregando) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Modelos de Cobrança</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="py-8">
                <div className="space-y-3">
                  <div className="h-5 w-32 bg-gray-200 animate-pulse rounded" />
                  <div className="h-4 w-48 bg-gray-200 animate-pulse rounded" />
                  <div className="h-6 w-16 bg-gray-200 animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Modelos de Cobrança</h2>

      {modelos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Nenhum modelo de cobrança cadastrado. Configure os modelos no banco de dados.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {modelos.map((modelo) => (
            <Card key={modelo.id} className={!modelo.ativo ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{modelo.nome}</CardTitle>
                  <Badge variant={modelo.ativo ? 'default' : 'secondary'}>
                    {modelo.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {modelo.descricao && (
                  <p className="text-sm text-gray-500">{modelo.descricao}</p>
                )}

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tipo</span>
                    <span className="font-medium">{TIPO_LABELS[modelo.tipo] ?? modelo.tipo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Escopo</span>
                    <span className="font-medium">
                      {modelo.escopo === 'COOPERATIVA' ? 'Cooperativa toda' : 'Por usina'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Desconto</span>
                    <span className="font-medium">{Number(modelo.descontoBase)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Base</span>
                    <span className="font-medium text-xs">
                      {BASE_CALCULO_LABELS[modelo.baseCalculo] ?? modelo.baseCalculo}
                    </span>
                  </div>
                </div>

                <Sheet open={sheetOpen && modeloAtual?.id === modelo.id} onOpenChange={setSheetOpen}>
                  <SheetTrigger
                    render={
                      <Button
                        variant="outline"
                        className="w-full mt-2 gap-2"
                        onClick={() => abrirConfigurar(modelo)}
                      />
                    }
                  >
                    <Settings className="h-4 w-4" />
                    Configurar
                  </SheetTrigger>
                  <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Configurar: {modelo.nome}</SheetTitle>
                      <SheetDescription>
                        {TIPO_LABELS[modelo.tipo] ?? modelo.tipo}
                      </SheetDescription>
                    </SheetHeader>

                    <form onSubmit={handleSubmit(onSubmit)} className="px-4 space-y-5">
                      {/* Ativar/Desativar */}
                      <div className="flex items-center justify-between">
                        <Label>Ativo</Label>
                        <Switch
                          checked={ativo}
                          onCheckedChange={(val: boolean) => setValue('ativo', val)}
                        />
                      </div>

                      {/* Escopo */}
                      <div className="space-y-2">
                        <Label>Escopo</Label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              value="COOPERATIVA"
                              {...register('escopo')}
                              className="accent-green-600"
                            />
                            Toda cooperativa
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              value="USINA"
                              {...register('escopo')}
                              className="accent-green-600"
                            />
                            Usina específica
                          </label>
                        </div>
                        {escopo === 'USINA' && (
                          <select
                            {...register('usinaId')}
                            className="w-full border rounded-md px-3 py-2 text-sm"
                          >
                            <option value="">Selecione a usina</option>
                            {usinas.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.nome}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Desconto base */}
                      <div className="space-y-2">
                        <Label>Desconto base (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          {...register('descontoBase')}
                        />
                        {errors.descontoBase && (
                          <p className="text-xs text-red-500">{errors.descontoBase.message}</p>
                        )}
                      </div>

                      {/* Limites */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Desconto mínimo (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            {...register('descontoMinimo')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Desconto máximo (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            {...register('descontoMaximo')}
                          />
                        </div>
                      </div>

                      {/* Desconto promocional */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Desconto promocional</Label>
                          <Switch
                            checked={temPromocao}
                            onCheckedChange={(val: boolean) => setValue('temPromocao', val)}
                          />
                        </div>
                        {temPromocao && (
                          <div className="space-y-3 pl-1 border-l-2 border-green-200 ml-1">
                            <div className="space-y-2 pl-3">
                              <Label>Desconto promocional (%)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                {...register('descontoPromocional')}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3 pl-3">
                              <div className="space-y-2">
                                <Label>Data início</Label>
                                <Input type="date" {...register('promocaoInicio')} />
                              </div>
                              <div className="space-y-2">
                                <Label>Data fim</Label>
                                <Input type="date" {...register('promocaoFim')} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Desconto progressivo */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Desconto progressivo por produção</Label>
                          <Switch
                            checked={temProgressivo}
                            onCheckedChange={(val: boolean) => setValue('temProgressivo', val)}
                          />
                        </div>
                        {temProgressivo && (
                          <div className="space-y-3 pl-1 border-l-2 border-blue-200 ml-1">
                            <div className="space-y-2 pl-3">
                              <Label>Desconto progressivo (%)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                {...register('descontoProgressivo')}
                              />
                            </div>
                            <div className="space-y-2 pl-3">
                              <Label>Até atingir (% da capacidade)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                {...register('progressivoAteCap')}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Base de cálculo */}
                      <div className="space-y-2">
                        <Label>Base de cálculo</Label>
                        <select
                          {...register('baseCalculo')}
                          className="w-full border rounded-md px-3 py-2 text-sm"
                        >
                          <option value="TUSD_TE">TUSD + TE</option>
                          <option value="TOTAL_FATURA">Total da Fatura</option>
                          <option value="CONFIGURAVEL">Configurável</option>
                        </select>
                      </div>

                      <SheetFooter className="px-0 flex-row gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={restaurarPadrao}
                          className="flex-1"
                        >
                          Restaurar padrão
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setSheetOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={salvando} className="flex-1">
                          {salvando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                          Salvar
                        </Button>
                      </SheetFooter>
                    </form>
                  </SheetContent>
                </Sheet>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
