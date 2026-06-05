/**
 * Convergência convite custeio Fatia 1 (04/06/2026).
 *
 * Gate UNIFICADO pra validações do /cadastro público + slim auto-inscrever.
 * Substitui o `process.env.CADASTRO_VALIDACOES_ATIVAS === 'true'` legado que
 * estava espalhado em 2 lugares (cadastroWeb legado + cadastroWebV2). Bug do
 * legado: `CADASTRO_VALIDACOES_ATIVAS` era discriminador frágil — qualquer
 * mudança no `.env` afetava DEV inadvertidamente.
 *
 * NOVA REGRA (decisão Luciano 04/06):
 *  - `isAmbienteReal()` true  → STRICT: todos os campos obrigatórios validados.
 *  - `isAmbienteReal()` false → RELAXED (modo teste): aceita campos vazios,
 *    aplica placeholders previsíveis (email auto-placeholder, etc) pra
 *    permitir cadastros sintéticos sem fricção.
 *
 * Origem: regra inegociável dev/prod 18/05/2026 — NUNCA usar NODE_ENV pra
 * essa finalidade (PM2 força NODE_ENV='production' em dev local). Único
 * discriminador correto = flag explícita `AMBIENTE_REAL=true` no .env.
 *
 * NUMEROUC: única validação que NÃO segue o gate. Em REAL sempre obrigatório
 * (D-novo-CAD-UC-FALSA fix); em TESTE, permite vazio MAS sem fallback fake
 * (cria UC.tipoUc=SINTETICA explícita ou exige numeroUC do test data).
 */

import { BadRequestException } from '@nestjs/common';
import { isAmbienteReal } from './ambiente';

export interface CadastroPayloadMinimo {
  nome?: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  instalacao?: {
    numeroUC?: string;
    consumoMedioKwh?: number;
  };
}

export interface CadastroNormalizado {
  nome: string;
  cpfLimpo: string;
  email: string;
  telefoneLimpo: string;
  numeroUC: string | null;       // null sinaliza fluxo SEM_UC (SINTETICA)
  consumoMedioKwh: number;
  /** strict=true significa que isAmbienteReal()=true (PROD); strict=false = DEV/teste. */
  strict: boolean;
}

const CONSUMO_MIN_KWH = 20;
const CONSUMO_MAX_KWH = 50000;

/**
 * Valida e normaliza payload do /cadastro (web ou slim). Centraliza o gate
 * isAmbienteReal() pra todos os callers — DTO inline do cadastroWeb,
 * cadastroWebV2 privado, futuro slim convergido.
 *
 * `permiteSemUc` (default false): quando true (vindo do convite com
 * `ConviteConvenioMembro.permiteSemUc=true`), aceita `numeroUC` vazio e
 * retorna `numeroUC=null` — caller cria UC.tipoUc=SINTETICA. Quando false,
 * `numeroUC` é obrigatório em REAL (BadRequest se vazio).
 */
