import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface ValidacaoResultado {
  valido: boolean;
  motivo?: string;
  warn?: boolean;
}

/**
 * Sprint 8 / Bloco E — validadores aplicados em cada realocação sugerida pela engine.
 *
 * Bloqueia movimentação que viole:
 *  - Concentração ≤ 25% por cooperado×usina (D-30A — caso Exfishes preventivo)
 *  - Distribuidora ANEEL compatível (UC × Usina)
 *  - Estabilidade mínima 3 meses (contratos novos não são realocados)
 *  - Mudança de classe GD (D-30B — Caminho B com classeGdAplicada manual)
 */
@Injectable()
export class AlocacaoValidadorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Valida que a alocação proposta de `kwhProposto` na `usinaId` não excede 25% da capacidade da usina.
   * Considera todos os contratos do mesmo cooperado na usina (somatório).
   */
  async validarConcentracao25(args: {
    cooperadoId: string;
    usinaId: string;
    kwhProposto: number;
    contratoIdAtual?: string; // contrato sendo realocado (excluir do somatório)
  }): Promise<ValidacaoResultado> {
    const { cooperadoId, usinaId, kwhProposto, contratoIdAtual } = args;
    const usina = await this.prisma.usina.findUnique({
      where: { id: usinaId },
      select: { capacidadeKwh: true },
    });
    if (!usina?.capacidadeKwh) {
      return { valido: false, motivo: 'Usina sem capacidadeKwh definida' };
    }
    const capacidade = Number(usina.capacidadeKwh);

    const outrosContratos = await this.prisma.contrato.findMany({
      where: {
        cooperadoId,
        usinaId,
        status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
        ...(contratoIdAtual ? { id: { not: contratoIdAtual } } : {}),
      },
      select: { kwhContrato: true },
    });
    const somaCooperado = outrosContratos.reduce(
      (acc, c) => acc + Number(c.kwhContrato ?? 0),
      0,
    );
    const total = somaCooperado + kwhProposto;
    const pct = capacidade > 0 ? (total / capacidade) * 100 : 100;
    if (pct > 25) {
      return {
        valido: false,
        motivo: `Concentração do cooperado nesta usina chegaria a ${pct.toFixed(2)}% (limite 25%)`,
      };
    }
    return { valido: true };
  }

  /**
   * Valida compatibilidade ANEEL (mesma distribuidora) entre UC e usina.
   * Permissivo se qualquer distribuidora estiver null (legado).
   */
  async validarDistribuidora(ucId: string, usinaId: string): Promise<ValidacaoResultado> {
    const [uc, usina] = await Promise.all([
      this.prisma.uc.findUnique({ where: { id: ucId }, select: { distribuidora: true } }),
      this.prisma.usina.findUnique({ where: { id: usinaId }, select: { distribuidora: true } }),
    ]);
    if (!uc || !usina) {
      return { valido: false, motivo: 'UC ou usina não encontrada' };
    }
    if (!uc.distribuidora || !usina.distribuidora) {
      return { valido: true }; // permissivo legado
    }
    if (uc.distribuidora !== usina.distribuidora) {
      return {
        valido: false,
        motivo: `Distribuidoras diferentes (UC=${uc.distribuidora} × Usina=${usina.distribuidora})`,
      };
    }
    return { valido: true };
  }

  /**
   * Caminho B — Sprint 8 + Sprint 5a Neutro.
   *
   * Se `contrato.classeGdAplicada` está definido E `usina.classeGdAnotada` está definido,
   * eles devem casar (bloqueio). Se algum está null, retorna warn (não bloqueia) — admin
   * preenche pós-Sprint 5a quando dossiê fechar.
   */
  async validarClasseGd(args: {
    contratoId: string;
    usinaSugeridaId: string;
  }): Promise<ValidacaoResultado> {
    const { contratoId, usinaSugeridaId } = args;
    const [contrato, usina] = await Promise.all([
      this.prisma.contrato.findUnique({
        where: { id: contratoId },
        select: { classeGdAplicada: true },
      }),
      this.prisma.usina.findUnique({
        where: { id: usinaSugeridaId },
        select: { classeGdAnotada: true },
      }),
    ]);
    if (!contrato || !usina) {
      return { valido: false, motivo: 'Contrato ou usina não encontrado' };
    }
    if (!contrato.classeGdAplicada || !usina.classeGdAnotada) {
      return {
        valido: true,
        warn: true,
        motivo: 'classeGdAplicada/classeGdAnotada não definida — validação adiada pra Sprint 5a',
      };
    }
    if (contrato.classeGdAplicada !== usina.classeGdAnotada) {
      return {
        valido: false,
        motivo: `Mudança de classe GD bloqueada (contrato=${contrato.classeGdAplicada} × usina=${usina.classeGdAnotada}). Caso Exfishes preventivo.`,
      };
    }
    return { valido: true };
  }

  /**
   * Estabilidade mínima: contratos com `dataInicio < 3 meses atrás` não são realocados.
   * Protege cooperados recém-aderidos de mudanças sucessivas que confundiriam a operação.
   */
  async validarEstabilidade(contratoId: string): Promise<ValidacaoResultado> {
    const contrato = await this.prisma.contrato.findUnique({
      where: { id: contratoId },
      select: { dataInicio: true },
    });
    if (!contrato) {
      return { valido: false, motivo: 'Contrato não encontrado' };
    }
    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
    if (contrato.dataInicio > tresMesesAtras) {
      const dias = Math.ceil((Date.now() - contrato.dataInicio.getTime()) / 86_400_000);
      return {
        valido: false,
        motivo: `Contrato com apenas ${dias} dias de vigência (mínimo 90 pra realocar)`,
      };
    }
    return { valido: true };
  }
}
