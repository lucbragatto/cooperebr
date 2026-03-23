'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, ArrowRight, Check, Loader2,
} from 'lucide-react';

/* ─── Constantes ──────────────────────────────────────────── */

const TIPOS = [
  { valor: 'COOPERATIVA', label: '🏢 Cooperativa', membro: 'Cooperado' },
  { valor: 'CONSORCIO', label: '🤝 Consórcio', membro: 'Consorciado' },
  { valor: 'ASSOCIACAO', label: '🏛️ Associação', membro: 'Associado' },
  { valor: 'CONDOMINIO', label: '🏘️ Condomínio', membro: 'Condômino' },
];

const DISTRIBUIDORAS = ['EDP ES', 'CEMIG', 'CELESC', 'ENEL', 'CPFL', 'Outra'];

const STATUS_USINA = [
  { valor: 'EM_PRODUCAO', label: 'Em produção' },
  { valor: 'AGUARDANDO_HOMOLOGACAO', label: 'Aguardando homologação' },
  { valor: 'CADASTRADA', label: 'Cadastrada' },
];

const MODELOS = [
  {
    tipo: 'FIXO_MENSAL',
    nome: 'Fixo',
    desc: 'Valor fixo mensal independente do consumo',
    campo: 'Valor R$ mensal',
    prefixo: 'R$',
  },
  {
    tipo: 'CREDITOS_COMPENSADOS',
    nome: 'Créditos compensados',
    desc: 'Cobra proporcionalmente aos créditos usados no mês',
    campo: 'R$/kWh',
    prefixo: 'R$',
  },
  {
    tipo: 'CREDITOS_DINAMICO',
    nome: 'Dinâmico',
    desc: 'Percentual de desconto sobre a fatura original',
    campo: '% de desconto oferecido',
    prefixo: '%',
  },
];

const ESTADOS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

const STEPS = [
  { num: 1, nome: 'Dados' },
  { num: 2, nome: 'Usina' },
  { num: 3, nome: 'Espera' },
  { num: 4, nome: 'Plano SaaS' },
  { num: 5, nome: 'Cobrança' },
];

/* ─── Masks ───────────────────────────────────────────────── */

function maskCNPJ(v: string) {
  return v.replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .slice(0, 18);
}

function maskPhone(v: string) {
  return v.replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15);
}

function maskCEP(v: string) {
  return v.replace(/\D/g, '')
    .replace(/^(\d{5})(\d)/, '$1-$2')
    .slice(0, 9);
}

function maskCPF(v: string) {
  return v.replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14);
}

/* ─── Componente ──────────────────────────────────────────── */

