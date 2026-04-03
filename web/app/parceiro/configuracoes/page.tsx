'use client';

import { useEffect, useState } from 'react';
import { Loader2, Building2, Settings, Save, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import api from '@/lib/api';

const TIPOS_OPERACAO = [
  { value: 'USINA_PROPRIA', label: 'Usina Solar Própria — Geração Distribuída' },
  { value: 'CONDOMINIO', label: 'Condomínio — Rateio de consumo' },
  { value: 'EMPRESA', label: 'Empresa — Uso comercial' },
  { value: 'CARREGADOR_VEICULAR', label: 'Carregador Veicular — EV Charging' },
] as const;

export default function ParceiroConfiguracoesPage() {
  const [cooperativa, setCooperativa] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    async function carregar() {
      try {
        const { data: me } = await api.get('/auth/me');
        if (me.cooperativaId) {
          const { data } = await api.get(`/cooperativas/${me.cooperativaId}`);
          setCooperativa(data);
        }
      } catch {
        // ignore
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  async function handleSalvar() {
    if (!cooperativa) return;
    setSalvando(true);
    setMensagem('');
    try {
      await api.put(`/cooperativas/${cooperativa.id}`, {
        nome: cooperativa.nome,
        email: cooperativa.email,
        telefone: cooperativa.telefone,
        endereco: cooperativa.endereco,
        tiposOperacao: cooperativa.tiposOperacao ?? [],
        multaAtraso: cooperativa.multaAtraso,
        jurosDiarios: cooperativa.jurosDiarios,
        diasCarencia: cooperativa.diasCarencia,
      });
      setMensagem('Configurações salvas com sucesso!');
    } catch {
      setMensagem('Erro ao salvar configurações.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!cooperativa) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        Não foi possível carregar dados do parceiro.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-1">Dados e configurações do seu parceiro</p>
      </div>

      {/* Dados do parceiro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Dados do Parceiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Nome</Label>
              <Input
                value={cooperativa.nome ?? ''}
                onChange={(e) => setCooperativa({ ...cooperativa, nome: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-sm">CNPJ</Label>
              <Input value={cooperativa.cnpj ?? ''} disabled className="bg-gray-50" />
            </div>
            <div>
              <Label className="text-sm">Email</Label>
              <Input
                value={cooperativa.email ?? ''}
                onChange={(e) => setCooperativa({ ...cooperativa, email: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-sm">Telefone</Label>
              <Input
                value={cooperativa.telefone ?? ''}
                onChange={(e) => setCooperativa({ ...cooperativa, telefone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label className="text-sm">Endereço</Label>
            <Input
              value={cooperativa.endereco ?? ''}
              onChange={(e) => setCooperativa({ ...cooperativa, endereco: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tipo de Operação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Tag className="w-4 h-4" /> Tipo de Operação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-3">Selecione todos os tipos que se aplicam ao seu parceiro</p>
          <div className="space-y-3">
            {TIPOS_OPERACAO.map((tipo) => {
              const selecionados: string[] = cooperativa.tiposOperacao ?? [];
              const checked = selecionados.includes(tipo.value);
              return (
                <div key={tipo.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`op-${tipo.value}`}
                    checked={checked}
                    onCheckedChange={(isChecked) => {
                      const updated = isChecked
                        ? [...selecionados, tipo.value]
                        : selecionados.filter((t) => t !== tipo.value);
                      setCooperativa({ ...cooperativa, tiposOperacao: updated });
                    }}
                  />
                  <Label htmlFor={`op-${tipo.value}`} className="text-sm cursor-pointer">
                    {tipo.label}
                  </Label>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Configuração financeira */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Settings className="w-4 h-4" /> Multa e Juros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm">Multa por Atraso (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={cooperativa.multaAtraso ?? ''}
                onChange={(e) => setCooperativa({ ...cooperativa, multaAtraso: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-sm">Juros Diários (%)</Label>
              <Input
                type="number"
                step="0.001"
                value={cooperativa.jurosDiarios ?? ''}
                onChange={(e) => setCooperativa({ ...cooperativa, jurosDiarios: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-sm">Dias de Carência</Label>
              <Input
                type="number"
                value={cooperativa.diasCarencia ?? ''}
                onChange={(e) => setCooperativa({ ...cooperativa, diasCarencia: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {mensagem && (
        <p className={`text-sm ${mensagem.includes('Erro') ? 'text-red-600' : 'text-green-600'}`}>
          {mensagem}
        </p>
      )}

      <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
        <Save className="w-4 h-4" />
        {salvando ? 'Salvando...' : 'Salvar Configurações'}
      </Button>
    </div>
  );
}
