'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X, User, Home } from 'lucide-react';
import type { TipoOperacao, ConfiguracoesData } from '../page';

interface Step3Props {
  tiposOperacao: TipoOperacao;
  configuracoes: ConfiguracoesData;
  onChange: (partial: Partial<ConfiguracoesData>) => void;
  onSubmit: () => void;
}

const cls = 'w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';
const lbl = 'block text-xs font-medium text-neutral-600 mb-1';

const MODELOS_COBRANCA = [
  { value: 'FIXO', label: 'Fixo', desc: 'Valor fixo mensal por membro, independente do consumo.' },
  { value: 'CREDITOS_COMPENSADOS', label: 'Créditos Compensados', desc: 'Cobrança baseada no valor de kWh compensado na fatura.' },
  { value: 'DINAMICO', label: 'Dinâmico', desc: 'Percentual de desconto sobre o valor da energia compensada.' },
];

function Section({ titulo, aberto, onToggle, children }: {
  titulo: string;
  aberto: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-neutral-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 hover:bg-neutral-100 transition"
      >
        <span className="text-sm font-semibold text-neutral-700">{titulo}</span>
        {aberto ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
      </button>
      {aberto && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

function SecaoCobranca({ config, onChange }: { config: ConfiguracoesData; onChange: (p: Partial<ConfiguracoesData>) => void }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MODELOS_COBRANCA.map((m) => (
          <button
            key={m.value}
            onClick={() => onChange({ modeloCobranca: m.value })}
            className={`text-left p-3 rounded-lg border-2 transition ${
              config.modeloCobranca === m.value
                ? 'border-green-500 bg-green-50'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <p className="font-medium text-sm text-neutral-800">{m.label}</p>
            <p className="text-xs text-neutral-500 mt-1">{m.desc}</p>
          </button>
        ))}
      </div>

      {config.modeloCobranca && (
        <div className="space-y-3 border-t border-neutral-100 pt-3">
          {config.modeloCobranca === 'FIXO' && (
            <div>
              <label className={lbl}>Valor mensal (R$)</label>
              <input className={cls} type="number" step="0.01" value={config.valorFixo} onChange={(e) => onChange({ valorFixo: e.target.value })} placeholder="0,00" />
            </div>
          )}
          {config.modeloCobranca === 'CREDITOS_COMPENSADOS' && (
            <div>
              <label className={lbl}>Valor por kWh (R$)</label>
              <input className={cls} type="number" step="0.001" value={config.valorKwh} onChange={(e) => onChange({ valorKwh: e.target.value })} placeholder="0,000" />
            </div>
          )}
          {config.modeloCobranca === 'DINAMICO' && (
            <div>
              <label className={lbl}>Percentual de desconto (%)</label>
              <input className={cls} type="number" step="0.1" value={config.percentualDesconto} onChange={(e) => onChange({ percentualDesconto: e.target.value })} placeholder="15" />
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Desconto padrão (%)</label>
              <input className={cls} type="number" step="0.1" value={config.descontoPadrao} onChange={(e) => onChange({ descontoPadrao: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Multa atraso (%)</label>
              <input className={cls} type="number" step="0.01" value={config.multaAtraso} onChange={(e) => onChange({ multaAtraso: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Juros diários (%)</label>
              <input className={cls} type="number" step="0.001" value={config.jurosDiarios} onChange={(e) => onChange({ jurosDiarios: e.target.value })} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SecaoAsaas({ config, onChange }: { config: ConfiguracoesData; onChange: (p: Partial<ConfiguracoesData>) => void }) {
  return (
    <>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onChange({ temAsaas: true, asaasConfigurarDepois: false })}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
            config.temAsaas === true
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-neutral-700 border-neutral-300 hover:border-green-400'
          }`}
        >
          Sim, tenho conta
        </button>
        <button
          type="button"
          onClick={() => onChange({ temAsaas: false, asaasApiKey: '', asaasConfigurarDepois: false })}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
            config.temAsaas === false
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-neutral-700 border-neutral-300 hover:border-green-400'
          }`}
        >
          Não
        </button>
      </div>

      {config.temAsaas === true && (
        <div className="space-y-3 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
          <div>
            <label className={lbl}>API Key do Asaas</label>
            <input className={cls} type="password" placeholder="$aas_..." value={config.asaasApiKey} onChange={(e) => onChange({ asaasApiKey: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Ambiente</label>
            <div className="flex gap-3">
              {(['SANDBOX', 'PRODUCAO'] as const).map((amb) => (
                <button
                  key={amb}
                  type="button"
                  onClick={() => onChange({ asaasAmbiente: amb })}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition ${
                    config.asaasAmbiente === amb
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-neutral-600 border-neutral-300'
                  }`}
                >
                  {amb === 'SANDBOX' ? 'Sandbox' : 'Produção'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {config.temAsaas === false && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            Você poderá configurar depois em Configurações &rarr; Asaas
          </p>
        </div>
      )}
    </>
  );
}

function SecaoBanco({ config, onChange }: { config: ConfiguracoesData; onChange: (p: Partial<ConfiguracoesData>) => void }) {
  function toggleBanco(banco: 'bb' | 'sicoob' | 'nenhum') {
    if (banco === 'nenhum') {
      onChange({ bb: false, sicoob: false, nenhum: true });
    } else {
      onChange({ [banco]: !config[banco], nenhum: false });
    }
  }

  return (
    <>
      <div className="space-y-2">
        {([
          { key: 'bb' as const, label: 'Banco do Brasil' },
          { key: 'sicoob' as const, label: 'Sicoob' },
          { key: 'nenhum' as const, label: 'Nenhum por enquanto' },
        ]).map(({ key, label }) => (
          <label key={key} className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 hover:border-green-300 cursor-pointer transition">
            <input type="checkbox" checked={config[key]} onChange={() => toggleBanco(key)} className="rounded border-neutral-300" />
            <span className="text-sm text-neutral-700">{label}</span>
          </label>
        ))}
      </div>

      {config.bb && (
        <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-700">Banco do Brasil</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Client ID (BB)</label>
              <input className={cls} value={config.bbClientId} onChange={(e) => onChange({ bbClientId: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Client Secret (BB)</label>
              <input className={cls} type="password" value={config.bbClientSecret} onChange={(e) => onChange({ bbClientSecret: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Conta Corrente</label>
              <input className={cls} value={config.bbConta} onChange={(e) => onChange({ bbConta: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Agência</label>
              <input className={cls} value={config.bbAgencia} onChange={(e) => onChange({ bbAgencia: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={lbl}>Ambiente</label>
            <div className="flex gap-3">
              {(['SANDBOX', 'PRODUCAO'] as const).map((amb) => (
                <button
                  key={amb}
                  type="button"
                  onClick={() => onChange({ bbAmbiente: amb })}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition ${
                    config.bbAmbiente === amb
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-neutral-600 border-neutral-300'
                  }`}
                >
                  {amb === 'SANDBOX' ? 'Sandbox' : 'Produção'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {config.sicoob && (
        <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-700">Sicoob</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Client ID (Sicoob)</label>
              <input className={cls} value={config.sicoobClientId} onChange={(e) => onChange({ sicoobClientId: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Conta</label>
              <input className={cls} value={config.sicoobConta} onChange={(e) => onChange({ sicoobConta: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Cooperativa Sicoob</label>
              <input className={cls} value={config.sicoobCooperativa} onChange={(e) => onChange({ sicoobCooperativa: e.target.value })} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SecaoCondominio({ config, onChange }: { config: ConfiguracoesData; onChange: (p: Partial<ConfiguracoesData>) => void }) {
  const [numero, setNumero] = useState('');
  const [condominoNome, setCondominoNome] = useState('');

  function adicionar() {
    if (!numero.trim()) return;
    if (config.unidades.some((u) => u.numero === numero.trim())) return;
    onChange({ unidades: [...config.unidades, { numero: numero.trim(), condominoNome: condominoNome.trim() }] });
    setNumero('');
    setCondominoNome('');
  }

  function remover(idx: number) {
    onChange({ unidades: config.unidades.filter((_, i) => i !== idx) });
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3 items-end">
        <div>
          <label className={lbl}>Número da unidade *</label>
          <input
            className={cls}
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Ex: 101, Bloco A-201"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }}
          />
        </div>
        <div>
          <label className={lbl}>Condômino (opcional)</label>
          <input
            className={cls}
            value={condominoNome}
            onChange={(e) => setCondominoNome(e.target.value)}
            placeholder="Nome do condômino"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }}
          />
        </div>
        <button
          onClick={adicionar}
          disabled={!numero.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4 inline mr-1" />
          Adicionar
        </button>
      </div>

      {config.unidades.length > 0 && (
        <div>
          <label className={lbl}>Unidades cadastradas ({config.unidades.length})</label>
          <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-100">
            {config.unidades.map((u, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-neutral-400" />
                  <span className="text-sm font-medium">{u.numero}</span>
                  {u.condominoNome && <span className="text-xs text-neutral-500">— {u.condominoNome}</span>}
                </div>
                <button onClick={() => remover(i)} className="text-neutral-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SecaoMembros({ config, onChange }: { config: ConfiguracoesData; onChange: (p: Partial<ConfiguracoesData>) => void }) {
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [novo, setNovo] = useState({ nomeCompleto: '', cpf: '', email: '' });

  function adicionarNovo() {
    if (!novo.nomeCompleto.trim() || !novo.cpf.trim()) return;
    onChange({ membros: [...config.membros, { ...novo, isNovo: true }] });
    setNovo({ nomeCompleto: '', cpf: '', email: '' });
    setMostrarNovo(false);
  }

  function remover(idx: number) {
    onChange({ membros: config.membros.filter((_, i) => i !== idx) });
  }

  return (
    <>
      {!mostrarNovo ? (
        <button
          onClick={() => setMostrarNovo(true)}
          className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Cadastrar novo membro
        </button>
      ) : (
        <div className="border border-green-200 rounded-lg p-4 bg-green-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-green-700">Novo membro</span>
            <button onClick={() => setMostrarNovo(false)} className="text-neutral-400 hover:text-neutral-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Nome completo *</label>
              <input className={cls} value={novo.nomeCompleto} onChange={(e) => setNovo({ ...novo, nomeCompleto: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>CPF *</label>
              <input className={cls} value={novo.cpf} onChange={(e) => setNovo({ ...novo, cpf: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input className={cls} type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
            </div>
          </div>
          <button
            onClick={adicionarNovo}
            disabled={!novo.nomeCompleto.trim() || !novo.cpf.trim()}
            className="px-4 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Adicionar
          </button>
        </div>
      )}

      {config.membros.length > 0 && (
        <div>
          <label className={lbl}>Membros selecionados ({config.membros.length})</label>
          <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-100">
            {config.membros.map((m, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-neutral-400" />
                  <span className="text-sm">{m.nomeCompleto}</span>
                  <span className="text-xs text-neutral-400">{m.cpf}</span>
                </div>
                <button onClick={() => remover(i)} className="text-neutral-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SecaoDocumentos({ config, onChange }: { config: ConfiguracoesData; onChange: (p: Partial<ConfiguracoesData>) => void }) {
  return (
    <>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onChange({ temModeloProprio: true })}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
            config.temModeloProprio === true
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-neutral-700 border-neutral-300 hover:border-green-400'
          }`}
        >
          Sim, tenho modelos próprios
        </button>
        <button
          type="button"
          onClick={() => onChange({ temModeloProprio: false })}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
            config.temModeloProprio === false
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-neutral-700 border-neutral-300 hover:border-green-400'
          }`}
        >
          Usar modelos padrão
        </button>
      </div>

      {config.temModeloProprio === true && (
        <p className="text-sm text-neutral-500">
          Faça upload dos modelos em Configurações &rarr; Documentos após concluir este wizard.
        </p>
      )}

      {config.temModeloProprio === false && (
        <p className="text-sm text-green-600">
          Os modelos padrão de contrato e procuração serão aplicados automaticamente.
        </p>
      )}
    </>
  );
}

export default function Step3Configuracoes({ tiposOperacao, configuracoes, onChange, onSubmit }: Step3Props) {
  const [secaoAberta, setSecaoAberta] = useState('cobranca');

  function toggleSecao(secao: string) {
    setSecaoAberta((prev) => (prev === secao ? '' : secao));
  }

  const secoes: Array<{ key: string; titulo: string; visivel: boolean }> = [
    { key: 'cobranca', titulo: 'Modelo de Cobrança', visivel: tiposOperacao.usina || tiposOperacao.condominio || tiposOperacao.empresa },
    { key: 'membros', titulo: 'Membros / Cooperados', visivel: tiposOperacao.usina || tiposOperacao.empresa },
    { key: 'condominio', titulo: 'Unidades do Condomínio', visivel: tiposOperacao.condominio },
    { key: 'asaas', titulo: 'Integração Asaas (Pagamentos)', visivel: true },
    { key: 'banco', titulo: 'Integração Bancária', visivel: true },
    { key: 'documentos', titulo: 'Modelos de Documento', visivel: true },
  ];

  const secoesVisiveis = secoes.filter((s) => s.visivel);

  function renderSecao(key: string) {
    switch (key) {
      case 'cobranca': return <SecaoCobranca config={configuracoes} onChange={onChange} />;
      case 'membros': return <SecaoMembros config={configuracoes} onChange={onChange} />;
      case 'condominio': return <SecaoCondominio config={configuracoes} onChange={onChange} />;
      case 'asaas': return <SecaoAsaas config={configuracoes} onChange={onChange} />;
      case 'banco': return <SecaoBanco config={configuracoes} onChange={onChange} />;
      case 'documentos': return <SecaoDocumentos config={configuracoes} onChange={onChange} />;
      default: return null;
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-800">Configurações</h2>
      <p className="text-sm text-neutral-500">
        Configure as opções específicas para os tipos de operação selecionados.
      </p>

      <div className="space-y-3">
        {secoesVisiveis.map((secao) => (
          <Section
            key={secao.key}
            titulo={secao.titulo}
            aberto={secaoAberta === secao.key}
            onToggle={() => toggleSecao(secao.key)}
          >
            {renderSecao(secao.key)}
          </Section>
        ))}
      </div>

      <div className="pt-2 flex justify-end">
        <button
          onClick={onSubmit}
          className="px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
        >
          Próximo
        </button>
      </div>
    </div>
  );
}
