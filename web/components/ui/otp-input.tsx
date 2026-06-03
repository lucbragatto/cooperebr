'use client';

/**
 * Sprint Convite-Convênio Fatia 4 (03/06/2026) — Componente OtpInput.
 *
 * 6 boxes individuais com auto-advance entre dígitos. Suporta:
 *  - Digitação normal: avança foco automaticamente.
 *  - Backspace: volta foco (apaga + foca anterior se vazio).
 *  - Paste: distribui os 6 dígitos colados de uma vez (aceita "123456",
 *    "123 456", "123-456" etc).
 *  - inputMode="numeric" + pattern="\d" — abre teclado numérico no mobile.
 *
 * Mobile-first: 320px de largura mínima. Boxes 44x52 (toque confortável).
 *
 * Uso:
 *   <OtpInput value={codigo} onChange={setCodigo} onComplete={submeter} />
 */

import { useEffect, useRef } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (codigo: string) => void;
  disabled?: boolean;
  /** Dispara quando o usuário completa os 6 dígitos (auto-submit) */
  onComplete?: (codigo: string) => void;
  /** Visual de erro (boxes ficam vermelhos) */
  erro?: boolean;
}

const TAMANHO = 6;

export function OtpInput({ value, onChange, disabled, onComplete, erro }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digitos = value.padEnd(TAMANHO, ' ').slice(0, TAMANHO).split('');

  useEffect(() => {
    if (value.length === TAMANHO && /^\d{6}$/.test(value)) {
      onComplete?.(value);
    }
    // intencional: depende só de value pra não disparar 2× por re-render do parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(idx: number, novo: string) {
    // Filtra: aceita só dígito
    const dig = novo.replace(/\D/g, '').slice(-1); // último char digitado
    const atuais = digitos.map((d) => (d === ' ' ? '' : d));
    atuais[idx] = dig;
    const proximo = atuais.join('').replace(/\s+/g, '').slice(0, TAMANHO);
    onChange(proximo);
    if (dig && idx < TAMANHO - 1) {
      refs.current[idx + 1]?.focus();
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      const atuais = digitos.map((d) => (d === ' ' ? '' : d));
      if (atuais[idx]) {
        atuais[idx] = '';
        onChange(atuais.join('').replace(/\s+/g, ''));
        return;
      }
      // Caixa vazia → volta foco
      if (idx > 0) {
        refs.current[idx - 1]?.focus();
        const anteriores = atuais.slice();
        anteriores[idx - 1] = '';
        onChange(anteriores.join('').replace(/\s+/g, ''));
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      refs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < TAMANHO - 1) {
      refs.current[idx + 1]?.focus();
    }
  }

  function handlePaste(idx: number, e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const texto = e.clipboardData.getData('text');
    const apenasDigitos = texto.replace(/\D/g, '').slice(0, TAMANHO);
    if (!apenasDigitos) return;
    const atuais = digitos.map((d) => (d === ' ' ? '' : d));
    for (let i = 0; i < apenasDigitos.length && idx + i < TAMANHO; i++) {
      atuais[idx + i] = apenasDigitos[i];
    }
    onChange(atuais.join('').replace(/\s+/g, '').slice(0, TAMANHO));
    // Foca na próxima caixa vazia OU na última se completou tudo
    const proximoVazio = atuais.findIndex((d) => !d);
    const focoAlvo = proximoVazio === -1 ? TAMANHO - 1 : proximoVazio;
    refs.current[focoAlvo]?.focus();
  }

  const corBorda = erro
    ? 'border-red-400 focus:border-red-600'
    : 'border-gray-300 focus:border-amber-500';

  return (
    <div className="flex gap-1 sm:gap-2 justify-center" role="group" aria-label="Código de 6 dígitos">
      {Array.from({ length: TAMANHO }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="\d"
          maxLength={1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Dígito ${i + 1}`}
          value={digitos[i] === ' ' ? '' : digitos[i]}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          disabled={disabled}
          className={`
            w-[44px] h-[52px] sm:w-[48px] sm:h-[56px]
            text-center text-2xl font-bold font-mono
            border-2 ${corBorda} rounded-md
            outline-none transition-colors
            disabled:bg-gray-100 disabled:text-gray-400
            ${disabled ? 'cursor-not-allowed' : ''}
          `.trim().replace(/\s+/g, ' ')}
        />
      ))}
    </div>
  );
}