export default function NovaCooperativaPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 — Dados parceiro
  const [parceiro, setParceiro] = useState({
    nome: '', tipoParceiro: 'COOPERATIVA', cnpj: '', email: '', telefone: '',
    nomeResponsavel: '', cpfResponsavel: '',
    cidade: '', estado: '', cep: '', endereco: '',
  });

  // Step 2 — Usina
  const [temUsina, setTemUsina] = useState<'sim' | 'nao' | ''>('');
  const [usinaExistenteId, setUsinaExistenteId] = useState('');
  const [usinasDisponiveis, setUsinasDisponiveis] = useState<any[]>([]);
  const [novaUsina, setNovaUsina] = useState({
    nome: '', potenciaKwp: '', cidade: '', estado: '',
    distribuidora: '', proprietarioProprio: true,
    proprietarioNome: '', proprietarioCpfCnpj: '', proprietarioTelefone: '',
    statusHomologacao: 'EM_PRODUCAO',
  });

  // Step 3 — Lista espera
  const [listaEspera, setListaEspera] = useState<any[]>([]);
  const [alocarAutomatico, setAlocarAutomatico] = useState(true);
  const [carregandoEspera, setCarregandoEspera] = useState(false);

  // Step 4 — Plano SaaS
  const [planos, setPlanos] = useState<any[]>([]);
  const [planoSelecionado, setPlanoSelecionado] = useState<string | null>(null);
  const [diaVencimento, setDiaVencimento] = useState('10');
  const [statusSaas, setStatusSaas] = useState('TRIAL');
  const [carregandoPlanos, setCarregandoPlanos] = useState(false);

  // Step 5 — Modelo cobrança
  const [modeloCobranca, setModeloCobranca] = useState('');
  const [valorModelo, setValorModelo] = useState('');
  const [descontoPadrao, setDescontoPadrao] = useState('');
  const [multaAtraso, setMultaAtraso] = useState('2');
  const [jurosDiarios, setJurosDiarios] = useState('0.033');

  // Geral
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  /* Capacidade calculada */
  const capacidadeKwh = novaUsina.potenciaKwp
    ? (Number(novaUsina.potenciaKwp) * 120).toFixed(0)
    : '';

  /* Membro label preview */
  const tipoInfo = TIPOS.find((t) => t.valor === parceiro.tipoParceiro);

  /* ─── Helpers ──── */

  function setPField(field: keyof typeof parceiro, value: string) {
    setParceiro((p) => ({ ...p, [field]: value }));
  }

  function setUField(field: keyof typeof novaUsina, value: any) {
    setNovaUsina((p) => ({ ...p, [field]: value }));
  }

  /* ─── Carregar dados ao entrar em steps ──── */

  useEffect(() => {
    if (step === 2 && usinasDisponiveis.length === 0) {
      api.get('/usinas').then(({ data }) => {
        const livres = (Array.isArray(data) ? data : []).filter(
          (u: any) => !u.cooperativaId,
        );
        setUsinasDisponiveis(livres);
      }).catch(() => {});
    }
  }, [step]);

  useEffect(() => {
    if (step === 3) {
      setCarregandoEspera(true);
      api.get('/motor-proposta/lista-espera')
        .then(({ data }) => {
          const aguardando = (Array.isArray(data) ? data : []).filter(
            (e: any) => e.status === 'AGUARDANDO',
          );
          setListaEspera(aguardando);
        })
        .catch(() => setListaEspera([]))
        .finally(() => setCarregandoEspera(false));
    }
  }, [step]);

  useEffect(() => {
    if (step === 4 && planos.length === 0) {
      setCarregandoPlanos(true);
      api.get('/saas/planos')
        .then(({ data }) => setPlanos(Array.isArray(data) ? data.filter((p: any) => p.ativo) : []))
        .catch(() => {})
        .finally(() => setCarregandoPlanos(false));
    }
  }, [step]);

  /* ─── Validação por step ──── */

  function validarStep(): string | null {
    if (step === 1) {
      if (!parceiro.nome.trim()) return 'Nome da organização é obrigatório.';
      if (!parceiro.cnpj.trim()) return 'CNPJ é obrigatório.';
      if (!parceiro.tipoParceiro) return 'Tipo é obrigatório.';
    }
    if (step === 2) {
      if (!temUsina) return 'Selecione se já possui uma usina.';
      if (temUsina === 'sim' && !usinaExistenteId) return 'Selecione uma usina existente.';
      if (temUsina === 'nao') {
        if (!novaUsina.nome.trim()) return 'Nome da usina é obrigatório.';
        if (!novaUsina.potenciaKwp) return 'Potência (kWp) é obrigatória.';
      }
    }
    if (step === 5) {
      if (!modeloCobranca) return 'Selecione um modelo de cobrança.';
    }
    return null;
  }

  /* ─── Verificar se step 3 deve aparecer ──── */

  const usinaConfigurada = temUsina === 'sim' || temUsina === 'nao';

  function proximoStep() {
    const erro = validarStep();
    if (erro) { setErro(erro); return; }
    setErro('');
    let next = step + 1;
    // Pular step 3 se usina não configurada
    if (next === 3 && !usinaConfigurada) next = 4;
    setStep(next);
  }

  function anteriorStep() {
    let prev = step - 1;
    if (prev === 3 && !usinaConfigurada) prev = 2;
    setStep(prev);
  }

  /* ─── Finalizar ──── */

  async function handleFinalizar() {
    const erroVal = validarStep();
    if (erroVal) { setErro(erroVal); return; }
    setErro('');
    setSalvando(true);

    try {
      // 1. Criar parceiro
      const { data: coop } = await api.post('/cooperativas', {
        nome: parceiro.nome,
        cnpj: parceiro.cnpj,
        email: parceiro.email || undefined,
        telefone: parceiro.telefone || undefined,
        cidade: parceiro.cidade || undefined,
        estado: parceiro.estado || undefined,
        cep: parceiro.cep || undefined,
        endereco: parceiro.endereco || undefined,
        tipoParceiro: parceiro.tipoParceiro,
      });
      const coopId = coop.id;

      // 2. Usina
      let usinaId = '';
      if (temUsina === 'nao') {
        const { data: usina } = await api.post('/usinas', {
          nome: novaUsina.nome,
          potenciaKwp: Number(novaUsina.potenciaKwp),
          capacidadeKwh: capacidadeKwh ? Number(capacidadeKwh) : undefined,
          cidade: novaUsina.cidade || undefined,
          estado: novaUsina.estado || undefined,
          distribuidora: novaUsina.distribuidora || undefined,
          statusHomologacao: novaUsina.statusHomologacao,
          cooperativaId: coopId,
          proprietarioNome: novaUsina.proprietarioProprio ? undefined : novaUsina.proprietarioNome || undefined,
          proprietarioCpfCnpj: novaUsina.proprietarioProprio ? undefined : novaUsina.proprietarioCpfCnpj || undefined,
          proprietarioTelefone: novaUsina.proprietarioProprio ? undefined : novaUsina.proprietarioTelefone || undefined,
        });
        usinaId = usina.id;
      } else if (temUsina === 'sim' && usinaExistenteId) {
        await api.put(`/usinas/${usinaExistenteId}`, { cooperativaId: coopId });
        usinaId = usinaExistenteId;
      }

      // 3. Lista de espera
      if (usinaId && alocarAutomatico && listaEspera.length > 0) {
        try {
          await api.post(`/usinas/${usinaId}/verificar-espera`);
        } catch { /* silencioso */ }
      }

      // 4. Plano SaaS
      if (planoSelecionado) {
        await api.patch(`/cooperativas/${coopId}/plano`, { planoSaasId: planoSelecionado });
      }
      // Atualizar dia vencimento e status SaaS
      await api.put(`/cooperativas/${coopId}`, {
        diaVencimentoSaas: Number(diaVencimento) || 10,
        statusSaas: statusSaas,
      });

      // 5. Configuração cobrança
      const desconto = Number(descontoPadrao) || 0;
      await api.put('/configuracao-cobranca', {
        cooperativaId: coopId,
        descontoPadrao: desconto,
        descontoMin: desconto,
        descontoMax: desconto,
      });

      // 6. Financeiro (multa e juros)
      await api.patch(`/cooperativas/financeiro/${coopId}`, {
        multaAtraso: Number(multaAtraso) || 2,
        jurosDiarios: Number(jurosDiarios) || 0.033,
      });

      // 7. Modelo via config-tenant
      if (modeloCobranca) {
        try {
          await api.put(`/config-tenant/modeloCobranca_${coopId}`, {
            valor: modeloCobranca,
            descricao: 'Modelo de cobrança do parceiro',
          });
          if (valorModelo) {
            await api.put(`/config-tenant/valorModelo_${coopId}`, {
              valor: valorModelo,
              descricao: 'Valor específico do modelo de cobrança',
            });
          }
        } catch { /* silencioso */ }
      }

      // 8. Redirecionar
      router.push(`/dashboard/cooperativas/${coopId}`);
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Erro ao criar parceiro. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  /* ─── Stepper visual ──── */

  function Stepper() {
    const progresso = (step / 5) * 100;
    return (
      <div className="mb-8">
        {/* Barra de progresso */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progresso}%` }}
          />
        </div>
        {/* Passos */}
        <div className="flex justify-between">
          {STEPS.map((s) => {
            const isActive = step === s.num;
            const isDone = step > s.num;
            const isSkipped = s.num === 3 && !usinaConfigurada;
            return (
              <div key={s.num} className={`flex flex-col items-center gap-1 ${isSkipped ? 'opacity-40' : ''}`}>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isDone
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-green-600 text-white ring-4 ring-green-100'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : s.num}
                </div>
                <span className={`text-xs font-medium ${isActive ? 'text-green-700' : 'text-gray-500'}`}>
                  {s.nome}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ─── STEP 1: Dados do parceiro ──── */

  function Step1() {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Dados do parceiro</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Nome da organização *</Label>
            <Input value={parceiro.nome} onChange={(e) => setPField('nome', e.target.value)} placeholder="CoopereBR" />
          </div>
          <div className="space-y-1">
            <Label>Tipo de organização *</Label>
            <Select value={parceiro.tipoParceiro} onValueChange={(v) => setPField('tipoParceiro', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Preview membro */}
        {tipoInfo && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-800">
            Seus membros serão chamados de: <strong>{tipoInfo.membro}</strong>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>CNPJ *</Label>
            <Input
              value={parceiro.cnpj}
              onChange={(e) => setPField('cnpj', maskCNPJ(e.target.value))}
              placeholder="00.000.000/0001-00"
            />
          </div>
          <div className="space-y-1">
            <Label>Email de contato</Label>
            <Input value={parceiro.email} onChange={(e) => setPField('email', e.target.value)} type="email" placeholder="contato@empresa.com.br" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Telefone</Label>
            <Input
              value={parceiro.telefone}
              onChange={(e) => setPField('telefone', maskPhone(e.target.value))}
              placeholder="(27) 99999-0000"
            />
          </div>
          <div className="space-y-1">
            <Label>Nome do responsável</Label>
            <Input value={parceiro.nomeResponsavel} onChange={(e) => setPField('nomeResponsavel', e.target.value)} placeholder="João Silva" />
          </div>
        </div>

        <div className="w-1/2 space-y-1">
          <Label>CPF do responsável</Label>
          <Input
            value={parceiro.cpfResponsavel}
            onChange={(e) => setPField('cpfResponsavel', maskCPF(e.target.value))}
            placeholder="000.000.000-00"
          />
        </div>

        <hr className="my-2" />
        <p className="text-sm font-medium text-gray-600">Endereço</p>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>CEP</Label>
            <Input
              value={parceiro.cep}
              onChange={(e) => setPField('cep', maskCEP(e.target.value))}
              placeholder="29000-000"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Endereço</Label>
            <Input value={parceiro.endereco} onChange={(e) => setPField('endereco', e.target.value)} placeholder="Rua das Flores, 123" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Cidade</Label>
            <Input value={parceiro.cidade} onChange={(e) => setPField('cidade', e.target.value)} placeholder="Vitória" />
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <Select value={parceiro.estado} onValueChange={(v) => setPField('estado', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  /* ─── STEP 2: Usina ──── */

  function Step2() {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Usina</h3>
        <p className="text-sm text-gray-600">Já possui uma usina para vincular?</p>

        <div className="flex gap-3">
          <Button
            type="button"
            variant={temUsina === 'sim' ? 'default' : 'outline'}
            className={temUsina === 'sim' ? 'bg-green-600 hover:bg-green-700' : ''}
            onClick={() => setTemUsina('sim')}
          >
            Sim, vincular existente
          </Button>
          <Button
            type="button"
            variant={temUsina === 'nao' ? 'default' : 'outline'}
            className={temUsina === 'nao' ? 'bg-green-600 hover:bg-green-700' : ''}
            onClick={() => setTemUsina('nao')}
          >
            Não, criar nova
          </Button>
        </div>

        {/* Usina existente */}
        {temUsina === 'sim' && (
          <div className="space-y-3 border border-gray-200 rounded-lg p-4">
            <Label>Selecione a usina</Label>
            {usinasDisponiveis.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma usina disponível sem parceiro vinculado.</p>
            ) : (
              <Select value={usinaExistenteId} onValueChange={setUsinaExistenteId}>
                <SelectTrigger><SelectValue placeholder="Escolha uma usina" /></SelectTrigger>
                <SelectContent>
                  {usinasDisponiveis.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} — {u.potenciaKwp} kWp ({u.cidade}/{u.estado})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Nova usina */}
        {temUsina === 'nao' && (
          <div className="space-y-3 border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome da usina *</Label>
                <Input value={novaUsina.nome} onChange={(e) => setUField('nome', e.target.value)} placeholder="Usina Solar Alpha" />
              </div>
              <div className="space-y-1">
                <Label>Potência (kWp) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={novaUsina.potenciaKwp}
                  onChange={(e) => setUField('potenciaKwp', e.target.value)}
                  placeholder="500"
                />
              </div>
            </div>

            {capacidadeKwh && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800">
                Capacidade mensal estimada: <strong>{Number(capacidadeKwh).toLocaleString('pt-BR')} kWh</strong> (kWp × 120h)
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cidade</Label>
                <Input value={novaUsina.cidade} onChange={(e) => setUField('cidade', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <Select value={novaUsina.estado} onValueChange={(v) => setUField('estado', v)}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Distribuidora</Label>
                <Select value={novaUsina.distribuidora} onValueChange={(v) => setUField('distribuidora', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {DISTRIBUIDORAS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={novaUsina.statusHomologacao} onValueChange={(v) => setUField('statusHomologacao', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_USINA.map((s) => (
                      <SelectItem key={s.valor} value={s.valor}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <hr className="my-2" />
            <p className="text-sm font-medium text-gray-600">Proprietário</p>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">É o próprio parceiro?</span>
              <Button
                type="button"
                size="sm"
                variant={novaUsina.proprietarioProprio ? 'default' : 'outline'}
                className={novaUsina.proprietarioProprio ? 'bg-green-600 hover:bg-green-700' : ''}
                onClick={() => setUField('proprietarioProprio', true)}
              >
                Sim
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!novaUsina.proprietarioProprio ? 'default' : 'outline'}
                className={!novaUsina.proprietarioProprio ? 'bg-green-600 hover:bg-green-700' : ''}
                onClick={() => setUField('proprietarioProprio', false)}
              >
                Não
              </Button>
            </div>

            {!novaUsina.proprietarioProprio && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input value={novaUsina.proprietarioNome} onChange={(e) => setUField('proprietarioNome', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>CPF/CNPJ</Label>
                  <Input value={novaUsina.proprietarioCpfCnpj} onChange={(e) => setUField('proprietarioCpfCnpj', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Telefone</Label>
                  <Input
                    value={novaUsina.proprietarioTelefone}
                    onChange={(e) => setUField('proprietarioTelefone', maskPhone(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ─── STEP 3: Lista de espera ──── */

  function Step3() {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Lista de espera</h3>

        {carregandoEspera ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando lista de espera...
          </div>
        ) : listaEspera.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
            Nenhum membro na lista de espera ainda.
          </div>
        ) : (
          <>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">#</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Nome</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">kWh necessário</th>
                  </tr>
                </thead>
                <tbody>
                  {listaEspera.map((item, i) => (
                    <tr key={item.id || i} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-2">{item.cooperado?.nomeCompleto || item.nome || '—'}</td>
                      <td className="px-4 py-2 text-right">{item.kwhNecessario || item.kwhContratoMensal || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <Switch checked={alocarAutomatico} onCheckedChange={setAlocarAutomatico} />
                <span className="text-sm font-medium text-green-800">Alocar automaticamente ao salvar?</span>
              </div>
              {alocarAutomatico && (
                <span className="text-sm text-green-700">
                  {listaEspera.length} membro(s) serão promovidos para Aguardando Concessionária
                </span>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  /* ─── STEP 4: Plano SaaS ──── */

  function Step4() {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Plano SaaS</h3>

        {carregandoPlanos ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando planos...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {planos.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setPlanoSelecionado(p.id)}
                  className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${
                    planoSelecionado === p.id
                      ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <h4 className="font-semibold text-gray-800">{p.nome}</h4>
                  {p.descricao && <p className="text-xs text-gray-500 mt-1">{p.descricao}</p>}
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Mensalidade</span>
                      <span className="font-medium">R$ {Number(p.mensalidadeBase || 0).toFixed(2)}</span>
                    </div>
                    {p.limiteMembros && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Limite membros</span>
                        <span className="font-medium">{p.limiteMembros}</span>
                      </div>
                    )}
                    {Number(p.percentualReceita) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">% receita</span>
                        <span className="font-medium">{Number(p.percentualReceita)}%</span>
                      </div>
                    )}
                  </div>
                  {planoSelecionado === p.id && (
                    <div className="mt-2 flex items-center gap-1 text-green-600 text-xs font-medium">
                      <Check className="h-3 w-3" /> Selecionado
                    </div>
                  )}
                </div>
              ))}

              {/* Configurar depois */}
              <div
                onClick={() => setPlanoSelecionado(null)}
                className={`cursor-pointer border-2 rounded-lg p-4 transition-all flex items-center justify-center ${
                  planoSelecionado === null
                    ? 'border-gray-400 bg-gray-50 ring-2 ring-gray-200'
                    : 'border-gray-200 border-dashed hover:border-gray-300'
                }`}
              >
                <span className="text-sm text-gray-500 font-medium">Configurar depois</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="space-y-1">
                <Label>Dia de vencimento da mensalidade (1-28)</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={diaVencimento}
                  onChange={(e) => setDiaVencimento(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Status inicial</Label>
                <Select value={statusSaas} onValueChange={setStatusSaas}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRIAL">TRIAL (30 dias grátis)</SelectItem>
                    <SelectItem value="ATIVO">ATIVO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  /* ─── STEP 5: Modelo de cobrança ──── */

  function Step5() {
    const modeloSelecionado = MODELOS.find((m) => m.tipo === modeloCobranca);
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Modelo de cobrança dos membros</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {MODELOS.map((m) => (
            <div
              key={m.tipo}
              onClick={() => { setModeloCobranca(m.tipo); setValorModelo(''); }}
              className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${
                modeloCobranca === m.tipo
                  ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <h4 className="font-semibold text-gray-800">{m.nome}</h4>
              <p className="text-sm text-gray-500 mt-1">{m.desc}</p>
              {modeloCobranca === m.tipo && (
                <div className="mt-2 flex items-center gap-1 text-green-600 text-xs font-medium">
                  <Check className="h-3 w-3" /> Selecionado
                </div>
              )}
            </div>
          ))}
        </div>

        {modeloSelecionado && (
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="space-y-1">
              <Label>{modeloSelecionado.campo}</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 font-medium">{modeloSelecionado.prefixo}</span>
                <Input
                  type="number"
                  step="0.01"
                  value={valorModelo}
                  onChange={(e) => setValorModelo(e.target.value)}
                  className="max-w-xs"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        )}

        <hr className="my-2" />

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Desconto padrão (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={descontoPadrao}
              onChange={(e) => setDescontoPadrao(e.target.value)}
              placeholder="15"
            />
            <p className="text-xs text-gray-400">Quanto o membro economiza</p>
          </div>
          <div className="space-y-1">
            <Label>Multa por atraso (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={multaAtraso}
              onChange={(e) => setMultaAtraso(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Juros diários (%)</Label>
            <Input
              type="number"
              step="0.001"
              value={jurosDiarios}
              onChange={(e) => setJurosDiarios(e.target.value)}
            />
          </div>
        </div>
      </div>
    );
  }

  /* ─── Render ──── */

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/cooperativas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">Novo Parceiro</h2>
      </div>

      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <Stepper />

          {step === 1 && <Step1 />}
          {step === 2 && <Step2 />}
          {step === 3 && <Step3 />}
          {step === 4 && <Step4 />}
          {step === 5 && <Step5 />}

          {erro && <p className="text-sm text-red-600 mt-4">{erro}</p>}

          {/* Navegação */}
          <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-100">
            <div>
              {step > 1 && (
                <Button type="button" variant="outline" onClick={anteriorStep}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
              )}
            </div>
            <div>
              {step < 5 ? (
                <Button
                  type="button"
                  onClick={proximoStep}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Próximo
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleFinalizar}
                  disabled={salvando}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {salvando ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Finalizar
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
