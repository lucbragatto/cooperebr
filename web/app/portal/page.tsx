'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  DollarSign,
  FileText,
  FileWarning,
  Gift,
  Handshake,
  MessageCircle,
  PenTool,
  QrCode,
  Receipt,
  Search,
  ShoppingBag,
  Store,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { getUsuario } from '@/lib/auth';
import api from '@/lib/api';

interface Resumo {
  descontoAtual: number | null;
  proximoVencimento: string | null;
  statusConta: string;
  kwhAlocados: number;
  documentosPendentes: number;
  faturasPendentes: number;
}

interface MeuPerfil {
  id: string;
  nomeCompleto: string;
  codigoIndicacao?: string;
  resumo: Resumo;
  // Sprint Higiene Bloco B (14/06/2026 — D2): habilita o "Balcão do Clube" (/estabelecimento).
  ehEstabelecimento?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Cadastro pendente',
  PENDENTE_VALIDACAO: 'Em validação',
  PENDENTE_DOCUMENTOS: 'Aguardando documentos',
  APROVADO: 'Aprovado',
  ATIVO: 'Ativo',
  ATIVO_RECEBENDO_CREDITOS: 'Recebendo créditos',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
};

const STATUS_ATIVOS = ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS'];

const acoesCarteira: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/portal/tokens', label: 'Pagar', icon: QrCode },
  { href: '/portal/tokens', label: 'Usar na fatura', icon: Receipt },
  { href: '/portal/resgatar-tokens', label: 'Resgatar', icon: Gift },
  { href: '/portal/comprar-tokens', label: 'Comprar', icon: ShoppingBag },
];

const atalhos: { href: string; label: string; desc: string; icon: LucideIcon }[] = [
  { href: '/portal/clube', label: 'Clube de Vantagens', desc: 'Ofertas e resgates', icon: Award },
  { href: '/portal/financeiro', label: 'Financeiro', desc: 'Cobranças e faturas', icon: DollarSign },
  { href: '/portal/ucs', label: 'Minhas UCs', desc: 'Unidades e energia', icon: Zap },
  { href: '/portal/creditos', label: 'Créditos', desc: 'Energia compensada', icon: BarChart3 },
  { href: '/portal/documentos', label: 'Documentos', desc: 'Envios e contrato', icon: FileText },
  { href: '/portal/convenio', label: 'Meu convênio', desc: 'Empresa e benefícios', icon: Handshake },
  { href: '/portal/ranking', label: 'Ranking', desc: 'Seu nível no clube', icon: BarChart3 },
  { href: '/portal/indicacoes', label: 'Indicações', desc: 'Convide e ganhe', icon: Users },
];

