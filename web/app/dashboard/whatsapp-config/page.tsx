'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  MessageSquare, Bot, Plus, Pencil, Trash2, Send, Eye, ChevronUp, ChevronDown,
  ArrowLeft, Zap, Wrench, Play,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ModeloMensagem {
  id: string;
  cooperativaId: string | null;
  nome: string;
  categoria: string;
  conteudo: string;
  ativo: boolean;
  usosCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Gatilho {
  resposta: string;
  proximoEstado: string;
}

interface FluxoEtapa {
  id: string;
  cooperativaId: string | null;
  nome: string;
  ordem: number;
  estado: string;
  modeloMensagemId: string | null;
  gatilhos: Gatilho[];
  timeoutHoras: number | null;
  modeloFollowupId: string | null;
  acaoAutomatica: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  modeloMensagem?: ModeloMensagem | null;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const CATEGORIAS = ['BOT', 'COBRANCA', 'MLM', 'MANUAL'] as const;
const CATEGORIA_CORES: Record<string, string> = {
  BOT: 'bg-blue-100 text-blue-800',
  COBRANCA: 'bg-orange-100 text-orange-800',
  MLM: 'bg-purple-100 text-purple-800',
  MANUAL: 'bg-gray-100 text-gray-800',
};

const VARIAVEIS = [
  '{{nome}}', '{{economia}}', '{{link}}', '{{desconto}}', '{{mes}}',
  '{{kwh}}', '{{valor_fatura}}', '{{distribuidora}}', '{{vencimento}}',
  '{{codigo_indicacao}}', '{{parceiro}}', '{{usina}}', '{{status_contrato}}',
  '{{cpf}}', '{{telefone}}', '{{email}}',
];
const VARIAVEIS_EXEMPLO: Record<string, string> = {
  '{{nome}}': 'João Silva',
  '{{economia}}': 'R$ 150,00',
  '{{link}}': 'https://cooperebr.com.br/proposta/abc123',
  '{{desconto}}': '18%',
  '{{mes}}': 'março/2026',
  '{{kwh}}': '350',
  '{{valor_fatura}}': 'R$ 280,00',
  '{{distribuidora}}': 'EDP Espírito Santo',
  '{{vencimento}}': '10/04/2026',
  '{{codigo_indicacao}}': 'IND-ABC123',
  '{{parceiro}}': 'Parceiro Solar ES',
  '{{usina}}': 'Usina Solar Linhares',
  '{{status_contrato}}': 'ATIVO',
  '{{cpf}}': '123.456.789-00',
  '{{telefone}}': '27981341348',
  '{{email}}': 'joao@email.com',
};

const ACOES_AUTOMATICAS = ['CRIAR_LEAD', 'GERAR_PROPOSTA', 'NOTIFICAR_EQUIPE'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderPreview(conteudo: string): string {
  let texto = conteudo;
  for (const [v, val] of Object.entries(VARIAVEIS_EXEMPLO)) {
    texto = texto.replaceAll(v, val);
  }
  return texto;
}

function highlightVariaveis(conteudo: string): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = [];
  const regex = /(\{\{[a-zA-Z_]+\}\})/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(conteudo)) !== null) {
    if (match.index > last) parts.push(conteudo.slice(last, match.index));
    parts.push(
      <span key={match.index} className="bg-yellow-200 text-yellow-900 px-1 rounded font-mono text-xs">
        {match[0]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < conteudo.length) parts.push(conteudo.slice(last));
  return parts;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function WhatsAppConfigPage() {
  const [aba, setAba] = useState<'mensagens' | 'fluxo'>('mensagens');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Configuração WhatsApp</h1>
          <p className="text-sm text-gray-500">Gerencie mensagens e fluxo do bot</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setAba('mensagens')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            aba === 'mensagens'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <MessageSquare className="w-4 h-4 inline mr-1" />
          Banco de Mensagens
        </button>
        <button
          onClick={() => setAba('fluxo')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            aba === 'fluxo'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bot className="w-4 h-4 inline mr-1" />
          Fluxo do Bot
        </button>
      </div>

      {aba === 'mensagens' ? <AbaMensagens /> : <AbaFluxo />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABA 1: BANCO DE MENSAGENS
// ═══════════════════════════════════════════════════════════════════════════════

function AbaMensagens() {
  const [modelos, setModelos] = useState<ModeloMensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<ModeloMensagem | null>(null);
  const [modalTeste, setModalTeste] = useState<string | null>(null);
  const [telefoneTeste, setTelefoneTeste] = useState('');
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');

  const carregarModelos = useCallback(async () => {
    try {
      const params = filtroCategoria ? `?categoria=${filtroCategoria}` : '';
      const { data } = await api.get(`/modelos-mensagem${params}`);
      setModelos(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [filtroCategoria]);

  useEffect(() => { carregarModelos(); }, [carregarModelos]);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta mensagem?')) return;
    await api.delete(`/modelos-mensagem/${id}`);
    carregarModelos();
  };

  const handleTestar = async () => {
    if (!modalTeste || !telefoneTeste) return;
    setEnviandoTeste(true);
    try {
      await api.post(`/modelos-mensagem/${modalTeste}/testar`, { telefone: telefoneTeste });
      alert('Mensagem de teste enviada!');
      setModalTeste(null);
      setTelefoneTeste('');
      carregarModelos();
    } catch {
      alert('Erro ao enviar teste');
    } finally {
      setEnviandoTeste(false);
    }
  };

  const handleToggleAtivo = async (modelo: ModeloMensagem) => {
    await api.put(`/modelos-mensagem/${modelo.id}`, { ativo: !modelo.ativo });
    carregarModelos();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex gap-2 items-center">
          <Label className="text-sm text-gray-600">Filtrar:</Label>
          <Select value={filtroCategoria} onValueChange={(v) => setFiltroCategoria(v ?? '')}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEditando(null); setModalAberto(true); }} className="bg-green-600 hover:bg-green-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Nova mensagem
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : modelos.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhum modelo de mensagem cadastrado</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-center">Usos</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelos.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORIA_CORES[m.categoria] ?? 'bg-gray-100 text-gray-800'}`}>
                        {m.categoria}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{m.usosCount}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={m.ativo ? 'default' : 'secondary'}>
                        {m.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon-sm" onClick={() => handleToggleAtivo(m)} title={m.ativo ? 'Desativar' : 'Ativar'}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setModalTeste(m.id)} title="Enviar teste">
                          <Send className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => { setEditando(m); setModalAberto(true); }} title="Editar">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(m.id)} title="Excluir" className="text-red-600 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal criar/editar mensagem */}
      <ModalMensagem
        aberto={modalAberto}
        onFechar={() => { setModalAberto(false); setEditando(null); }}
        modelo={editando}
        onSalvar={carregarModelos}
      />

      {/* Modal enviar teste */}
      <Dialog open={!!modalTeste} onOpenChange={(open) => { if (!open) { setModalTeste(null); setTelefoneTeste(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Enviar mensagem de teste</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Telefone (com DDD)</Label>
            <Input
              placeholder="5511999999999"
              value={telefoneTeste}
              onChange={(e) => setTelefoneTeste(e.target.value)}
            />
            <p className="text-xs text-gray-500">As variáveis serão substituídas por valores de exemplo.</p>
          </div>
          <DialogFooter>
            <Button onClick={handleTestar} disabled={enviandoTeste || !telefoneTeste} className="bg-green-600 hover:bg-green-700 text-white">
              {enviandoTeste ? 'Enviando...' : 'Enviar teste'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Modal Mensagem ──────────────────────────────────────────────────────────

function ModalMensagem({
  aberto, onFechar, modelo, onSalvar,
}: {
  aberto: boolean;
  onFechar: () => void;
  modelo: ModeloMensagem | null;
  onSalvar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<string>('BOT');
  const [conteudo, setConteudo] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (modelo) {
      setNome(modelo.nome);
      setCategoria(modelo.categoria);
      setConteudo(modelo.conteudo);
      setAtivo(modelo.ativo);
    } else {
      setNome('');
      setCategoria('BOT');
      setConteudo('');
      setAtivo(true);
    }
  }, [modelo, aberto]);

  const inserirVariavel = (variavel: string) => {
    const ta = textareaRef.current;
    if (!ta) { setConteudo((prev) => prev + variavel); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const novo = conteudo.slice(0, start) + variavel + conteudo.slice(end);
    setConteudo(novo);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + variavel.length;
    }, 0);
  };

  const handleSalvar = async () => {
    if (!nome || !conteudo) return;
    setSalvando(true);
    try {
      if (modelo) {
        await api.put(`/modelos-mensagem/${modelo.id}`, { nome, categoria, conteudo, ativo });
      } else {
        await api.post('/modelos-mensagem', { nome, categoria, conteudo, ativo });
      }
      onSalvar();
      onFechar();
    } catch {
      alert('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(open) => { if (!open) onFechar(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{modelo ? 'Editar mensagem' : 'Nova mensagem'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Formulário */}
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Boas-vindas fatura" />
            </div>

            <div>
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v ?? 'BOT')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>{c === 'COBRANCA' ? 'COBRANÇA' : c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Conteúdo</Label>
              <Textarea
                ref={textareaRef}
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                placeholder="Digite a mensagem... Use {{variavel}} para conteúdo dinâmico"
                rows={8}
                className="font-mono text-sm min-h-[200px] resize-y"
              />
            </div>

            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Variáveis disponíveis (clique para inserir)</Label>
              <div className="flex flex-wrap gap-1">
                {VARIAVEIS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => inserirVariavel(v)}
                    className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-mono hover:bg-yellow-200 transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={ativo} onCheckedChange={setAtivo} />
              <Label className="text-sm">{ativo ? 'Ativo' : 'Inativo'}</Label>
            </div>
          </div>

          {/* Preview */}
          <div>
            <Label className="mb-2 block">Preview</Label>
            <div className="bg-gray-100 rounded-lg p-4 min-h-[200px]">
              <div className="bg-white rounded-lg p-3 shadow-sm border max-w-[280px]">
                <div className="text-xs text-gray-500 mb-1 font-medium">{nome || 'Sem nome'}</div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {conteudo ? highlightVariaveis(conteudo) : <span className="text-gray-400 italic">Nenhum conteúdo</span>}
                </div>
              </div>
              {conteudo && (
                <div className="mt-3">
                  <div className="text-xs text-gray-500 mb-1">Com valores de exemplo:</div>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200 max-w-[280px]">
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {renderPreview(conteudo)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando || !nome || !conteudo} className="bg-green-600 hover:bg-green-700 text-white">
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABA 2: FLUXO DO BOT
// ═══════════════════════════════════════════════════════════════════════════════

function AbaFluxo() {
  const [etapas, setEtapas] = useState<FluxoEtapa[]>([]);
  const [modelos, setModelos] = useState<ModeloMensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<FluxoEtapa | null>(null);
  const [previewAberto, setPreviewAberto] = useState(false);
  const [previewData, setPreviewData] = useState<FluxoEtapa[]>([]);
  const [testarAberto, setTestarAberto] = useState(false);
  const [telefoneTeste, setTelefoneTeste] = useState('');
  const [testando, setTestando] = useState(false);
  const [testeLog, setTesteLog] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    try {
      const [etapasRes, modelosRes] = await Promise.all([
        api.get('/fluxo-etapas'),
        api.get('/modelos-mensagem'),
      ]);
      setEtapas(etapasRes.data);
      setModelos(modelosRes.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta etapa?')) return;
    await api.delete(`/fluxo-etapas/${id}`);
    carregar();
  };

  const handleMover = async (etapa: FluxoEtapa, direcao: 'up' | 'down') => {
    const idx = etapas.findIndex((e) => e.id === etapa.id);
    const outroIdx = direcao === 'up' ? idx - 1 : idx + 1;
    if (outroIdx < 0 || outroIdx >= etapas.length) return;
    const outro = etapas[outroIdx];
    await Promise.all([
      api.put(`/fluxo-etapas/${etapa.id}`, { ordem: outro.ordem }),
      api.put(`/fluxo-etapas/${outro.id}`, { ordem: etapa.ordem }),
    ]);
    carregar();
  };

  const handlePreview = async () => {
    try {
      const { data } = await api.get('/fluxo-etapas/preview');
      setPreviewData(data);
      setPreviewAberto(true);
    } catch {
      alert('Erro ao carregar preview');
    }
  };

  const getModeloNome = (id: string | null) => {
    if (!id) return '—';
    return modelos.find((m) => m.id === id)?.nome ?? '—';
  };

  const getModeloPreview = (etapa: FluxoEtapa): string | null => {
    const modelo = etapa.modeloMensagem ?? modelos.find((m) => m.id === etapa.modeloMensagemId);
    if (!modelo) return null;
    const text = modelo.conteudo;
    return text.length > 100 ? text.slice(0, 100) + '...' : text;
  };

  const isMotorDinamico = (etapa: FluxoEtapa): boolean => {
    return etapa.ativo && !!etapa.modeloMensagemId && Array.isArray(etapa.gatilhos) && etapa.gatilhos.length > 0;
  };

  const handleTestarFluxo = async () => {
    if (!telefoneTeste) return;
    setTestando(true);
    setTesteLog([]);
    const logs: string[] = [];

    try {
      // Simular o fluxo completo enviando mensagens na sequência
      const etapasAtivas = etapas.filter((e) => e.ativo).sort((a, b) => a.ordem - b.ordem);

      for (const etapa of etapasAtivas) {
        const modelo = etapa.modeloMensagem ?? modelos.find((m) => m.id === etapa.modeloMensagemId);
        if (modelo) {
          logs.push(`#${etapa.ordem} ${etapa.nome}: enviando "${modelo.nome}"...`);
          setTesteLog([...logs]);
          try {
            await api.post(`/modelos-mensagem/${modelo.id}/testar`, { telefone: telefoneTeste });
            logs[logs.length - 1] = `✓ #${etapa.ordem} ${etapa.nome}: "${modelo.nome}" enviada`;
          } catch {
            logs[logs.length - 1] = `✗ #${etapa.ordem} ${etapa.nome}: falha ao enviar`;
          }
          setTesteLog([...logs]);
        } else {
          logs.push(`— #${etapa.ordem} ${etapa.nome}: sem mensagem vinculada`);
          setTesteLog([...logs]);
        }
      }

      logs.push('\n✅ Simulação concluída!');
      setTesteLog([...logs]);
    } catch {
      logs.push('\n✗ Erro ao simular fluxo');
      setTesteLog([...logs]);
    } finally {
      setTestando(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePreview}>
            <Eye className="w-4 h-4 mr-1" /> Visualizar fluxo
          </Button>
          <Button variant="outline" onClick={() => { setTestarAberto(true); setTesteLog([]); }}>
            <Play className="w-4 h-4 mr-1" /> Testar fluxo
          </Button>
        </div>
        <Button onClick={() => { setEditando(null); setModalAberto(true); }} className="bg-green-600 hover:bg-green-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Nova etapa
        </Button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Carregando...</div>
      ) : etapas.length === 0 ? (
        <div className="p-8 text-center text-gray-500">Nenhuma etapa configurada</div>
      ) : (
        <div className="space-y-3">
          {etapas.map((etapa, idx) => {
            const dinamico = isMotorDinamico(etapa);
            const preview = getModeloPreview(etapa);

            return (
              <Card key={etapa.id} className={`border-l-4 ${dinamico ? 'border-l-amber-400' : 'border-l-gray-400'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full">
                          #{etapa.ordem}
                        </span>
                        <span className="font-medium text-gray-800">{etapa.nome}</span>
                        <Badge variant="outline">{etapa.estado}</Badge>
                        {dinamico ? (
                          <span title="Motor dinâmico" className="inline-flex items-center gap-0.5 text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <Zap className="w-3 h-3" /> Dinâmico
                          </span>
                        ) : (
                          <span title="Fallback hardcoded" className="inline-flex items-center gap-0.5 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            <Wrench className="w-3 h-3" /> Hardcoded
                          </span>
                        )}
                        {!etapa.ativo && <Badge variant="secondary">Inativo</Badge>}
                      </div>

                      {preview && (
                        <div className="bg-gray-50 rounded p-2 text-xs text-gray-600 font-mono whitespace-pre-wrap border border-gray-200">
                          {preview}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600">
                        <div>
                          <span className="text-xs text-gray-400">Mensagem:</span>{' '}
                          {getModeloNome(etapa.modeloMensagemId)}
                        </div>
                        <div>
                          <span className="text-xs text-gray-400">Ação:</span>{' '}
                          {etapa.acaoAutomatica ?? '—'}
                        </div>
                        <div>
                          <span className="text-xs text-gray-400">Timeout:</span>{' '}
                          {etapa.timeoutHoras ? `${etapa.timeoutHoras}h` : '—'}
                        </div>
                      </div>

                      {Array.isArray(etapa.gatilhos) && etapa.gatilhos.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {etapa.gatilhos.map((g: Gatilho, gi: number) => (
                            <span key={gi} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                              &quot;{g.resposta}&quot; → {g.proximoEstado}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 ml-2">
                      <Button variant="ghost" size="icon-sm" onClick={() => handleMover(etapa, 'up')} disabled={idx === 0}>
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleMover(etapa, 'down')} disabled={idx === etapas.length - 1}>
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => { setEditando(etapa); setModalAberto(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(etapa.id)} className="text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal criar/editar etapa */}
      <ModalEtapa
        aberto={modalAberto}
        onFechar={() => { setModalAberto(false); setEditando(null); }}
        etapa={editando}
        modelos={modelos}
        totalEtapas={etapas.length}
        onSalvar={carregar}
      />

      {/* Modal preview fluxo */}
      <Dialog open={previewAberto} onOpenChange={setPreviewAberto}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fluxo completo do Bot</DialogTitle>
          </DialogHeader>
          <div className="space-y-0">
            {previewData.map((etapa, idx) => (
              <div key={etapa.id} className="relative">
                {idx > 0 && (
                  <div className="flex justify-center py-1">
                    <div className="w-0.5 h-6 bg-green-300" />
                  </div>
                )}
                <div className="border rounded-lg p-3 bg-white shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-green-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                      {etapa.ordem}
                    </span>
                    <span className="font-medium">{etapa.nome}</span>
                    <Badge variant="outline">{etapa.estado}</Badge>
                  </div>
                  {etapa.modeloMensagem && (
                    <div className="ml-8 space-y-1">
                      <div className="text-xs text-gray-500">
                        📨 {etapa.modeloMensagem.nome}
                      </div>
                      <div className="bg-gray-50 rounded p-2 text-xs text-gray-600 font-mono whitespace-pre-wrap border border-gray-200">
                        {etapa.modeloMensagem.conteudo.length > 120
                          ? etapa.modeloMensagem.conteudo.slice(0, 120) + '...'
                          : etapa.modeloMensagem.conteudo}
                      </div>
                    </div>
                  )}
                  {etapa.acaoAutomatica && (
                    <div className="text-xs text-purple-600 ml-8">
                      ⚡ {etapa.acaoAutomatica}
                    </div>
                  )}
                  {Array.isArray(etapa.gatilhos) && etapa.gatilhos.length > 0 && (
                    <div className="ml-8 mt-1 flex flex-wrap gap-1">
                      {etapa.gatilhos.map((g: Gatilho, gi: number) => (
                        <span key={gi} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          &quot;{g.resposta}&quot; → {g.proximoEstado}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {previewData.length === 0 && (
              <p className="text-center text-gray-500 py-8">Nenhuma etapa ativa configurada</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal testar fluxo */}
      <Dialog open={testarAberto} onOpenChange={(open) => { if (!open) { setTestarAberto(false); setTesteLog([]); setTelefoneTeste(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Testar fluxo completo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Telefone (com DDD)</Label>
              <Input
                placeholder="5511999999999"
                value={telefoneTeste}
                onChange={(e) => setTelefoneTeste(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Envia todas as mensagens do fluxo em sequência para o telefone informado.
                As variáveis serão substituídas por valores de exemplo.
              </p>
            </div>

            {testeLog.length > 0 && (
              <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs max-h-48 overflow-y-auto space-y-0.5">
                {testeLog.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTestarAberto(false); setTesteLog([]); setTelefoneTeste(''); }}>
              Fechar
            </Button>
            <Button
              onClick={handleTestarFluxo}
              disabled={testando || !telefoneTeste}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {testando ? 'Simulando...' : 'Iniciar teste'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Modal Etapa ─────────────────────────────────────────────────────────────

function ModalEtapa({
  aberto, onFechar, etapa, modelos, totalEtapas, onSalvar,
}: {
  aberto: boolean;
  onFechar: () => void;
  etapa: FluxoEtapa | null;
  modelos: ModeloMensagem[];
  totalEtapas: number;
  onSalvar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [ordem, setOrdem] = useState(1);
  const [estado, setEstado] = useState('');
  const [modeloMensagemId, setModeloMensagemId] = useState('');
  const [gatilhos, setGatilhos] = useState<Gatilho[]>([]);
  const [timeoutHoras, setTimeoutHoras] = useState('');
  const [modeloFollowupId, setModeloFollowupId] = useState('');
  const [acaoAutomatica, setAcaoAutomatica] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (etapa) {
      setNome(etapa.nome);
      setOrdem(etapa.ordem);
      setEstado(etapa.estado);
      setModeloMensagemId(etapa.modeloMensagemId ?? '');
      setGatilhos(Array.isArray(etapa.gatilhos) ? etapa.gatilhos : []);
      setTimeoutHoras(etapa.timeoutHoras?.toString() ?? '');
      setModeloFollowupId(etapa.modeloFollowupId ?? '');
      setAcaoAutomatica(etapa.acaoAutomatica ?? '');
      setAtivo(etapa.ativo);
    } else {
      setNome('');
      setOrdem(totalEtapas + 1);
      setEstado('');
      setModeloMensagemId('');
      setGatilhos([]);
      setTimeoutHoras('');
      setModeloFollowupId('');
      setAcaoAutomatica('');
      setAtivo(true);
    }
  }, [etapa, aberto, totalEtapas]);

  const addGatilho = () => setGatilhos([...gatilhos, { resposta: '', proximoEstado: '' }]);
  const removeGatilho = (idx: number) => setGatilhos(gatilhos.filter((_, i) => i !== idx));
  const updateGatilho = (idx: number, field: keyof Gatilho, value: string) => {
    const novo = [...gatilhos];
    novo[idx] = { ...novo[idx], [field]: value };
    setGatilhos(novo);
  };

  const handleSalvar = async () => {
    if (!nome || !estado) return;
    setSalvando(true);
    try {
      const payload = {
        nome,
        ordem,
        estado,
        modeloMensagemId: modeloMensagemId || null,
        gatilhos: gatilhos.filter((g) => g.resposta && g.proximoEstado),
        timeoutHoras: timeoutHoras ? parseInt(timeoutHoras) : null,
        modeloFollowupId: modeloFollowupId || null,
        acaoAutomatica: acaoAutomatica || null,
        ativo,
      };
      if (etapa) {
        await api.put(`/fluxo-etapas/${etapa.id}`, payload);
      } else {
        await api.post('/fluxo-etapas', payload);
      }
      onSalvar();
      onFechar();
    } catch {
      alert('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(open) => { if (!open) onFechar(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{etapa ? 'Editar etapa' : 'Nova etapa'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome da etapa</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Aguardando fatura" />
            </div>
            <div>
              <Label>Estado</Label>
              <Input value={estado} onChange={(e) => setEstado(e.target.value)} placeholder="Ex: AGUARDANDO_CONFIRMACAO" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ordem</Label>
              <Input type="number" value={ordem} onChange={(e) => setOrdem(parseInt(e.target.value) || 1)} min={1} />
            </div>
            <div>
              <Label>Ação automática</Label>
              <Select value={acaoAutomatica} onValueChange={(v) => setAcaoAutomatica(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {ACOES_AUTOMATICAS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mensagem ao entrar</Label>
              <Select value={modeloMensagemId} onValueChange={(v) => setModeloMensagemId(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {modelos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mensagem follow-up</Label>
              <Select value={modeloFollowupId} onValueChange={(v) => setModeloFollowupId(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {modelos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Timeout (horas)</Label>
              <Input type="number" value={timeoutHoras} onChange={(e) => setTimeoutHoras(e.target.value)} placeholder="Ex: 24" min={0} />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Switch checked={ativo} onCheckedChange={setAtivo} />
              <Label className="text-sm">{ativo ? 'Ativo' : 'Inativo'}</Label>
            </div>
          </div>

          {/* Gatilhos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Gatilhos (resposta → próximo estado)</Label>
              <Button variant="outline" size="sm" onClick={addGatilho}>
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
            {gatilhos.length === 0 && (
              <p className="text-xs text-gray-400">Nenhum gatilho configurado</p>
            )}
            <div className="space-y-2">
              {gatilhos.map((g, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    value={g.resposta}
                    onChange={(e) => updateGatilho(idx, 'resposta', e.target.value)}
                    placeholder="Resposta (ex: OK, SIM)"
                    className="flex-1"
                  />
                  <span className="text-gray-400">→</span>
                  <Input
                    value={g.proximoEstado}
                    onChange={(e) => updateGatilho(idx, 'proximoEstado', e.target.value)}
                    placeholder="Próximo estado"
                    className="flex-1"
                  />
                  <Button variant="ghost" size="icon-sm" onClick={() => removeGatilho(idx)} className="text-red-500">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando || !nome || !estado} className="bg-green-600 hover:bg-green-700 text-white">
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
