'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sun } from 'lucide-react';

const PERCENTUAL_MAXIMO = 0.2; // "até 20% da fatura em CooperTokens"
const MIN = 100;
const MAX = 3000;

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/** Simulador do hero: valor da conta de luz → até quanto volta em CooperTokens. */
export default function SimuladorTokens({ entrarUrl }: { entrarUrl: string }) {
  const [conta, setConta] = useState(350);
  const mensal = Math.round(conta * PERCENTUAL_MAXIMO);
  const anual = mensal * 12;
  const progresso = ((conta - MIN) / (MAX - MIN)) * 100;

  return (
    <div className="w-full rounded-[28px] bg-white p-5 text-[#101510] shadow-2xl shadow-black/30 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6656]">Simulador</p>
          <h2 className="mt-1 text-xl font-semibold sm:text-2xl">Quanto volta para você?</h2>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#101510]">
          <Sun className="h-5 w-5 text-[#d7ff65]" aria-hidden="true" />
        </span>
      </div>

      <label htmlFor="valor-conta" className="mt-6 block text-sm font-semibold text-[#3d4639]">
        Sua conta de luz por mês
      </label>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <output htmlFor="valor-conta" className="text-3xl font-semibold tabular-nums sm:text-4xl">
          {brl(conta)}
        </output>
        <span className="text-xs text-[#5b6656]">arraste para ajustar</span>
      </div>
      <input
        id="valor-conta"
        type="range"
        min={MIN}
        max={MAX}
        step={10}
        value={conta}
        onChange={(e) => setConta(Number(e.target.value))}
        className="mt-3 h-11 w-full cursor-pointer appearance-none bg-transparent accent-[#166534] [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#101510] [&::-webkit-slider-thumb]:shadow"
        style={{
          background: `linear-gradient(to right, #101510 0%, #101510 ${progresso}%, #dfe5d8 ${progresso}%, #dfe5d8 100%) center / 100% 8px no-repeat`,
        }}
      />

      <div className="mt-4 rounded-2xl bg-[#101510] p-5 text-white">
        <p className="text-sm text-[#c4ccbf]">Volta em CooperTokens</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <p className="text-4xl font-semibold tabular-nums sm:text-5xl">
            até {brl(mensal)}
            <span className="ml-1 text-base font-medium text-[#a9b3a4]">/mês</span>
          </p>
          <span className="rounded-full bg-[#d7ff65] px-3 py-1 text-xs font-semibold text-[#102012]">
            até {brl(anual)} por ano
          </span>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-[#a9b3a4]">
          Para usar nos parceiros do clube ou abater cobranças.
        </p>
      </div>

      <Link
        href={entrarUrl}
        className="mt-4 flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#d7ff65] text-base font-semibold text-[#102012] transition hover:bg-[#c8f24f]"
      >
        Quero receber meus tokens
        <ArrowRight className="h-4 w-4" />
      </Link>
      <p className="mt-3 text-center text-xs leading-relaxed text-[#5b6656]">
        Estimativa com o teto de 20% da fatura. O valor real depende do seu plano e consumo.
      </p>
    </div>
  );
}
