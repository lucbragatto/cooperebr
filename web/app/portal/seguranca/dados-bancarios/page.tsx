'use client';

/**
 * Sprint Clube P1 — F6 Bloco C.0 (13/06/2026).
 *
 * Cadastro/atualização da chave PIX do cooperado.
 *
 * REFORÇO ANTI-FRAUDE: trocar a chave PIX exige PIN — o backend valida
 * via PinCooperadoService. UI explica isso no HelpBox.
 *
 * Padrão UI Tipo B (página própria) + tratamento humano dos 4 motivos
 * de erro de PIN copiados do F4 Bloco D.
 *
 * Fluxo:
 *  1. GET /meu-perfil/dados-bancarios → mostra status (tem? mascarada? recente?)
 *  2. Form: select pixTipo + input pixChave + PinInput (6 dígitos)
 *  3. PUT /meu-perfil/dados-bancarios → backend valida regex + PIN + grava AuditLog
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PinInput } from '@/components/ui/pin-input';
import { HelpBox } from '@/components/ui/help-box';
import {
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';

type PixTipo = 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA';

interface StatusResponse {
  temPixCadastrado: boolean;
  pixChaveMascarada: string | null;
  pixTipo: PixTipo | null;
  pixUltimaAlteracaoEm: string | null;
  alteradaRecentemente: boolean;
}

type ErroMotivo =
  | 'PIN_NAO_DEFINIDO'
  | 'PIN_BLOQUEADO'
  | 'PIN_INCORRETO'
  | 'CHAVE_INVALIDA'
  | 'GENERICO';

interface ErroState {
  motivo: ErroMotivo;
  mensagem: string;
  desbloqueiaEm?: string;
}

const PLACEHOLDERS: Record<PixTipo, string> = {
  CPF: '11122233344 (11 dígitos, só números)',
  CNPJ: '11222333000144 (14 dígitos, só números)',
  EMAIL: 'voce@dominio.com',
  TELEFONE: '+5527981341348 (formato E.164)',
  ALEATORIA: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789 (UUID)',
};

const ROTULOS: Record<PixTipo, string> = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  EMAIL: 'Email',
  TELEFONE: 'Telefone (E.164)',
  ALEATORIA: 'Chave aleatória (EVP)',
};

export default function DadosBancariosPage() {
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [status, setStatus] = useState<StatusResponse | null>(null);

  const [pixTipo, setPixTipo] = useState<PixTipo>('TELEFONE');
  const [pixChave, setPixChave] = useState('');
  const [pin, setPin] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<ErroState | null>(null);

  useEffect(() => {
    let cancelado = false;
    api
      .get<StatusResponse>('/meu-perfil/dados-bancarios')
      .then((r) => {
        if (cancelado) return;
        setStatus(r.data);
      })
      .catch(() => {
        if (!cancelado) {
          setErro({
            motivo: 'GENERICO',
            mensagem: 'Não consegui carregar seus dados bancários. Tente recarregar a página.',
          });
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);

    if (!pixChave.trim()) {
      setErro({ motivo: 'CHAVE_INVALIDA', mensagem: 'Informe a chave PIX.' });
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setErro({ motivo: 'PIN_INCORRETO', mensagem: 'Digite os 6 dígitos do PIN.' });
      return;
    }

    setSalvando(true);
    try {
      const r = await api.put<{ sucesso: true; pixUltimaAlteracaoEm: string }>(
        '/meu-perfil/dados-bancarios',
        { pixTipo, pixChave: pixChave.trim(), pin },
      );
      setSucesso(true);
      setPin('');
      // Recarrega status mascarado
      const novoStatus = await api.get<StatusResponse>('/meu-perfil/dados-bancarios');
      setStatus(novoStatus.data);
      setPixChave('');
      // Atualiza outras telas que dependem (ex: /portal/resgatar-tokens)
      setTimeout(() => router.refresh(), 500);
    } catch (err: any) {
      const msg: string = err?.response?.data?.message ?? 'Erro ao salvar chave PIX.';
      if (/PIN não foi definido|PIN_NAO_DEFINIDO/i.test(msg)) {
        setErro({
          motivo: 'PIN_NAO_DEFINIDO',
          mensagem:
            'PIN não foi configurado. Defina antes de cadastrar PIX (regra anti-fraude — a chave de resgate exige PIN).',
        });
      } else if (/PIN bloqueado|PIN_BLOQUEADO/i.test(msg)) {
        const match = msg.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[\d.Z+-:]*)/);
        setErro({
          motivo: 'PIN_BLOQUEADO',
          mensagem: 'PIN bloqueado por excesso de tentativas.',
          desbloqueiaEm: match?.[1],
        });
        setPin('');
      } else if (/PIN incorreto|PIN_INCORRETO/i.test(msg)) {
        setErro({ motivo: 'PIN_INCORRETO', mensagem: 'PIN incorreto. Tente novamente.' });
        setPin('');
      } else if (
        /CPF inválido|CNPJ inválido|Email inválido|Telefone inválido|UUID/i.test(msg)
      ) {
        setErro({ motivo: 'CHAVE_INVALIDA', mensagem: msg });
      } else {
        setErro({ motivo: 'GENERICO', mensagem: msg });
      }
    } finally {
      setSalvando(false);
    }
  }

  function formatarDataHora(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados bancários...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href="/portal/conta"
        className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar à minha conta
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Chave PIX para resgate de tokens
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <HelpBox
            id="dados-bancarios-anti-fraude"
            titulo="Por que pedimos PIN aqui?"
          >
            <p>
              A chave PIX cadastrada aqui é a <strong>única chave</strong> que recebe
              R$ quando você solicita um <strong>resgate de CooperTokens</strong>{' '}
              (módulo Estabelecimento do Clube).
            </p>
            <p>
              Por segurança, alterar a chave exige o seu <strong>PIN de 6 dígitos</strong>{' '}
              (o mesmo PIN dos resgates). Isso impede que alguém com acesso à sua
              sessão troque a chave e roteie um resgate pra outra conta.
            </p>
            <p>
              Não tem PIN ainda?{' '}
              <Link href="/portal/seguranca/definir-pin" className="underline font-medium">
                Defina agora
              </Link>
              .
            </p>
          </HelpBox>

          {status?.temPixCadastrado && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm">
              <p className="text-muted-foreground text-xs mb-1">Chave cadastrada</p>
              <p className="font-medium">
                {status.pixTipo ? ROTULOS[status.pixTipo as PixTipo] : ''}:{' '}
                <span className="font-mono">{status.pixChaveMascarada}</span>
              </p>
              {status.pixUltimaAlteracaoEm && (
                <p className="text-xs text-muted-foreground mt-1">
                  Última atualização: {formatarDataHora(status.pixUltimaAlteracaoEm)}
                  {status.alteradaRecentemente && (
                    <span className="ml-2 text-amber-700">(menos de 24h atrás)</span>
                  )}
                </p>
              )}
            </div>
          )}

          {sucesso && (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-3 flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Chave PIX salva com sucesso!</p>
                <p className="text-xs mt-1">
                  Ela já pode ser usada em resgates de tokens em R$.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pixTipo">Tipo da chave</Label>
              <select
                id="pixTipo"
                value={pixTipo}
                onChange={(e) => {
                  setPixTipo(e.target.value as PixTipo);
                  setPixChave('');
                  setErro(null);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={salvando}
              >
                {(['TELEFONE', 'EMAIL', 'CPF', 'CNPJ', 'ALEATORIA'] as PixTipo[]).map((t) => (
                  <option key={t} value={t}>
                    {ROTULOS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pixChave">
                {status?.temPixCadastrado ? 'Nova chave PIX' : 'Chave PIX'}
              </Label>
              <Input
                id="pixChave"
                value={pixChave}
                onChange={(e) => {
                  setPixChave(e.target.value);
                  if (erro?.motivo === 'CHAVE_INVALIDA') setErro(null);
                }}
                placeholder={PLACEHOLDERS[pixTipo]}
                disabled={salvando}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                {pixTipo === 'CPF' && 'Só números, sem pontos ou traços.'}
                {pixTipo === 'CNPJ' && 'Só números, sem pontos, barras ou traços.'}
                {pixTipo === 'EMAIL' && 'Use o email que está cadastrado como chave PIX no seu banco.'}
                {pixTipo === 'TELEFONE' &&
                  'Formato E.164 internacional: + + DDI + número (Brasil: +55 + DDD + 9 + número).'}
                {pixTipo === 'ALEATORIA' &&
                  'Gere a chave aleatória (EVP) no app do seu banco e cole o UUID aqui.'}
              </p>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                PIN de 6 dígitos
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Confirma que é você quem está alterando a chave (regra anti-fraude).
              </p>
              <PinInput
                value={pin}
                onChange={(v) => {
                  setPin(v);
                  if (erro?.motivo === 'PIN_INCORRETO') setErro(null);
                }}
                erro={
                  erro?.motivo === 'PIN_INCORRETO' ||
                  erro?.motivo === 'PIN_BLOQUEADO' ||
                  erro?.motivo === 'PIN_NAO_DEFINIDO'
                }
                disabled={
                  salvando ||
                  erro?.motivo === 'PIN_BLOQUEADO' ||
                  erro?.motivo === 'PIN_NAO_DEFINIDO'
                }
              />
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 text-sm space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="space-y-1 flex-1">
                    <p className="font-medium">{erro.mensagem}</p>
                    {erro.motivo === 'PIN_NAO_DEFINIDO' && (
                      <Link
                        href="/portal/seguranca/definir-pin"
                        className="text-red-900 underline text-xs font-semibold inline-block"
                      >
                        Configurar PIN agora →
                      </Link>
                    )}
                    {erro.motivo === 'PIN_BLOQUEADO' && erro.desbloqueiaEm && (
                      <p className="text-xs">
                        Tente novamente após{' '}
                        <strong>{formatarDataHora(erro.desbloqueiaEm)}</strong>.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Link href="/portal/conta">
                <Button type="button" variant="ghost" disabled={salvando}>
                  Cancelar
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={
                  salvando ||
                  pin.length !== 6 ||
                  pixChave.trim().length === 0 ||
                  erro?.motivo === 'PIN_BLOQUEADO' ||
                  erro?.motivo === 'PIN_NAO_DEFINIDO'
                }
              >
                {salvando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" /> Salvar chave PIX
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
