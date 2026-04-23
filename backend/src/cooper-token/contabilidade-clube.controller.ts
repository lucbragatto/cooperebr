import { Controller, Get, Query, Req } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

/**
 * Sprint 9 — Relatório contábil preparatório do Clube.
 * Dados neutros pra contador revisar. Classificação definitiva no Sprint 11.
 */
@Controller('contabilidade-clube')
export class ContabilidadeClubeController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('relatorio')
  async relatorio(
    @Req() req: any,
    @Query('competencia') competencia?: string,
    @Query('cooperativaId') queryCoopId?: string,
  ) {
    const cooperativaId = req.user?.cooperativaId || queryCoopId;
    const comp = competencia || new Date().toISOString().slice(0, 7);

    const lancamentos = await this.prisma.lancamentoCaixa.findMany({
      where: {
        ...(cooperativaId ? { cooperativaId } : {}),
        competencia: comp,
        naturezaClube: { not: null },
      },
    });

    const emitido = lancamentos.filter(l => l.naturezaClube === 'PROVISIONAL_TOKEN_EMISSAO');
    const abatido = lancamentos.filter(l => l.naturezaClube === 'PROVISIONAL_TOKEN_ABATIMENTO');
    const expirado = lancamentos.filter(l => l.naturezaClube === 'PROVISIONAL_TOKEN_EXPIRACAO');
    const transferido = lancamentos.filter(l => l.naturezaClube === 'PROVISIONAL_TOKEN_TRANSFERENCIA');

    const somaValor = (arr: typeof lancamentos) =>
      Math.round(arr.reduce((s, l) => s + Number(l.valor), 0) * 100) / 100;

    const totalEmitido = somaValor(emitido);
    const totalAbatido = somaValor(abatido);
    const totalExpirado = somaValor(expirado);
    const totalTransferido = somaValor(transferido);

    return {
      competencia: comp,
      emitido: {
        valor_reais: totalEmitido,
        eventos: emitido.length,
      },
      abatido: {
        valor_reais: totalAbatido,
        eventos: abatido.length,
      },
      expirado: {
        valor_reais: totalExpirado,
        eventos: expirado.length,
      },
      transferido: {
        valor_reais: totalTransferido,
        eventos: transferido.length,
      },
      saldo_em_circulacao: {
        valor_reais: Math.round((totalEmitido - totalAbatido - totalExpirado) * 100) / 100,
        observacao: 'Passivo contábil em aberto — aguardando classificação',
      },
    };
  }
}
