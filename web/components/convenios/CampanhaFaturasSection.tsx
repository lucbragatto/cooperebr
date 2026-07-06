'use client';

/**
 * Sprint Máscara de e-mail por convênio (06/07/2026).
 *
 * Seção admin do convênio pra:
 *  - Configurar o alias de campanha (`<localMailbox>+<sufixo>@<domain>`).
 *  - Ver contador de faturas capturadas (N · Σ kWh · Σ R$).
 *  - Ver tabela com status de cada fatura + botões DESCARTAR / VINCULAR.
 *
 * Regra 19/05 — help inline obrigatório (Luciano não programa).
 * Ícones/emojis alinham com o padrão de outras seções (📥 fatura, ⚠️ erro).
 */

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Mail, Info, Loader2 } from 'lucide-react';

interface RegistroCampanha {
  id: string;
  status: 'RECEBIDA' | 'OCR_OK' | 'OCR_FALHOU' | 'VINCULADA' | 'DESCARTADA';
  emailRemetente: string;
  emailAssunto: string | null;
  nomeExtraido: string | null;
  cpfExtraido: string | null;
  numeroUC: string | null;
  distribuidora: string | null;
  consumoMedioKwh: number | string | null;
  valorFatura: number | string | null;
  createdAt: string;
  vinculadoCooperado: { id: string; nomeCompleto: string } | null;
}

interface DadosCampanha {
  convenio: {
    id: string;
    empresaNome: string;
    emailAliasCampanha: string | null;
    previewAlias: string | null;
    previewLocalPart: string | null;
    previewDomain: string | null;
  };
  agregados: {
    total: number;
    totalAgregaveis: number;
    somaKwh: number;
    somaValor: number;
  };
  registros: RegistroCampanha[];
}

