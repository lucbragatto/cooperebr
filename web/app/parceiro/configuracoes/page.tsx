'use client';

import { useEffect, useState } from 'react';
import { Loader2, Building2, Settings, Save, Tag, Coins } from 'lucide-react';
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

interface TokenConfig {
  modoGeracao: string;
  modeloVida: string;
  limiteTokenMensal: number | null;
  valorTokenReais: number;
  descontoMaxPerc: number;
  tetoCoop: number | null;
  ativo: boolean;
}

const TOKEN_DEFAULTS: TokenConfig = {
  modoGeracao: 'AMBOS',
  modeloVida: 'AMBOS',
  limiteTokenMensal: null,
  valorTokenReais: 0.45,
  descontoMaxPerc: 30,
  tetoCoop: null,
  ativo: true,
};

export default function ParceiroConfiguracoesPage() {
  const [cooperativa, setCooperativa] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  // CooperToken config
  const [tokenConfig, setTokenConfig] = useState<TokenConfig>(TOKEN_DEFAULTS);
  const [salvandoToken, setSalvandoToken] = useState(false);
  const [mensagemToken, setMensagemToken] = useState('');

  useEffect(() => {
    async function carregar() {
      try {
        const { data: me } = await api.get('/auth/me');
        if (me.cooperativaId) {
          const [coopRes, tokenRes] = await Promise.all([
            api.get(`/cooperativas/${me.cooperativaId}`),
            api.get('/cooper-token/admin/config').catch(() => ({ data: null })),
          ]);
          setCooperativa(coopRes.data);
          if (tokenRes.data) {
            setTokenConfig({
              modoGeracao: tokenRes.data.modoGeracao ?? 'AMBOS',
              modeloVida: tokenRes.data.modeloVida ?? 'AMBOS',
              limiteTokenMensal: tokenRes.data.limiteTokenMensal ?? null,
              valorTokenReais: Number(tokenRes.data.valorTokenReais ?? 0.45),
              descontoMaxPerc: Number(tokenRes.data.descontoMaxPerc ?? 30),
              tetoCoop: tokenRes.data.tetoCoop ?? null,
              ativo: tokenRes.data.ativo ?? true,
            });
          }
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

  async function handleSalvarToken() {
    setSalvandoToken(true);
    setMensagemToken('');
    try {
      await api.put('/cooper-token/admin/config', {
        modoGeracao: tokenConfig.modoGeracao,
        modeloVida: tokenConfig.modeloVida,
        limiteTokenMensal: tokenConfig.limiteTokenMensal || null,
        valorTokenReais: tokenConfig.valorTokenReais,
        descontoMaxPerc: tokenConfig.descontoMaxPerc,
        tetoCoop: tokenConfig.tetoCoop || null,
        ativo: tokenConfig.ativo,
      });
      setMensagemToken('Configuracao CooperToken salva com sucesso!');
    } catch {
      setMensagemToken('Erro ao salvar configuracao CooperToken.');
    } finally {
      setSalvandoToken(false);
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

      {/* CooperToken */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-600" /> CooperToken
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={tokenConfig.ativo}
              onClick={() => setTokenConfig({ ...tokenConfig, ativo: !tokenConfig.ativo })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${tokenConfig.ativo ? 'bg-green-600' : 'bg-gray-200'}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${tokenConfig.ativo ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm text-gray-700">
              {tokenConfig.ativo ? 'CooperToken ativo' : 'CooperToken desativado'}
            </span>
          </div>

          {tokenConfig.ativo && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Modo de Geracao</Label>
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={tokenConfig.modoGeracao}
                    onChange={(e) => setTokenConfig({ ...tokenConfig, modoGeracao: e.target.value })}
                  >
                    <option value="PRE_COMPRA">Pre-Compra</option>
                    <option value="COTA_MENSAL">Cota Mensal</option>
                    <option value="AMBOS">Ambos</option>
                  </select>
                </div>
                <div>
                  <Label className="text-sm">Modelo de Vida</Label>
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={tokenConfig.modeloVida}
                    onChange={(e) => setTokenConfig({ ...tokenConfig, modeloVida: e.target.value })}
                  >
                    <option value="EXPIRACAO_29D">Expiracao 29 dias (decay escalonado)</option>
                    <option value="DECAY_CONTINUO">Decay continuo (0.3%/dia)</option>
                    <option value="AMBOS">Ambos (cooperado escolhe)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Valor do Token (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={tokenConfig.valorTokenReais}
                    onChange={(e) => setTokenConfig({ ...tokenConfig, valorTokenReais: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-sm">Desconto Maximo por Fatura (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={tokenConfig.descontoMaxPerc}
                    onChange={(e) => setTokenConfig({ ...tokenConfig, descontoMaxPerc: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Limite Mensal de Tokens (opcional)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={tokenConfig.limiteTokenMensal ?? ''}
                    onChange={(e) => setTokenConfig({ ...tokenConfig, limiteTokenMensal: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Sem limite"
                  />
                </div>
                <div>
                  <Label className="text-sm">Teto de Saldo por Cooperado (opcional)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={tokenConfig.tetoCoop ?? ''}
                    onChange={(e) => setTokenConfig({ ...tokenConfig, tetoCoop: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Sem teto"
                  />
                </div>
              </div>
            </>
          )}

          {mensagemToken && (
            <p className={`text-sm ${mensagemToken.includes('Erro') ? 'text-red-600' : 'text-green-600'}`}>
              {mensagemToken}
            </p>
          )}

          <Button onClick={handleSalvarToken} disabled={salvandoToken} className="gap-2">
            <Save className="w-4 h-4" />
            {salvandoToken ? 'Salvando...' : 'Salvar CooperToken'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
