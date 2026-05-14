'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, FileText, Loader2, Mail, MessageCircle, Printer } from 'lucide-react';
import type { Step3Data } from './Step3Simulacao';
import type { Step2Data } from './Step2Dados';

export interface Step4Data {
  propostaEnviada: boolean;
  canalEnvio: 'whatsapp' | 'email' | 'pdf' | null;
  aprovacaoPresencial: boolean;
  propostaAceita: boolean;
  propostaId: string;
}

interface Step4Props {
  data: Step4Data;
  dadosPessoais: Step2Data;
  simulacaoData: Step3Data;
  onChange: (partial: Partial<Step4Data>) => void;
  tipoMembro: string;
}

export default function Step4Proposta({ data, dadosPessoais, simulacaoData, onChange, tipoMembro }: Step4Props) {
  const { propostaEnviada, canalEnvio, propostaAceita, propostaId } = data;
  const { simulacao, resultadoMotor, planoSelecionadoId } = simulacaoData;
  const [enviando, setEnviando] = useState(false);
  const [aceitando, setAceitando] = useState(false);
  const [telefoneEnvio, setTelefoneEnvio] = useState(dadosPessoais.telefone);
  const [emailEnvio, setEmailEnvio] = useState(dadosPessoais.email);
  const [erro, setErro] = useState('');
  const [erroAceite, setErroAceite] = useState('');
  const [resultadoAceite, setResultadoAceite] = useState<{
    contrato: { numero: string } | null;
    emListaEspera: boolean;
    aviso?: string;
  } | null>(null);

  const cls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  async function enviarWhatsApp() {
    setEnviando(true); setErro('');
    try {
      const tel = telefoneEnvio.replace(/\D/g, '');
      const msg = encodeURIComponent(
        `Olá ${dadosPessoais.nomeCompleto}! Segue sua proposta CoopereBR:\n\n` +
        `Fatura atual: ${simulacao?.faturaAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês\n` +
        `Com CoopereBR: ${simulacao?.faturaCooperebr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês\n` +
        `Economia: ${simulacao?.economiaMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês (${simulacao?.desconto}% desconto)\n` +
        `Economia em 5 anos: ${simulacao?.economia5anos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n\n` +
        `Equivale a ${simulacao?.mesesGratis} meses de energia grátis!`
      );
      window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank');
      onChange({ propostaEnviada: true, canalEnvio: 'whatsapp' });
    } catch {
      setErro('Erro ao enviar proposta.');
    } finally {
      setEnviando(false);
    }
  }

  async function enviarEmail() {
    // D-45 fix sub-fix 2: endpoint backend /propostas/enviar-email não existe
    // (resíduo de refactor antigo, gerava 404 no console). Por enquanto usa
    // mailto: direto. Endpoint dedicado pode ser criado em sessão futura
    // quando definir provider SMTP + template + tracking de envio.
    setEnviando(true); setErro('');
    try {
      const subject = encodeURIComponent('Proposta CoopereBR');
      const body = encodeURIComponent(
        `Olá ${dadosPessoais.nomeCompleto},\n\n` +
        `Segue sua proposta de economia:\n` +
        `Fatura atual: R$ ${simulacao?.faturaAtual.toFixed(2)}/mês\n` +
        `Com CoopereBR: R$ ${simulacao?.faturaCooperebr.toFixed(2)}/mês\n` +
        `Economia: R$ ${simulacao?.economiaMensal.toFixed(2)}/mês (${simulacao?.desconto}% desconto)\n`
      );
      window.open(`mailto:${emailEnvio}?subject=${subject}&body=${body}`, '_blank');
      onChange({ propostaEnviada: true, canalEnvio: 'email' });
    } catch {
      setErro('Erro ao abrir cliente de email.');
    } finally {
      setEnviando(false);
    }
  }

  function gerarPDF() {
    window.print();
    onChange({ propostaEnviada: true, canalEnvio: 'pdf' });
  }

  async function aceitarProposta() {
    if (!resultadoMotor || !dadosPessoais.cooperadoId) return;
    setAceitando(true);
    setErroAceite('');
    try {
      const { data: resp } = await api.post<{
        proposta: { id: string };
        contrato: { id: string; numero: string } | null;
        emListaEspera: boolean;
        aviso?: string;
      }>('/motor-proposta/aceitar', {
        cooperadoId: dadosPessoais.cooperadoId,
        resultado: resultadoMotor,
        mesReferencia: resultadoMotor.mesReferencia,
        planoId: planoSelecionadoId || undefined,
      });
      setResultadoAceite({
        contrato: resp.contrato ? { numero: resp.contrato.numero } : null,
        emListaEspera: resp.emListaEspera,
        aviso: resp.aviso,
      });
      onChange({ propostaId: resp.proposta.id, propostaAceita: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao aceitar proposta.';
      setErroAceite(message);
    } finally {
      setAceitando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-1">Envio da proposta</h2>
        <p className="text-sm text-gray-500">Envie a proposta para o {tipoMembro.toLowerCase()} ou registre aceitação presencial.</p>
      </div>

      {/* Preview da proposta */}
      {simulacao && (
        <div className="border border-gray-200 rounded-lg p-5 space-y-4 print:border-0">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-5 w-5 text-green-700" />
            <h3 className="text-sm font-semibold text-gray-800">Proposta para {dadosPessoais.nomeCompleto}</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Fatura atual</p>
              <p className="font-bold text-gray-900">{simulacao.faturaAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês</p>
            </div>
            <div className="bg-green-50 rounded-lg px-3 py-2">
              <p className="text-xs text-green-700">Com CoopereBR</p>
              <p className="font-bold text-green-800">{simulacao.faturaCooperebr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês</p>
            </div>
            <div className="bg-green-50 rounded-lg px-3 py-2">
              <p className="text-xs text-green-700">Economia mensal</p>
              <p className="font-bold text-green-700">{simulacao.economiaMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
            <div className="bg-green-50 rounded-lg px-3 py-2">
              <p className="text-xs text-green-700">Economia em 5 anos</p>
              <p className="font-bold text-green-700">{simulacao.economia5anos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
          </div>
          <p className="text-center text-sm text-green-800">
            Equivale a <b>{simulacao.mesesGratis}</b> meses de energia grátis
          </p>
        </div>
      )}

      {/* Opções de envio */}
      <div className="space-y-3 print:hidden">
        {/* WhatsApp */}
        <div className="border border-gray-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-gray-800">WhatsApp</span>
          </div>
          <div className="flex gap-2">
            <input className={`${cls} flex-1`} value={telefoneEnvio} onChange={e => setTelefoneEnvio(e.target.value)} placeholder="(00) 00000-0000" />
            <Button onClick={enviarWhatsApp} disabled={enviando} size="sm">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
            </Button>
          </div>
        </div>

        {/* Email */}
        <div className="border border-gray-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-800">Email</span>
          </div>
          <div className="flex gap-2">
            <input className={`${cls} flex-1`} type="email" value={emailEnvio} onChange={e => setEmailEnvio(e.target.value)} placeholder="email@exemplo.com" />
            <Button onClick={enviarEmail} disabled={enviando} size="sm">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
            </Button>
          </div>
        </div>

        {/* PDF */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-800">PDF</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={gerarPDF} variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-1" /> Imprimir / PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Status de envio */}
      {propostaEnviada && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Proposta enviada via {canalEnvio === 'whatsapp' ? 'WhatsApp' : canalEnvio === 'email' ? 'Email' : 'PDF'} ✅
        </div>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {/* Aceitar proposta — chama o motor de proposta real */}
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Aceitar proposta</h3>

        {!propostaId && !resultadoAceite && (
          <>
            <p className="text-xs text-gray-500">
              Ao aceitar, o sistema cria a proposta + contrato no banco e o cooperado passa para PENDENTE_DOCUMENTOS.
            </p>
            <Button
              onClick={aceitarProposta}
              disabled={aceitando || !resultadoMotor}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {aceitando ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aceitando proposta...</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-2" /> Aceitar proposta</>
              )}
            </Button>
          </>
        )}

        {/* Erro no aceite */}
        {erroAceite && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
            <p className="text-sm text-red-700">{erroAceite}</p>
            <Button variant="outline" size="sm" onClick={aceitarProposta}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Resultado do aceite */}
        {resultadoAceite && (
          <>
            {resultadoAceite.contrato && !resultadoAceite.emListaEspera && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-semibold">Proposta aceita — Contrato #{resultadoAceite.contrato.numero} criado</p>
                  <p className="text-xs text-green-700">Cooperado agora está em PENDENTE_DOCUMENTOS.</p>
                </div>
              </div>
            )}

            {resultadoAceite.emListaEspera && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-amber-600" />
                  Proposta aceita — Cooperado em lista de espera
                </p>
                <p className="text-xs">
                  Não há usina com capacidade disponível no momento. O contrato foi criado em LISTA_ESPERA
                  e o cooperado será alocado quando abrir vaga.
                </p>
              </div>
            )}

            {resultadoAceite.aviso && !resultadoAceite.contrato && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-800 space-y-1">
                <p className="font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-orange-600" />
                  Proposta aceita — sem contrato automático
                </p>
                <p className="text-xs">{resultadoAceite.aviso}</p>
                <p className="text-xs">Cadastre uma UC para o cooperado e crie o contrato manualmente.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
