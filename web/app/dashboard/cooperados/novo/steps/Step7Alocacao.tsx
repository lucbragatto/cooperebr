'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, MapPin, Zap } from 'lucide-react';
import type { Step1Data, DadosOcr } from './Step1Fatura';
import type { Step2Data } from './Step2Dados';
import type { Step3Data } from './Step3Simulacao';
import type { Step4Data } from './Step4Proposta';
import type { Step5Data } from './Step5Documentos';
import type { Step6Data } from './Step6Contrato';

interface UsinaDisponivel {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  distribuidora: string | null;
  capacidadeKwh: number | null;
  producaoMensalKwh: number | null;
  statusHomologacao: string;
}

interface Step7Props {
  faturaData: Step1Data;
  dadosPessoais: Step2Data;
  simulacaoData: Step3Data;
  propostaData: Step4Data;
  documentosData: Step5Data;
  contratoData: Step6Data;
  tipoMembro: string;
  tipoMembroPlural: string;
  tipoParceiro: string;
}

export default function Step7Alocacao({ faturaData, dadosPessoais, simulacaoData, propostaData, documentosData, contratoData, tipoMembro, tipoMembroPlural, tipoParceiro }: Step7Props) {
  const router = useRouter();
  const ocr = faturaData.ocr;

  const [usinas, setUsinas] = useState<UsinaDisponivel[]>([]);
  const [usinaSelecionada, setUsinaSelecionada] = useState('');
  const [semVaga, setSemVaga] = useState(false);
  const [posicaoEspera, setPosicaoEspera] = useState(0);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [cooperadoId, setCooperadoId] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function buscarUsinas() {
      try {
        const { data: all } = await api.get<UsinaDisponivel[]>('/usinas');
        const distribuidora = ocr?.distribuidora?.toUpperCase() ?? '';
        const compativeis = all.filter(u =>
          (u.statusHomologacao === 'HOMOLOGADA' || u.statusHomologacao === 'EM_PRODUCAO') &&
          (!distribuidora || (u.distribuidora?.toUpperCase() ?? '').includes(distribuidora))
        );
        setUsinas(compativeis);
        if (compativeis.length > 0) {
          setUsinaSelecionada(compativeis[0].id);
        } else {
          setSemVaga(true);
          try {
            const { data: espera } = await api.get<{ posicao: number }>('/cooperados/fila-espera/count');
            setPosicaoEspera((espera?.posicao ?? 0) + 1);
          } catch {
            setPosicaoEspera(1);
          }
        }
      } catch {
        setSemVaga(true);
      } finally {
        setLoading(false);
      }
    }
    buscarUsinas();
  }, [ocr?.distribuidora]);

  async function finalizar() {
    setSalvando(true); setErro('');
    try {
      // 1. Criar cooperado
      const { data: novoCoop } = await api.post<{ id: string }>('/cooperados', {
        nomeCompleto: dadosPessoais.nomeCompleto,
        cpf: dadosPessoais.cpf.replace(/\D/g, ''),
        email: dadosPessoais.email,
        telefone: dadosPessoais.telefone || undefined,
        status: 'PENDENTE',
        tipoPessoa: dadosPessoais.tipoPessoa,
        tipoMembro: tipoMembro,
        representanteLegalNome: dadosPessoais.representanteLegalNome || undefined,
        representanteLegalCpf: dadosPessoais.representanteLegalCpf?.replace(/\D/g, '') || undefined,
        representanteLegalCargo: dadosPessoais.representanteLegalCargo || undefined,
      });
      const cid = novoCoop.id;
      setCooperadoId(cid);

      // 2. Criar UC
      if (ocr) {
        await api.post('/ucs', {
          numero: ocr.numeroUC || `UC-${Date.now()}`,
          endereco: ocr.enderecoInstalacao || dadosPessoais.endereco,
          cidade: ocr.cidade || dadosPessoais.cidade,
          estado: ocr.estado || dadosPessoais.estado,
          cep: ocr.cep || dadosPessoais.cep,
          bairro: ocr.bairro || dadosPessoais.bairro,
          numeroUC: ocr.numeroUC || undefined,
          distribuidora: ocr.distribuidora || undefined,
          classificacao: ocr.classificacao || undefined,
          codigoMedidor: ocr.codigoMedidor || undefined,
          cooperadoId: cid,
        });
      }

      // 3. Upload documentos
      for (const doc of documentosData.documentos) {
        if (doc.arquivo) {
          const formData = new FormData();
          formData.append('arquivo', doc.arquivo);
          formData.append('tipo', doc.tipo);
          await api.post(`/documentos/upload/${cid}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      }

      // 4. Criar contrato se tem usina selecionada
      if (!semVaga && usinaSelecionada) {
        const selecionados = faturaData.historico.filter((_, i) => faturaData.mesesSelecionados.has(i));
        const mediaKwh = selecionados.length > 0 ? selecionados.reduce((acc, m) => acc + m.consumoKwh, 0) / selecionados.length : 0;

        try {
          await api.post('/contratos', {
            cooperadoId: cid,
            usinaId: usinaSelecionada,
            dataInicio: new Date().toISOString().slice(0, 10),
            percentualDesconto: simulacaoData.simulacao?.desconto ?? 15,
            kwhContrato: Math.round(mediaKwh),
            planoId: simulacaoData.planoSelecionadoId || undefined,
          });
        } catch {
          // Contrato opcional, não bloqueia
        }
      }

      // 5. Lista de espera se sem vaga
      if (semVaga) {
        try {
          await api.post('/lista-espera', { cooperadoId: cid });
        } catch {
          // fallback
        }
      }

      // 6. Processar fatura se tem dados OCR
      if (ocr && faturaData.historico.length > 0) {
        const selecionados = faturaData.historico.filter((_, i) => faturaData.mesesSelecionados.has(i));
        try {
          await api.post('/motor-proposta/calcular', {
            cooperadoId: cid,
            historico: selecionados.map(h => ({ mesAno: h.mesAno, consumoKwh: h.consumoKwh, valorRS: h.valorRS })),
            kwhMesRecente: ocr.consumoAtualKwh ?? 0,
            valorMesRecente: ocr.totalAPagar ?? 0,
            mesReferencia: selecionados[selecionados.length - 1]?.mesAno ?? '',
            tipoFornecimento: ocr.tipoFornecimento || undefined,
          });
        } catch {
          // Proposta complementar
        }
      }

      setConcluido(true);
      dispararConfetti();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErro(msg || 'Erro ao finalizar cadastro. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function dispararConfetti() {
    try {
      const confetti = (await import('canvas-confetti')).default;
      const duracao = 3000;
      const fim = Date.now() + duracao;
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#22c55e', '#16a34a', '#4ade80', '#fbbf24', '#3b82f6'] });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#22c55e', '#16a34a', '#4ade80', '#fbbf24', '#3b82f6'] });
        if (Date.now() < fim) requestAnimationFrame(frame);
      };
      frame();
    } catch {}
  }

  // ─── Concluído ──────────────────────────────────────────────────────────────
  if (concluido) {
    return (
      <div className="text-center py-12 space-y-6">
        <div className="text-6xl">&#x1F389;</div>
        <h2 className="text-2xl font-bold text-green-700">
          {dadosPessoais.nomeCompleto} cadastrado com sucesso!
        </h2>
        <p className="text-neutral-500">
          {semVaga
            ? `Adicionado à lista de espera — posição ${posicaoEspera}. Previsão de ativação: quando nova usina for homologada.`
            : `${tipoMembro} alocado na usina e contrato criado.`
          }
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => router.push(`/dashboard/cooperados/${cooperadoId}`)}>
            Ver perfil
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard/cooperados/novo')}>
            Cadastrar outro
          </Button>
        </div>
      </div>
    );
  }

  // ─── Salvando ───────────────────────────────────────────────────────────────
  if (salvando) {
    return (
      <div className="text-center py-12 space-y-6">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-green-200 border-t-green-600" />
        <p className="text-lg font-medium text-neutral-700">Finalizando cadastro...</p>
      </div>
    );
  }

  // ─── Loading usinas ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="text-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 text-green-600 mx-auto animate-spin" />
        <p className="text-sm text-gray-500">Verificando usinas disponíveis...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-1">Alocação e conclusão</h2>
        <p className="text-sm text-gray-500">Verifique usinas disponíveis e finalize o cadastro do {tipoMembro.toLowerCase()}.</p>
      </div>

      {/* Usina disponível */}
      {!semVaga && usinas.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-green-700" />
            <h3 className="text-sm font-semibold text-gray-800">Usinas compatíveis ({ocr?.distribuidora ?? 'mesma distribuidora'})</h3>
          </div>
          <div className="space-y-2">
            {usinas.map(u => (
              <button key={u.id} onClick={() => setUsinaSelecionada(u.id)}
                className={`w-full text-left border-2 rounded-xl p-4 transition-colors ${usinaSelecionada === u.id ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 ${usinaSelecionada === u.id ? 'border-green-600 bg-green-600' : 'border-gray-400'}`} />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{u.nome}</p>
                    <p className="text-xs text-gray-500">{u.cidade}/{u.estado} — {u.distribuidora ?? 'N/A'} — {u.statusHomologacao}</p>
                    {u.capacidadeKwh && <p className="text-xs text-gray-500">Capacidade: {u.capacidadeKwh.toLocaleString('pt-BR')} kWh</p>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sem vaga */}
      {semVaga && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">Nenhuma usina disponível</h3>
          </div>
          <p className="text-sm text-amber-700">
            {tipoMembro} será adicionado à lista de espera — posição estimada: <b>{posicaoEspera}</b>
          </p>
          <p className="text-xs text-amber-600">
            Previsão de ativação: quando nova usina for homologada na mesma distribuidora.
          </p>
        </div>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <Button onClick={finalizar} className="w-full py-4 text-lg font-bold">
        Finalizar cadastro
      </Button>
    </div>
  );
}
