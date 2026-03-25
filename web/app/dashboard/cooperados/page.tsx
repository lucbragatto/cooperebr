'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import api from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Plus, MoreVertical, Eye, FileText, CreditCard, MessageCircle, Building2, Search } from 'lucide-react';
import Link from 'next/link';
import { useTipoParceiro } from '@/hooks/useTipoParceiro';
import { getUsuario } from '@/lib/auth';

interface ChecklistItem {
  label: string;
  ok: boolean;
}

interface CooperadoLista {
  id: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  telefone: string | null;
  status: string;
  tipoCooperado: string;
  cotaKwhMensal: number | string | null;
  usinaVinculada: string | null;
  statusContrato: string | null;
  kwhContrato: number | null;
  checklist: string;
  checklistPronto: boolean;
  checklistItems: ChecklistItem[];
  createdAt: string;
  nomeParceiro?: string;
  tipoParceiro?: string;
  cooperativaId?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ATIVO_RECEBENDO_CREDITOS: { label: 'Ativo', color: 'bg-green-100 text-green-800 border-green-200' },
  ATIVO: { label: 'Ativo', color: 'bg-green-100 text-green-800 border-green-200' },
  AGUARDANDO_CONCESSIONARIA: { label: 'Aguard. Concess.', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  PENDENTE_ATIVACAO: { label: 'Pend. Ativacao', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  LISTA_ESPERA: { label: 'Lista de Espera', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  PENDENTE: { label: 'Pendente', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  PENDENTE_DOCUMENTOS: { label: 'Pend. Docs', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  PENDENTE_VALIDACAO: { label: 'Pend. Validacao', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  PROPOSTA_ENVIADA: { label: 'Proposta Enviada', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  PROPOSTA_ACEITA: { label: 'Proposta Aceita', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  APROVADO: { label: 'Aprovado', color: 'bg-green-100 text-green-700 border-green-200' },
  SUSPENSO: { label: 'Suspenso', color: 'bg-red-100 text-red-800 border-red-200' },
  ENCERRADO: { label: 'Encerrado', color: 'bg-red-100 text-red-800 border-red-200' },
};

const CONTRATO_CONFIG: Record<string, { label: string; color: string }> = {
  PENDENTE_ATIVACAO: { label: 'Pend. Ativacao', color: 'bg-yellow-100 text-yellow-800' },
  ATIVO: { label: 'Ativo', color: 'bg-green-100 text-green-800' },
  LISTA_ESPERA: { label: 'Lista Espera', color: 'bg-purple-100 text-purple-800' },
  SUSPENSO: { label: 'Suspenso', color: 'bg-red-100 text-red-800' },
  ENCERRADO: { label: 'Encerrado', color: 'bg-gray-100 text-gray-600' },
};

function AcoesDropdown({ cooperado }: { cooperado: CooperadoLista }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    if (aberto) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [aberto]);

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="sm" onClick={() => setAberto(!aberto)}>
        <MoreVertical className="h-4 w-4" />
      </Button>
      {aberto && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <Link href={`/dashboard/cooperados/${cooperado.id}`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setAberto(false)}>
            <Eye className="h-4 w-4" /> Ver perfil
          </Link>
          <Link href={`/dashboard/cooperados/${cooperado.id}?aba=proposta`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setAberto(false)}>
            <FileText className="h-4 w-4" /> Nova proposta
          </Link>
          <Link href={`/dashboard/cooperados/${cooperado.id}?aba=cobranca`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setAberto(false)}>
            <CreditCard className="h-4 w-4" /> Gerar cobranca
          </Link>
          {cooperado.telefone && (
            <a
              href={`https://wa.me/55${cooperado.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Ola ${cooperado.nomeCompleto}, tudo bem? Entramos em contato referente a sua participacao na cooperativa de energia solar.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setAberto(false)}
            >
              <MessageCircle className="h-4 w-4" /> Enviar WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function ChecklistTooltip({ checklist, items }: { checklist: string; items?: ChecklistItem[] }) {
  const [mostrar, setMostrar] = useState(false);
  const pronto = items?.every(i => i.ok) ?? false;

  return (
    <div className="relative inline-block" onMouseEnter={() => setMostrar(true)} onMouseLeave={() => setMostrar(false)}>
      <div className="flex items-center gap-1.5 cursor-help">
        <span className={`text-sm font-mono ${pronto ? 'text-green-700 font-bold' : 'text-gray-500'}`}>
          {checklist}
        </span>
        {pronto && <CheckCircle className="h-4 w-4 text-green-600" />}
      </div>
      {mostrar && items && items.length > 0 && (
        <div className="absolute left-0 bottom-full mb-2 w-56 bg-gray-900 text-white text-xs rounded-md p-2 shadow-lg z-50">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 py-0.5">
              <span>{item.ok ? '\u2705' : '\u274C'}</span>
              <span className={item.ok ? 'text-green-300' : 'text-gray-300'}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabelaCooperados({ cooperados, carregando, tipoMembro }: { cooperados: CooperadoLista[]; carregando: boolean; tipoMembro: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>CPF/CNPJ</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Usina</TableHead>
          <TableHead>Contrato</TableHead>
          <TableHead>Checklist</TableHead>
          <TableHead className="text-right">Acoes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {carregando ? (
          Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 7 }).map((_, j) => (
                <TableCell key={j}>
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : cooperados.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-gray-400 py-8">
              Nenhum {tipoMembro.toLowerCase()} cadastrado
            </TableCell>
          </TableRow>
        ) : (
          cooperados.map((c) => {
            const st = STATUS_CONFIG[c.status];
            const ct = c.statusContrato ? CONTRATO_CONFIG[c.statusContrato] : null;
            return (
              <TableRow key={c.id} className={c.checklistPronto && c.status === 'PENDENTE' ? 'bg-green-50/50' : ''}>
                <TableCell>
                  <div>
                    <span className="font-medium text-gray-800">{c.nomeCompleto}</span>
                    {c.tipoCooperado === 'SEM_UC' && (
                      <span className="ml-2 text-xs text-gray-400">(sem UC)</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-gray-600">{c.cpf}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Badge className={st?.color ?? 'bg-gray-100 text-gray-600'}>
                      {st?.label ?? c.status}
                    </Badge>
                    {(c as any).reajusteRecente && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Reajustado</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {c.usinaVinculada ?? <span className="text-gray-400">&mdash;</span>}
                </TableCell>
                <TableCell>
                  {ct ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ct.color}`}>
                      {ct.label}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">&mdash;</span>
                  )}
                </TableCell>
                <TableCell>
                  <ChecklistTooltip checklist={c.checklist} items={c.checklistItems} />
                </TableCell>
                <TableCell className="text-right">
                  <AcoesDropdown cooperado={c} />
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

export default function CooperadosPage() {
  const [cooperados, setCooperados] = useState<CooperadoLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroParceiro, setFiltroParceiro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { tipoMembro, tipoMembroPlural } = useTipoParceiro();

  const usuario = getUsuario();
  const isSuperAdmin = usuario?.perfil === 'SUPER_ADMIN';

  const carregarCooperados = useCallback((search?: string) => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    api.get<CooperadoLista[]>(`/cooperados${params}`)
      .then((r) => setCooperados(r.data))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    carregarCooperados();
  }, [carregarCooperados]);

  function handleBuscaChange(valor: string) {
    setBusca(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCarregando(true);
      carregarCooperados(valor);
    }, 500);
  }

  // Agrupar por parceiro para SUPER_ADMIN
  const parceiros = isSuperAdmin
    ? Array.from(
        cooperados.reduce((map, c) => {
          const key = c.cooperativaId ?? 'sem-parceiro';
          if (!map.has(key)) {
            map.set(key, { nome: c.nomeParceiro ?? 'Sem parceiro', tipo: c.tipoParceiro ?? '', count: 0 });
          }
          map.get(key)!.count++;
          return map;
        }, new Map<string, { nome: string; tipo: string; count: number }>()),
      ).map(([id, info]) => ({ id, ...info }))
    : [];

  const cooperadosFiltrados = (filtroParceiro
    ? cooperados.filter(c => c.cooperativaId === filtroParceiro)
    : cooperados
  ).filter(c => {
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase();
    return (
      c.nomeCompleto.toLowerCase().includes(termo) ||
      c.cpf.toLowerCase().includes(termo) ||
      c.email.toLowerCase().includes(termo) ||
      (c.telefone && c.telefone.toLowerCase().includes(termo))
    );
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">{tipoMembroPlural}</h2>
        <Link href="/dashboard/cooperados/novo">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo {tipoMembro}
          </Button>
        </Link>
      </div>

      {/* SUPER_ADMIN: cards de resumo por parceiro */}
      {isSuperAdmin && !carregando && parceiros.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => setFiltroParceiro(null)}
            className={`text-left rounded-lg border p-3 transition-colors ${
              filtroParceiro === null ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Todos</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">{cooperados.length}</span>
            <span className="text-xs text-gray-500 ml-1">membros</span>
          </button>
          {parceiros.map((p) => (
            <button
              key={p.id}
              onClick={() => setFiltroParceiro(p.id)}
              className={`text-left rounded-lg border p-3 transition-colors ${
                filtroParceiro === p.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{p.nome}</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">{p.count}</span>
              <span className="text-xs text-gray-500 ml-1">membros</span>
              <Badge className="ml-2 text-[10px] bg-gray-100 text-gray-500">{p.tipo}</Badge>
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base font-medium text-gray-600">
              {carregando ? 'Carregando...' : `${cooperadosFiltrados.length} registros`}
              {filtroParceiro && parceiros.find(p => p.id === filtroParceiro) && (
                <span className="ml-2 text-sm text-blue-600">
                  — {parceiros.find(p => p.id === filtroParceiro)!.nome}
                </span>
              )}
            </CardTitle>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, CPF, email ou telefone..."
                value={busca}
                onChange={(e) => handleBuscaChange(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <TabelaCooperados cooperados={cooperadosFiltrados} carregando={carregando} tipoMembro={tipoMembro} />
        </CardContent>
      </Card>
    </div>
  );
}
