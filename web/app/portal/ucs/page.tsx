'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Zap,
  MapPin,
  Building2,
  Plus,
  X,
  Upload,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface UcItem {
  id: string;
  numero: string;
  endereco: string;
  cidade: string;
  estado: string;
  distribuidora: string | null;
  contratos: { percentualDesconto: number; status: string }[];
  faturasProcessadas: { mediaKwhCalculada: number }[];
}

export default function PortalUcsPage() {
  const [ucs, setUcs] = useState<UcItem[]>([]);
  const [cooperadoId, setCooperadoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [ucSelecionada, setUcSelecionada] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/cooperados/meu-perfil/ucs'),
      api.get('/cooperados/meu-perfil'),
    ])
      .then(([ucsRes, perfilRes]) => {
        setUcs(ucsRes.data);
        setCooperadoId(perfilRes.data.id);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">Minhas UCs</h1>
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => setModalAberto(true)}
        >
          <Plus className="w-4 h-4 mr-1" />
          Nova UC
        </Button>
      </div>

      {ucs.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Zap className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-700 mb-1">
              Nenhuma UC vinculada
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Adicione sua unidade consumidora para começar a economizar.
            </p>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setModalAberto(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Adicionar UC
            </Button>
          </CardContent>
        </Card>
      ) : (
        ucs.map((uc) => {
          const desconto = uc.contratos[0]
            ? Number(uc.contratos[0].percentualDesconto)
            : null;
          const consumoMedio = uc.faturasProcessadas[0]
            ? Number(uc.faturasProcessadas[0].mediaKwhCalculada)
            : null;
          const statusContrato = uc.contratos[0]?.status ?? null;

          return (
            <Card
              key={uc.id}
              className="cursor-pointer hover:ring-green-200 transition-all"
              onClick={() =>
                setUcSelecionada(ucSelecionada === uc.id ? null : uc.id)
              }
            >
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-5 h-5 text-green-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">
                        UC {uc.numero}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">
                          {uc.endereco}, {uc.cidade}/{uc.estado}
                        </span>
                      </div>
                      {uc.distribuidora && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                          <Building2 className="w-3 h-3 flex-shrink-0" />
                          <span>{uc.distribuidora}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {statusContrato && (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                        statusContrato === 'ATIVO'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {statusContrato === 'ATIVO' ? 'Ativo' : 'Pendente'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500">Consumo médio</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {consumoMedio
                        ? `${consumoMedio.toLocaleString('pt-BR')} kWh`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Desconto</p>
                    <p className="text-sm font-semibold text-green-700">
                      {desconto != null ? `${desconto}%` : '—'}
                    </p>
                  </div>
                </div>

                {/* Gráfico de consumo expandido */}
                {ucSelecionada === uc.id && <UcChart ucId={uc.id} />}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Modal Adicionar UC */}
      {modalAberto && (
        <ModalNovaUc cooperadoId={cooperadoId} onClose={() => setModalAberto(false)} onSuccess={() => {
          setModalAberto(false);
          api.get('/cooperados/meu-perfil/ucs').then((res) => setUcs(res.data));
        }} />
      )}
    </div>
  );
}

function UcChart({ ucId }: { ucId: string }) {
  const [dados, setDados] = useState<{ mes: string; kwh: number }[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .get(`/cooperados/meu-perfil/cobrancas?ucId=${ucId}`)
      .then((res) => {
        const cobrancas = res.data
          .filter((c: any) => c.kwhConsumido != null || c.kwhEntregue != null)
          .slice(0, 6)
          .reverse();
        setDados(
          cobrancas.map((c: any) => ({
            mes: `${String(c.mesReferencia).padStart(2, '0')}/${c.anoReferencia}`,
            kwh: Number(c.kwhEntregue ?? c.kwhConsumido ?? 0),
          })),
        );
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [ucId]);

  if (carregando) return <div className="h-40 bg-gray-100 animate-pulse rounded-lg mt-3" />;
  if (dados.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 text-center text-sm text-gray-400 py-6">
        <BarChart3 className="w-6 h-6 mx-auto mb-1 text-gray-300" />
        Sem dados de consumo ainda
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs text-gray-500 mb-2 font-medium">
        Geração / Consumo (últimos meses)
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={dados}>
          <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={40} />
          <Tooltip
            formatter={(value) => [`${value} kWh`, 'kWh']}
            labelStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="kwh" fill="#16a34a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ModalNovaUc({
  cooperadoId,
  onClose,
  onSuccess,
}: {
  cooperadoId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [numero, setNumero] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero.trim()) {
      setErro('Informe o número da UC.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      // Placeholder: in the future, the backend will accept file upload
      // For now, just notify support
      await api.post('/ocorrencias', {
        cooperadoId,
        tipo: 'SOLICITACAO',
        descricao: `Solicitação de inclusão de nova UC: ${numero}${arquivo ? ' (fatura anexada)' : ''}`,
        prioridade: 'MEDIA',
      });
      onSuccess();
    } catch {
      setErro('Erro ao enviar solicitação. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          Adicionar nova UC
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="numero-uc">Número da UC</Label>
            <Input
              id="numero-uc"
              placeholder="Ex: 0012345678"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="fatura-upload">Fatura (foto ou PDF)</Label>
            <label
              htmlFor="fatura-upload"
              className="flex items-center justify-center gap-2 w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-400 transition-colors text-sm text-gray-500"
            >
              <Upload className="w-5 h-5" />
              {arquivo ? arquivo.name : 'Clique ou arraste para enviar'}
            </label>
            <input
              id="fatura-upload"
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
          </div>
          {erro && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {erro}
            </p>
          )}
          <Button
            type="submit"
            disabled={enviando}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {enviando ? 'Enviando...' : 'Solicitar inclusão'}
          </Button>
        </form>
      </div>
    </div>
  );
}