export function validarENormalizarCadastro(
  payload: CadastroPayloadMinimo,
  opts: { permiteSemUc?: boolean } = {},
): CadastroNormalizado {
  const strict = isAmbienteReal();
  const permiteSemUc = opts.permiteSemUc ?? false;

  const nome = (payload.nome ?? '').trim();
  const cpfLimpo = (payload.cpf ?? '').replace(/\D/g, '');
  const emailBruto = (payload.email ?? '').trim();
  const telefoneLimpo = (payload.telefone ?? '').replace(/\D/g, '');
  const numeroUCBruto = (payload.instalacao?.numeroUC ?? '').replace(/\D/g, '');
  const consumoBruto = Number(payload.instalacao?.consumoMedioKwh ?? 0);

  // ─── nome ─────────────────────────────────────────────────────────────
  if (strict && nome.length < 2) {
    throw new BadRequestException('Nome obrigatório (mínimo 2 caracteres).');
  }

  // ─── cpf ──────────────────────────────────────────────────────────────
  if (strict && cpfLimpo.length !== 11) {
    throw new BadRequestException('CPF obrigatório e deve ter 11 dígitos.');
  }
  if (!strict && cpfLimpo && cpfLimpo.length !== 11) {
    throw new BadRequestException('CPF deve ter 11 dígitos (em modo teste, pode ficar vazio).');
  }

  // ─── email ────────────────────────────────────────────────────────────
  // Em REAL: obrigatório + formato (verificação leve, regex básica). Em
  // TESTE: se vazio, auto-placeholder `${cpfOuTimestamp}@teste.invalid`.
  let email = emailBruto;
  if (strict) {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      throw new BadRequestException('Email obrigatório e deve ter formato válido.');
    }
  } else if (!email) {
    // Placeholder previsível (mesmo padrão da whitelist LGPD)
    const base = cpfLimpo || `t${Date.now()}`;
    email = `${base}@teste.invalid`;
  } else if (!/^\S+@\S+\.\S+$/.test(email)) {
    // Em teste, exige formato MÍNIMO se vier preenchido (decisão Luciano D)
    throw new BadRequestException('Email com formato inválido (ex: nome@dominio.com).');
  }

  // ─── telefone ─────────────────────────────────────────────────────────
  if (strict && telefoneLimpo.length < 10) {
    throw new BadRequestException(
      'Telefone obrigatório (10-11 dígitos com DDD).',
    );
  }
  if (!strict && telefoneLimpo && telefoneLimpo.length < 10) {
    throw new BadRequestException(
      'Telefone deve ter 10-11 dígitos com DDD (em modo teste, pode ficar vazio).',
    );
  }

  // ─── numeroUC (ID INTERNO SISGD — não é o "antigo EDP" do GD/SCEE) ────
  //
  // D-novo-OCR-UC-CANON (05/06/2026) — aceita formato EDP-ES atual (15 díg).
  //
  // CONTEXTO ARQUITETURAL — Sprint 11 Bloco 2 (auditoria 26/04, E2E Fase D 26/04):
  // - `Uc.numero` (este campo) = **ID INTERNO SISGD**. NÃO tem semântica EDP.
  //   Único requisito real: ser DETERMINÍSTICO + ÚNICO entre UCs no banco.
  // - `Uc.numeroUC` (NÃO MEXIDO AQUI) = **número ANTIGO EDP de 9 díg** usado em
  //   listas de compensação GD/SCEE. CAPTURADO MANUALMENTE pelo cooperado (carta
  //   da EDP). OCR de fatura atual EDP-ES NÃO retorna esse número (confirmado
  //   E2E real Luciano `docs/sessoes/2026-04-26-sprint11-fase-d-e2e.md`). Sprint
  //   11 Fase D-1 implementou guard de ativação que bloqueia status ATIVO sem
  //   esse campo — preserva integridade SCEE.
  // - `Uc.numeroConcessionariaOriginal` (preservado intacto pelo caller) =
  //   string display 15 díg `0.XXX.XXX.XXX.XXX-YY` da fatura nova EDP-ES.
  //
  // REGRA DE NORMALIZAÇÃO PRA NUMERO INTERNO:
  //   - 6-11 díg → mantém via `.slice(-10).padStart(10, '0')` (compat com
  //     fluxo legado: formato canônico 9-10 díg digitado pelo admin/cooperado).
  //   - 15 díg (formato EDP-ES atual) → `slice(3, 13)` extrai os 10 díg centrais
  //     (descarta 3 zeros prefix + 2 DV). Determinístico, único entre UCs (a
  //     parte central é a "informativa" do formato EDP-ES), preserva visualidade
  //     pra admin debugar.
  //   - Demais comprimentos → 400 com mensagem clara.
  //
  // POR QUE ESSA REGRA NÃO TOCA O ANTIGO/GD:
  //   O slice 3-13 do formato 15 díg EDP-ES é PROVADAMENTE DIFERENTE do número
  //   antigo da EDP (confirmado contra UC real Luciano:
  //     numeroConcessionariaOriginal: 0.001.421.380.054-70
  //     numero (canônico SISGD):       0400702214 ← ID interno banco
  //     numeroUC (antigo GD):          160085263 ← MANUAL, não derivado
  //   `slice(3, 13)` de `000142138005470` = `1421380054` ≠ ambos os números reais.
  //   Confirma: é só ID interno arbitrário. Não pretende ser canônico EDP.
  //
  // Fecha D-novo-CAD-UC-FALSA: NÃO há mais fallback 'UC-'+Date.now(). Quando
  // numeroUC é vazio E permiteSemUc=false, é erro real (em STRICT e TESTE).
  // Quando permiteSemUc=true e vazio, retorna null → caller usa SINTETICA.
  let numeroUC: string | null = null;
  if (numeroUCBruto) {
    if (numeroUCBruto.length === 15) {
      // Formato EDP-ES atual: zeros prefix + 10 díg centrais + 2 DV.
      // Pega os 10 centrais como ID interno determinístico.
      numeroUC = numeroUCBruto.slice(3, 13);
    } else if (numeroUCBruto.length >= 6 && numeroUCBruto.length <= 11) {
      // Formato canônico legado (cadastro admin / OCR antigo / digitação manual).
      numeroUC = numeroUCBruto.slice(-10).padStart(10, '0');
    } else {
      throw new BadRequestException(
        'Número da UC deve ter 6-11 dígitos (formato canônico) ou 15 dígitos (formato EDP-ES atual da fatura).',
      );
    }
  } else if (!permiteSemUc) {
    throw new BadRequestException(
      strict
        ? 'Número da UC (instalação) é obrigatório. Consulte sua fatura de luz.'
        : 'Número da UC vazio sem flag permiteSemUc — proibido (era o bug do UC-fake).',
    );
  }
  // numeroUC=null aqui significa SINTETICA — caller cria com tipoUc=SINTETICA.

  // ─── consumoMedioKwh ──────────────────────────────────────────────────
  // Fecha D-novo-CAD-CONSUMO-ZERO. Em REAL: range 20-50000. Em TESTE: aceita
  // 0 mas avisa via warn (caller pode logar).
  let consumoMedioKwh = consumoBruto;
  if (strict) {
    if (!Number.isFinite(consumoMedioKwh) || consumoMedioKwh < CONSUMO_MIN_KWH || consumoMedioKwh > CONSUMO_MAX_KWH) {
      throw new BadRequestException(
        `Consumo médio mensal deve ser entre ${CONSUMO_MIN_KWH} e ${CONSUMO_MAX_KWH} kWh.`,
      );
    }
  } else {
    // teste: aceita qualquer número finito >= 0, com saneamento defensivo
    if (!Number.isFinite(consumoMedioKwh) || consumoMedioKwh < 0) {
      consumoMedioKwh = 0;
    }
  }

  return {
    nome: nome || (strict ? '' : 'teste'),
    cpfLimpo,
    email,
    telefoneLimpo,
    numeroUC,
    consumoMedioKwh,
    strict,
  };
}
