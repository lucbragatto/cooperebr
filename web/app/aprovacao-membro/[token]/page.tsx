'use client';

/**
 * Sprint Convite-Convênio Fatia 4 (03/06/2026) — Página da EMPRESA decidir.
 *
 * Fluxo single-page:
 *   validando → decidindo → decisao-registrada
 *   invalido (token inexistente / expirado / usado / status mudou)
 *
 * Empresa abre o link magic via WhatsApp e CONFIRMA ou RECUSA que o
 * cooperado [nomeConvidado] é seu funcionário/médico. Decisão consequente
 * financeira — banner âmbar AVISO SEMPRE VISÍVEL (não-dismissível).
 *
 * Defesa LGPD: backend retorna apenas sufixos (cpf ...XXX, telefone ...XX99).
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  User,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { formatErroBackend } from '@/lib/utils';
import api from '@/lib/api';

type Etapa = 'validando' | 'invalido' | 'decidindo' | 'decisao-registrada';

interface TokenValido {
  valido: true;
  empresaNome: string;
  nomeConvidado: string;
  cpfSufixo: string;
  telefoneSufixo: string;
  dataAdesao: string;
}
interface TokenInvalido {
  valido: false;
  motivo?: string;
}
type ValidacaoToken = TokenValido | TokenInvalido;

export default function AprovacaoMembroPage() {
  const params = useParams();
  const token = (params?.token as string) ?? '';

  const [etapa, setEtapa] = useState<Etapa>('validando');
  const [validacao, setValidacao] = useState<ValidacaoToken | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // Dialogs
  const [dialogConfirmarAberto, setDialogConfirmarAberto] = useState(false);
  const [dialogRecusarAberto, setDialogRecusarAberto] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');

  const [decisaoRegistrada, setDecisaoRegistrada] = useState<'APROVAR' | 'REJEITAR' | null>(null);

  // ─── Validar token ──────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setEtapa('invalido');
      setValidacao({ valido: false, motivo: 'Link incompleto.' });
      return;
    }
    api
      .get<ValidacaoToken>(`/publico/aprovacao-membro/${token}`)
      .then((r) => {
        setValidacao(r.data);
        setEtapa(r.data.valido ? 'decidindo' : 'invalido');
      })
      .catch((err) => {
        setValidacao({ valido: false, motivo: formatErroBackend(err) });
        setEtapa('invalido');
      });
  }, [token]);

  // ─── Decidir ────────────────────────────────────────────────────
  async function decidir(decisao: 'APROVAR' | 'REJEITAR', motivo?: string) {
    setLoading(true);
    setErro('');
    try {
      await api.post(`/publico/aprovacao-membro/${token}`, {
        decisao,
        motivo: motivo?.trim() || undefined,
      });
      setDecisaoRegistrada(decisao);
      setEtapa('decisao-registrada');
      setDialogConfirmarAberto(false);
      setDialogRecusarAberto(false);
    } catch (err) {
      setErro(formatErroBackend(err));
    } finally {
      setLoading(false);
    }
  }

  // ─── Renderização ───────────────────────────────────────────────

  if (etapa === 'validando') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-100 p-4">
        <Loader2 className="w-10 h-10 animate-spin text-amber-600" />
      </div>
    );
  }

  if (etapa === 'invalido') {
    const motivo = validacao && !validacao.valido ? validacao.motivo : 'Link indisponível.';
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-6 h-6" /> Link indisponível
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-700">{motivo}</p>
            <p className="text-xs text-gray-500">
              Se você acredita que isso é um erro, peça ao admin da CoopereBR pra reenviar o link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (etapa === 'decisao-registrada' && decisaoRegistrada && validacao?.valido) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle
              className={`flex items-center gap-2 ${
                decisaoRegistrada === 'APROVAR' ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {decisaoRegistrada === 'APROVAR' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <XCircle className="w-6 h-6" />
              )}
              Decisão registrada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {decisaoRegistrada === 'APROVAR' ? (
              <>
                <p className="text-sm text-gray-800">
                  Você confirmou que <strong>{validacao.nomeConvidado}</strong> é membro da sua empresa.
                </p>
                <p className="text-sm text-gray-700">
                  Agora o admin da CoopereBR vai revisar e ativar o cadastro. Quando ele estiver ativo, o
                  cooperado entra na cobrança consolidada do convênio.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-800">
                  Você recusou o cadastro de <strong>{validacao.nomeConvidado}</strong>.
                </p>
                <p className="text-sm text-gray-700">
                  Avisamos o cooperado com o motivo. Se foi engano, peça ao admin da CoopereBR pra gerar um
                  novo link.
                </p>
              </>
            )}
            <p className="text-xs text-gray-500">Você pode fechar esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!validacao || !validacao.valido) return null;

  // Etapa principal: decidindo
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 p-4 sm:p-6">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-center gap-2 py-2">
          <Zap className="w-7 h-7 text-amber-500" />
          <h1 className="text-xl font-bold text-amber-900">CoopereBR</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-amber-900 flex items-center gap-2">
              <Building2 className="w-5 h-5" /> Confirmação de membro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* HelpBox AVISO sempre-visível (decisão Luciano: NÃO dismissível
                — aviso de consequência financeira. Inline em vez do componente
                HelpBox que tem botão fechar.) */}
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
              <h2 className="font-semibold text-sm flex items-center gap-2 text-amber-900">
                <AlertTriangle className="w-4 h-4" /> Atenção: confirme com calma
              </h2>
              <p className="text-xs text-amber-800 mt-2 space-y-1">
                Você está confirmando que <strong>{validacao.nomeConvidado}</strong> é seu
                funcionário/médico. Ao <strong>CONFIRMAR</strong>, ele entra no convênio e a energia dele
                passa a ser <strong>custeada pela sua empresa</strong>. Ao <strong>RECUSAR</strong>, ele
                não é incluído.
              </p>
              <p className="text-xs text-amber-800 mt-2">
                <strong>Ex:</strong> confirme só quem realmente trabalha na sua empresa.
              </p>
            </div>

            {/* Dados do cooperado */}
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm space-y-2">
              <div className="flex items-center gap-2 text-gray-800">
                <User className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{validacao.nomeConvidado}</span>
              </div>
              <div className="text-xs text-gray-600 grid grid-cols-2 gap-y-1">
                <div>CPF: <span className="font-mono">{validacao.cpfSufixo}</span></div>
                <div>WhatsApp: <span className="font-mono">{validacao.telefoneSufixo}</span></div>
                <div className="col-span-2">
                  Cadastrado em:{' '}
                  {new Date(validacao.dataAdesao).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </div>
              </div>
            </div>

            {erro && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-300 rounded p-2">{erro}</p>
            )}

            {/* Ações */}
            <div className="space-y-2 pt-2">
              <Button
                onClick={() => setDialogConfirmarAberto(true)}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                CONFIRMAR — é meu funcionário/médico
              </Button>
              <Button
                onClick={() => setDialogRecusarAberto(true)}
                disabled={loading}
                variant="outline"
                className="w-full border-red-300 text-red-700 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-2" />
                RECUSAR — não é meu funcionário/médico
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog CONFIRMAR */}
      <Dialog open={dialogConfirmarAberto} onOpenChange={(o) => !loading && setDialogConfirmarAberto(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar inclusão?</DialogTitle>
            <DialogDescription>
              Ao confirmar, <strong>{validacao.nomeConvidado}</strong> passa a ser membro do seu convênio.
              A energia dele será custeada pela sua empresa a partir da próxima cobrança consolidada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogConfirmarAberto(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => decidir('APROVAR')}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Sim, confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog RECUSAR */}
      <Dialog open={dialogRecusarAberto} onOpenChange={(o) => !loading && setDialogRecusarAberto(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar cadastro?</DialogTitle>
            <DialogDescription>
              Conte por que está recusando. O motivo será enviado pro cooperado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="motivo-recusa">Motivo (mínimo 2 caracteres)</Label>
            <Textarea
              id="motivo-recusa"
              value={motivoRecusa}
              onChange={(e) => setMotivoRecusa(e.target.value)}
              placeholder="Ex: não trabalha mais aqui / dados não conferem"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-500 text-right">{motivoRecusa.length}/500</p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogRecusarAberto(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => decidir('REJEITAR', motivoRecusa)}
              disabled={loading || motivoRecusa.trim().length < 2}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
            >
              {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Recusar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
