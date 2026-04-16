'use client';

import { useEffect, useState } from 'react';
import { getUsuario } from '@/lib/auth';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Percent,
  Calendar,
  Zap,
  AlertTriangle,
  FileWarning,
  DollarSign,
  MessageCircle,
  CheckCircle,
  Clock,
  FileText,
  Search,
  PenTool,
} from 'lucide-react';
import Link from 'next/link';

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
}

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  PENDENTE_VALIDACAO: 'Pendente validação',
  PENDENTE_DOCUMENTOS: 'Aguardando documentos',
  APROVADO: 'Aprovado',
  ATIVO: 'Ativo',
  ATIVO_RECEBENDO_CREDITOS: 'Recebendo créditos',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
};

const STATUS_COLOR: Record<string, string> = {
  PENDENTE: 'text-yellow-600',
  PENDENTE_VALIDACAO: 'text-yellow-600',
  PENDENTE_DOCUMENTOS: 'text-amber-600',
  APROVADO: 'text-blue-600',
  ATIVO: 'text-green-700',
  ATIVO_RECEBENDO_CREDITOS: 'text-green-700',
  SUSPENSO: 'text-red-600',
  ENCERRADO: 'text-gray-500',
};

export default function PortalInicioPage() {
  const [perfil, setPerfil] = useState<MeuPerfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [linkIndicacao, setLinkIndicacao] = useState('');
  const usuario = getUsuario();

  useEffect(() => {
    api
      .get('/cooperados/meu-perfil')
      .then((res) => setPerfil(res.data))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (perfil?.codigoIndicacao) {
      setLinkIndicacao(`${window.location.origin}/cadastro?ref=${perfil.codigoIndicacao}`);
    }
  }, [perfil]);

  if (carregando) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  const r = perfil?.resumo;
  const nome = perfil?.nomeCompleto?.split(' ')[0] ?? usuario?.nome?.split(' ')[0] ?? 'Membro';
  const alertas = (r?.documentosPendentes ?? 0) + (r?.faturasPendentes ?? 0);
  const textoWhatsapp = encodeURIComponent(
    `Olá! Quer economizar na conta de luz? Participe da nossa cooperativa de energia solar! Acesse: ${linkIndicacao}`
  );
  const linkWhatsapp = `https://wa.me/?text=${textoWhatsapp}`;

  return (
    <div className="space-y-4">
      {/* Boas-vindas */}
      <Card>
        <CardContent className="pt-4">
          <h2 className="text-xl font-bold text-gray-800">Olá, {nome}!</h2>
          <p className="text-sm text-gray-500 mt-1">Bem-vindo ao seu painel.</p>
        </CardContent>
      </Card>

      {/* Banner de status do cadastro — aparece apenas quando status !== ATIVO */}
      {r?.statusConta && r.statusConta !== 'ATIVO' && r.statusConta !== 'ATIVO_RECEBENDO_CREDITOS' && (
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardContent className="pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">Etapas do seu cadastro</h3>
            <div className="space-y-2">
              {/* Etapa 1: Proposta aceita */}
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                <p className="text-sm text-green-700 font-medium">Proposta aceita</p>
              </div>

              {/* Etapa 2: Documentos */}
              <div className="flex items-start gap-3">
                {r.statusConta === 'PENDENTE_DOCUMENTOS' ? (
                  <FileText className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                )}
                <div className="flex-1">
                  {r.statusConta === 'PENDENTE_DOCUMENTOS' ? (
                    <>
                      <p className="text-sm text-amber-700 font-medium">Envie seus documentos</p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        Precisamos dos seus documentos para prosseguir com o cadastro.
                      </p>
                      <Link
                        href="/portal/documentos"
                        className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-md transition-colors"
                      >
                        <FileText className="h-3 w-3" /> Enviar documentos
                      </Link>
                    </>
                  ) : (
                    <p className="text-sm text-green-700 font-medium">Documentos enviados</p>
                  )}
                </div>
              </div>

              {/* Etapa 3: Análise — exibida como ativa apenas se status indica análise em andamento */}
              {(r.statusConta === 'PENDENTE_VALIDACAO' || r.statusConta === 'PENDENTE') && (
                <div className="flex items-start gap-3">
                  <Search className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-blue-700 font-medium">Documentos em análise</p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Nossa equipe está verificando — em breve você receberá uma resposta.
                    </p>
                  </div>
                </div>
              )}

              {/* Etapa 4: Assinatura */}
              {r.statusConta === 'APROVADO' && (
                <div className="flex items-start gap-3">
                  <PenTool className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-blue-700 font-medium">Assine seu contrato</p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Seus documentos foram aprovados! Acesse o link de assinatura enviado no seu
                      WhatsApp ou email para finalizar o cadastro. Não encontrou? Entre em contato com a cooperativa.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            Resumo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <Percent className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Desconto</p>
                <p className="text-lg font-bold text-gray-800">
                  {r?.descontoAtual != null ? `${r.descontoAtual}%` : '—'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Próx. vencimento</p>
                <p className="text-sm font-semibold text-gray-800">
                  {r?.proximoVencimento
                    ? new Date(r.proximoVencimento).toLocaleDateString('pt-BR')
                    : '—'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 col-span-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className={`text-sm font-semibold ${STATUS_COLOR[r?.statusConta ?? ''] ?? 'text-gray-600'}`}>
                  {STATUS_LABEL[r?.statusConta ?? ''] ?? r?.statusConta ?? '—'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Créditos */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500">kWh alocados este mês</p>
              <p className="text-2xl font-bold text-gray-800">
                {r?.kwhAlocados ? r.kwhAlocados.toLocaleString('pt-BR') : '0'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas */}
      {alertas > 0 && (
        <Card className="ring-red-200 bg-red-50/50">
          <CardContent className="pt-4">
            <div className="space-y-2">
              {(r?.documentosPendentes ?? 0) > 0 && (
                <div className="flex items-center gap-2">
                  <FileWarning className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-700">
                    {r!.documentosPendentes} documento(s) pendente(s)
                  </span>
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {r!.documentosPendentes}
                  </span>
                </div>
              )}
              {(r?.faturasPendentes ?? 0) > 0 && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-700">
                    {r!.faturasPendentes} fatura(s) em aberto
                  </span>
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {r!.faturasPendentes}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links rápidos */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { href: '/portal/convenio', label: 'Meu Convênio', icon: '🤝' },
          { href: '/portal/clube', label: 'Clube de Vantagens', icon: '🏆' },
          { href: '/portal/tokens', label: 'Pagar com Tokens', icon: '🪙' },
          { href: '/portal/creditos', label: 'Converter Créditos', icon: '💱' },
          { href: '/portal/conta', label: 'Minha Conta', icon: '👤' },
          { href: '/portal/ranking', label: 'Ranking', icon: '📊' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-green-300 hover:bg-green-50 transition-colors"
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Ação rápida: WhatsApp */}
      <a
        href={linkWhatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full h-12 text-base font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
      >
        <MessageCircle className="w-5 h-5" />
        Enviar convite pelo WhatsApp
      </a>
    </div>
  );
}