const STATUS_CFG: Record<RegistroCampanha['status'], { label: string; color: string }> = {
  RECEBIDA: { label: 'Recebida', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  OCR_OK: { label: 'OCR OK', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  OCR_FALHOU: { label: 'OCR falhou', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  VINCULADA: { label: 'Vinculada', color: 'bg-green-100 text-green-800 border-green-300' },
  DESCARTADA: { label: 'Descartada', color: 'bg-red-50 text-red-700 border-red-200' },
};

function formatarMoeda(n: number | string | null): string {
  const v = n === null || n === undefined ? 0 : Number(n);
  if (!Number.isFinite(v) || v === 0) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Props {
  convenioId: string;
  onAliasSalvo?: () => void;
}

export function CampanhaFaturasSection({ convenioId, onAliasSalvo }: Props) {
  const [dados, setDados] = useState<DadosCampanha | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aliasEdit, setAliasEdit] = useState('');
  const [salvandoAlias, setSalvandoAlias] = useState(false);
  const [erroAlias, setErroAlias] = useState<string | null>(null);
  const [msgAlias, setMsgAlias] = useState<string | null>(null);
  const [acaoRegistro, setAcaoRegistro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await api.get<DadosCampanha>(`/convenios/${convenioId}/faturas-campanha`);
      setDados(r.data);
      setAliasEdit(r.data.convenio.emailAliasCampanha ?? '');
    } catch {
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [convenioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarAlias() {
    const valor = aliasEdit.trim().toLowerCase();
    setErroAlias(null);
    setMsgAlias(null);
    if (valor && !/^[a-z0-9-]{2,30}$/.test(valor)) {
      setErroAlias('Alias inválido: minúsculas + números + hifens, 2 a 30 caracteres.');
      return;
    }
    setSalvandoAlias(true);
    try {
      await api.patch(`/convenios/${convenioId}`, { emailAliasCampanha: valor || '' });
      setMsgAlias(valor ? 'Alias configurado.' : 'Alias removido.');
      await carregar();
      onAliasSalvo?.();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Erro ao salvar alias.';
      setErroAlias(String(message ?? 'Erro ao salvar alias.'));
    } finally {
      setSalvandoAlias(false);
    }
  }

  async function acao(fid: string, status: 'DESCARTADA' | 'VINCULADA') {
    if (status === 'VINCULADA') {
      const cooperadoId = window.prompt(
        'ID do cooperado pra vincular esta fatura (crie o cadastro real primeiro):',
      );
      if (!cooperadoId || !cooperadoId.trim()) return;
      setAcaoRegistro(fid);
      try {
        await api.patch(`/convenios/${convenioId}/faturas-campanha/${fid}`, {
          status: 'VINCULADA',
          cooperadoId: cooperadoId.trim(),
        });
        await carregar();
      } catch (err: unknown) {
        const message =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : 'Erro ao vincular.';
        window.alert(String(message ?? 'Erro ao vincular.'));
      } finally {
        setAcaoRegistro(null);
      }
      return;
    }
    if (!window.confirm('Descartar esta fatura de campanha? A ação é definitiva.')) return;
    setAcaoRegistro(fid);
    try {
      await api.patch(`/convenios/${convenioId}/faturas-campanha/${fid}`, { status: 'DESCARTADA' });
      await carregar();
    } catch {
      window.alert('Erro ao descartar.');
    } finally {
      setAcaoRegistro(null);
    }
  }

  if (carregando) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-slate-600" />
            Campanha de faturas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        </CardContent>
      </Card>
    );
  }
  if (!dados) return null;

  const { convenio, agregados, registros } = dados;
  const previewFinal =
    convenio.previewAlias
      ?? (aliasEdit.trim() && convenio.previewLocalPart && convenio.previewDomain
        ? `${convenio.previewLocalPart}+${aliasEdit.trim().toLowerCase()}@${convenio.previewDomain}`
        : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4 text-slate-600" />
          Campanha de faturas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Help inline (regra 19/05) */}
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p>
              <strong>O que é</strong> — a máscara é um endereço "apelido" da caixa da CoopereBR.
              Peça pros funcionários da <em>{convenio.empresaNome}</em> mandarem a fatura
              de energia pra esse endereço; nós capturamos, extraímos os dados e mostramos
              agregado aqui pra dimensionar a campanha.
            </p>
            <p className="mt-1">
              <strong>Como usar</strong> — escreva um sufixo curto (ex: <code>{convenio.emailAliasCampanha ?? 'mule'}</code>).
              O endereço final fica <code>{previewFinal ?? '<seu-alias>@<caixa>'}</code>.
            </p>
          </div>
        </div>

        {/* Config do alias */}
        <div className="space-y-2">
          <Label className="text-xs">Sufixo do alias</Label>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              value={aliasEdit}
              onChange={(e) => setAliasEdit(e.target.value)}
              placeholder="mule"
              maxLength={30}
              className="max-w-xs"
            />
            <span className="text-sm text-gray-600 font-mono">
              {previewFinal ?? '(salve pra gerar o endereço)'}
            </span>
            <Button size="sm" onClick={salvarAlias} disabled={salvandoAlias}>
              {salvandoAlias ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
          {erroAlias && <p className="text-sm text-red-600">{erroAlias}</p>}
          {msgAlias && <p className="text-sm text-green-700">{msgAlias}</p>}
        </div>

        {/* Contador */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-gray-500">Faturas recebidas</p>
            <p className="text-2xl font-semibold">{agregados.total}</p>
            <p className="text-[11px] text-gray-500 mt-1">
              {agregados.totalAgregaveis} com OCR válido
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-gray-500">Σ Consumo</p>
            <p className="text-2xl font-semibold">
              {agregados.somaKwh.toLocaleString('pt-BR')} kWh
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-gray-500">Σ Valor faturado</p>
            <p className="text-2xl font-semibold">{formatarMoeda(agregados.somaValor)}</p>
          </div>
        </div>

        {/* Tabela */}
        {registros.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma fatura recebida ainda. Divulgue o endereço acima pra RH da empresa.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recebida em</TableHead>
                <TableHead>Nome (OCR)</TableHead>
                <TableHead>UC</TableHead>
                <TableHead className="text-right">Consumo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.map((r) => {
                const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.RECEBIDA;
                const finalizada = r.status === 'DESCARTADA' || r.status === 'VINCULADA';
                return (
                  <TableRow key={r.id} className={finalizada ? 'opacity-60' : ''}>
                    <TableCell className="text-xs">
                      {new Date(r.createdAt).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.nomeExtraido ?? <span className="text-gray-400">—</span>}
                      {r.vinculadoCooperado && (
                        <span className="ml-1 text-xs text-green-700">
                          → {r.vinculadoCooperado.nomeCompleto}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {r.numeroUC ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.consumoMedioKwh
                        ? `${Number(r.consumoMedioKwh).toLocaleString('pt-BR')} kWh`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatarMoeda(r.valorFatura)}
                    </TableCell>
                    <TableCell>
                      <Badge className={cfg.color}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={finalizada || acaoRegistro === r.id}
                        onClick={() => acao(r.id, 'VINCULADA')}
                      >
                        Vincular
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={finalizada || acaoRegistro === r.id}
                        onClick={() => acao(r.id, 'DESCARTADA')}
                      >
                        Descartar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
