'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle, Clock, ExternalLink, Loader2, Zap } from 'lucide-react';

interface FaturaItem {
  id: string;
  mesReferencia: string | null;
  dadosExtraidos: {
    titular?: string;
    numeroUC?: string;
    totalAPagar?: number;
    consumoAtualKwh?: number;
    creditosRecebidosKwh?: number;
    saldoTotalKwh?: number;
    [key: string]: unknown;
  };
  status: string;
  statusRevisao: string;
  createdAt: string;
  uc: { id: string; numeroUC: string } | null;
}

interface DadosFaturas {
  emailFaturasAtivo: boolean;
  emailFaturasAtivoEm: string | null;
  faturas: FaturaItem[];
}

export default function PortalFaturasConcessionariaPage() {
  const [dados, setDados] = useState<DadosFaturas | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get('/faturas/minhas-concessionaria')
      .then((res) => setDados(res.data))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
        <Zap className="h-5 w-5 text-green-600" />
        Faturas da Concessionaria
      </h1>

      {/* Status do recebimento automatico */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            Recebimento automatico de faturas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dados?.emailFaturasAtivo ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">Ativo</p>
                <p className="text-xs text-green-600">
                  Ultima fatura recebida em{' '}
                  {dados.emailFaturasAtivoEm
                    ? new Date(dados.emailFaturasAtivoEm).toLocaleDateString('pt-BR')
                    : '—'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <Clock className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Aguardando ativacao</p>
                <p className="text-xs text-yellow-600">
                  Siga as instrucoes abaixo para ativar o recebimento automatico.
                </p>
              </div>
            </div>
          )}

          {/* Instrucao */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-blue-800 mb-2">
              Como ativar o recebimento automatico:
            </p>
            <ol className="text-xs text-blue-700 space-y-1.5 list-decimal list-inside">
              <li>Acesse o site da EDP pelo botao abaixo</li>
              <li>Faca login com seus dados de titular da conta de luz</li>
              <li>
                Cadastre o e-mail{' '}
                <span className="font-mono font-bold bg-blue-100 px-1.5 py-0.5 rounded">
                  contato@cooperebr.com.br
                </span>{' '}
                como destinatario da 2a via digital
              </li>
              <li>Pronto! Suas faturas serao recebidas e processadas automaticamente</li>
            </ol>
            <a
              href="https://www.edp.com.br/es/residencial/servicos/segunda-via-de-conta"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="mt-3 text-blue-700 border-blue-300 hover:bg-blue-100">
                <ExternalLink className="h-4 w-4 mr-2" />
                Acessar site da EDP
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Historico de faturas recebidas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Historico de faturas recebidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!dados?.faturas?.length ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Nenhuma fatura recebida ainda.</p>
              <p className="text-xs mt-1">
                Apos cadastrar o e-mail na EDP, suas faturas aparecerao aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {dados.faturas.map((f) => {
                const d = f.dadosExtraidos;
                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-green-700" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {f.mesReferencia
                            ? `Ref. ${f.mesReferencia.split('-').reverse().join('/')}`
                            : 'Sem referencia'}
                        </p>
                        <p className="text-xs text-gray-500">
                          UC: {f.uc?.numeroUC ?? d?.numeroUC ?? '—'} | Recebida em{' '}
                          {new Date(f.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-800">
                        R$ {Number(d?.totalAPagar ?? 0).toFixed(2)}
                      </p>
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <span className="text-xs text-gray-500">
                          {Number(d?.consumoAtualKwh ?? 0).toFixed(0)} kWh
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            f.statusRevisao === 'AUTO_APROVADO' || f.statusRevisao === 'APROVADO'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : f.statusRevisao === 'PENDENTE_REVISAO'
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}
                        >
                          {f.statusRevisao === 'AUTO_APROVADO' || f.statusRevisao === 'APROVADO'
                            ? 'Conferida'
                            : f.statusRevisao === 'PENDENTE_REVISAO'
                              ? 'Em analise'
                              : f.statusRevisao}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
