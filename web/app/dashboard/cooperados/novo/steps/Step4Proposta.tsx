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
}

interface Step4Props {
  data: Step4Data;
  dadosPessoais: Step2Data;
  simulacaoData: Step3Data;
  onChange: (partial: Partial<Step4Data>) => void;
  tipoMembro: string;
}

export default function Step4Proposta({ data, dadosPessoais, simulacaoData, onChange, tipoMembro }: Step4Props) {
  const { propostaEnviada, canalEnvio, aprovacaoPresencial, propostaAceita } = data;
  const { simulacao } = simulacaoData;
  const [enviando, setEnviando] = useState(false);
  const [telefoneEnvio, setTelefoneEnvio] = useState(dadosPessoais.telefone);
  const [emailEnvio, setEmailEnvio] = useState(dadosPessoais.email);
  const [erro, setErro] = useState('');

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
    setEnviando(true); setErro('');
    try {
      await api.post('/propostas/enviar-email', {
        email: emailEnvio,
        nome: dadosPessoais.nomeCompleto,
        simulacao,
      });
      onChange({ propostaEnviada: true, canalEnvio: 'email' });
    } catch {
      // fallback: abrir mailto
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
    } finally {
      setEnviando(false);
    }
  }

  function gerarPDF() {
    window.print();
    onChange({ propostaEnviada: true, canalEnvio: 'pdf' });
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

      {/* Aprovação presencial */}
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Aprovação presencial?</span>
          <button
            onClick={() => onChange({ aprovacaoPresencial: !aprovacaoPresencial })}
            className={`relative w-11 h-6 rounded-full transition-colors ${aprovacaoPresencial ? 'bg-green-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${aprovacaoPresencial ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        {!aprovacaoPresencial && !propostaAceita && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-sm text-amber-800">Aguardando resposta do {tipoMembro.toLowerCase()}...</p>
            <Button onClick={() => onChange({ propostaAceita: true })} size="sm" variant="outline">
              Marcar como aceita
            </Button>
          </div>
        )}

        {(aprovacaoPresencial || propostaAceita) && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {aprovacaoPresencial ? 'Aprovação presencial registrada' : 'Proposta aceita pelo ' + tipoMembro.toLowerCase()}
          </div>
        )}
      </div>
    </div>
  );
}