function formatarTokens(v: number | null) {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export default function PortalInicioPage() {
  const [perfil, setPerfil] = useState<MeuPerfil | null>(null);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [linkIndicacao, setLinkIndicacao] = useState('');
  const [copiado, setCopiado] = useState(false);
  const usuario = getUsuario();

  useEffect(() => {
    Promise.all([
      api.get('/cooperados/meu-perfil').then((r) => setPerfil(r.data)).catch(() => {}),
      api
        .get('/cooper-token/saldo')
        .then((r) => setSaldo(Number(r.data?.saldoDisponivel ?? 0)))
        .catch(() => setSaldo(null)),
    ]).finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (perfil?.codigoIndicacao) {
      setLinkIndicacao(`${window.location.origin}/entrar?ref=${perfil.codigoIndicacao}`);
    }
  }, [perfil]);

  if (carregando) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Carregando">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-black/5" />
        <div className="h-56 animate-pulse rounded-[28px] bg-black/10" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-3xl bg-black/5" />
          ))}
        </div>
      </div>
    );
  }

  const r = perfil?.resumo;
  const nome = perfil?.nomeCompleto?.split(' ')[0] ?? usuario?.nome?.split(' ')[0] ?? 'Cooperado';
  const statusAtivo = STATUS_ATIVOS.includes(r?.statusConta ?? '');
  const textoConvite = `Conheça o Clube COOPERE-BR: até 20% da conta de luz volta em CooperTokens para usar nos parceiros. Sem obra e sem investimento: ${linkIndicacao}`;

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(linkIndicacao);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* sem permissão: ignora */
    }
  }

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Saudação */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-[#5b6656]">{saudacao},</p>
          <h1 className="text-[28px] font-semibold leading-tight lg:text-4xl">{nome}</h1>
        </div>
        {r?.statusConta && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              statusAtivo ? 'bg-[#d7ff65] text-[#102012]' : 'bg-amber-100 text-amber-900'
            }`}
          >
            {statusAtivo && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            {STATUS_LABEL[r.statusConta] ?? r.statusConta}
          </span>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
        {/* Carteira de tokens */}
        <section
          className="relative overflow-hidden rounded-[28px] bg-[#101510] p-5 text-white shadow-xl shadow-black/10 sm:p-7 lg:col-span-2"
          aria-label="Carteira de CooperTokens"
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-90"
            style={{ background: 'conic-gradient(#d7ff65 0deg 72deg, rgba(255,255,255,0.06) 72deg 360deg)' }}
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[#101510]" aria-hidden="true" />

          <div className="relative">
            <p className="flex items-center gap-2 text-sm text-[#c4ccbf]">
              <Coins className="h-4 w-4 text-[#d7ff65]" aria-hidden="true" />
              Saldo de CooperTokens
            </p>
            <p className="mt-2 text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl">
              {formatarTokens(saldo)}
            </p>
            <p className="mt-2 text-[13px] text-[#a9b3a4]">
              Até 20% da sua fatura volta aqui todo mês. Use nos parceiros do clube.
            </p>

            <div className="mt-6 grid grid-cols-4 gap-2 sm:gap-3">
              {acoesCarteira.map(({ href, label, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-white/10 px-1 py-3 text-center text-[12px] font-medium transition hover:bg-white/15 sm:text-[13px]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d7ff65]">
                    <Icon className="h-5 w-5 text-[#102012]" aria-hidden="true" />
                  </span>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Números do mês */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-1" aria-label="Resumo do mês">
          <div className="rounded-3xl bg-white p-4 ring-1 ring-black/5 sm:p-5">
            <Zap className="h-5 w-5 text-[#166534]" aria-hidden="true" />
            <p className="mt-3 text-xs text-[#5b6656]">kWh alocados no mês</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums">
              {r?.kwhAlocados ? r.kwhAlocados.toLocaleString('pt-BR') : '0'}
            </p>
          </div>
          <div className="rounded-3xl bg-white p-4 ring-1 ring-black/5 sm:p-5">
            <Calendar className="h-5 w-5 text-[#166534]" aria-hidden="true" />
            <p className="mt-3 text-xs text-[#5b6656]">Próximo vencimento</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums">
              {r?.proximoVencimento ? new Date(r.proximoVencimento).toLocaleDateString('pt-BR') : '—'}
            </p>
          </div>
          {r?.descontoAtual != null && (
            <div className="col-span-2 rounded-3xl bg-white p-4 ring-1 ring-black/5 sm:p-5 lg:col-span-1">
              <p className="text-xs text-[#5b6656]">Seu percentual de benefício</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums">{r.descontoAtual}%</p>
            </div>
          )}
        </section>
      </div>

      {/* Pendências */}
      {((r?.documentosPendentes ?? 0) > 0 || (r?.faturasPendentes ?? 0) > 0) && (
        <section className="space-y-2" aria-label="Pendências">
          {(r?.faturasPendentes ?? 0) > 0 && (
            <Link
              href="/portal/financeiro"
              className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 ring-1 ring-red-200"
            >
              <DollarSign className="h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
              <span className="flex-1 text-sm font-medium text-red-900">
                {r!.faturasPendentes} {r!.faturasPendentes === 1 ? 'fatura em aberto' : 'faturas em aberto'}
              </span>
              <ArrowRight className="h-4 w-4 text-red-700" aria-hidden="true" />
            </Link>
          )}
          {(r?.documentosPendentes ?? 0) > 0 && (
            <Link
              href="/portal/documentos"
              className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200"
            >
              <FileWarning className="h-5 w-5 shrink-0 text-amber-800" aria-hidden="true" />
              <span className="flex-1 text-sm font-medium text-amber-950">
                {r!.documentosPendentes}{' '}
                {r!.documentosPendentes === 1 ? 'documento pendente' : 'documentos pendentes'}
              </span>
              <ArrowRight className="h-4 w-4 text-amber-800" aria-hidden="true" />
            </Link>
          )}
        </section>
      )}

      {/* Etapas do cadastro (só quando ainda não está ativo) */}
      {r?.statusConta && !statusAtivo && (
        <section className="rounded-3xl bg-white p-5 ring-1 ring-black/5" aria-label="Etapas do cadastro">
          <h2 className="text-base font-semibold">Etapas do seu cadastro</h2>
          <ol className="mt-4 space-y-4">
            <li className="flex gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#166534]" aria-hidden="true" />
              <p className="text-sm font-medium">Proposta aceita</p>
            </li>
            <li className="flex gap-3">
              {r.statusConta === 'PENDENTE_DOCUMENTOS' ? (
                <FileText className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#166534]" aria-hidden="true" />
              )}
              <div className="flex-1">
                {r.statusConta === 'PENDENTE_DOCUMENTOS' ? (
                  <>
                    <p className="text-sm font-medium text-amber-900">Envie seus documentos</p>
                    <p className="mt-0.5 text-[13px] text-[#4b5546]">Precisamos deles para seguir com o cadastro.</p>
                    <Link
                      href="/portal/documentos"
                      className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full bg-[#101510] px-4 text-[13px] font-semibold text-white"
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" /> Enviar documentos
                    </Link>
                  </>
                ) : (
                  <p className="text-sm font-medium">Documentos enviados</p>
                )}
              </div>
            </li>
            {(r.statusConta === 'PENDENTE_VALIDACAO' || r.statusConta === 'PENDENTE') && (
              <li className="flex gap-3">
                <Search className="h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Documentos em análise</p>
                  <p className="mt-0.5 text-[13px] text-[#4b5546]">Nossa equipe está verificando. Em breve você recebe uma resposta.</p>
                </div>
              </li>
            )}
            {r.statusConta === 'APROVADO' && (
              <li className="flex gap-3">
                <PenTool className="h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Assine seu contrato</p>
                  <p className="mt-0.5 text-[13px] text-[#4b5546]">
                    Use o link de assinatura enviado no seu WhatsApp ou e-mail. Não encontrou? Fale com a cooperativa.
                  </p>
                </div>
              </li>
            )}
          </ol>
        </section>
      )}

      {/* Balcão do Clube — só para cooperado-estabelecimento */}
      {perfil?.ehEstabelecimento && (
        <Link
          href="/estabelecimento"
          className="flex items-center gap-4 rounded-3xl bg-white p-5 ring-1 ring-black/5 transition hover:ring-[#101510]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100">
            <Store className="h-6 w-6 text-orange-800" aria-hidden="true" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Balcão do Clube</span>
            <span className="block text-[13px] text-[#4b5546]">Receba em CooperToken e valide resgates.</span>
          </span>
          <ArrowRight className="h-5 w-5 text-[#166534]" aria-hidden="true" />
        </Link>
      )}

      {/* Atalhos */}
      <section aria-label="Atalhos">
        <h2 className="mb-3 text-base font-semibold">Tudo do seu clube</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {atalhos.map(({ href, label, desc, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="group flex flex-col gap-3 rounded-3xl bg-white p-4 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-[#101510]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f5f7f2] transition group-hover:bg-[#d7ff65]">
                <Icon className="h-5 w-5 text-[#166534] group-hover:text-[#102012]" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-[#5b6656]">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Indicar */}
      {linkIndicacao && (
        <section className="rounded-3xl bg-[#d7ff65] p-5 text-[#102012] sm:p-6" aria-label="Indicar amigos">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-md">
              <h2 className="text-lg font-semibold">Indique e suba de nível</h2>
              <p className="mt-1 text-sm text-[#2c3d1f]">
                Cada amigo que entra pelo seu link conta para o seu ranking e recompensas.
              </p>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(textoConvite)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#101510] px-5 text-sm font-semibold text-white sm:flex-none"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Convidar
              </a>
              <button
                type="button"
                onClick={copiarLink}
                className="flex h-12 items-center justify-center gap-2 rounded-full border border-[#101510]/25 px-5 text-sm font-semibold"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                {copiado ? 'Copiado!' : 'Copiar link'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
