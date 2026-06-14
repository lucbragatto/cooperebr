'use client';

import { useEffect, useState } from 'react';
import { Loader2, UserPlus, Copy, Check, Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

export default function ParceiroConvitesPage() {
  const [indicacoes, setIndicacoes] = useState<any[]>([]);
  const [configIndicacao, setConfigIndicacao] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    async function carregar() {
      try {
        const [indRes, configRes, linkRes] = await Promise.allSettled([
          api.get('/indicacoes'),
          api.get('/indicacoes/config'),
          api.get('/indicacoes/meu-link'),
        ]);
        if (indRes.status === 'fulfilled') {
          const d = indRes.value.data;
          setIndicacoes(Array.isArray(d) ? d : d?.data ?? []);
        }
        if (configRes.status === 'fulfilled') {
          const config = configRes.value.data;
          // Usar o link real do meu-link se disponível
          if (linkRes.status === 'fulfilled') {
            const linkData = linkRes.value.data;
            const link = linkData?.link ?? (linkData?.codigoIndicacao
              ? `${window.location.origin}/entrar?ref=${linkData.codigoIndicacao}`
              : null);
            if (link) config.linkConvite = link;
          }
          setConfigIndicacao(config);
        }
      } catch {
        // ignore
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  function copiarLink() {
    const link = configIndicacao?.linkConvite ?? `${window.location.origin}/entrar`;
    navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Convites e Indicações</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie indicações do seu parceiro</p>
      </div>

      {/* Link de convite */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Share2 className="w-4 h-4" /> Link de Convite
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 border rounded-md px-3 py-2 text-sm text-gray-700 truncate">
              {configIndicacao?.linkConvite ?? `${typeof window !== 'undefined' ? window.location.origin : ''}/entrar`}
            </div>
            <Button variant="outline" size="sm" onClick={copiarLink} className="gap-2 shrink-0">
              {copiado ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copiado ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de indicados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Indicados ({indicacoes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {indicacoes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhuma indicação registrada.</p>
          ) : (
            <div className="divide-y">
              {indicacoes.map((ind: any) => (
                <div key={ind.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{ind.cooperadoIndicado?.nomeCompleto ?? ind.nomeIndicado ?? '-'}</p>
                    <p className="text-xs text-gray-500">
                      {ind.createdAt ? new Date(ind.createdAt).toLocaleDateString('pt-BR') : ''}
                    </p>
                  </div>
                  <Badge className={
                    ind.status === 'ATIVO' ? 'bg-green-100 text-green-700' :
                    ind.status === 'PENDENTE' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-500'
                  }>
                    {ind.status ?? 'PENDENTE'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
