import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PosicaoCooperadoService {
  private readonly logger = new Logger(PosicaoCooperadoService.name);

  constructor(private prisma: PrismaService) {}

  async getByCooperativa(cooperativaId: string, competencia?: Date) {
    const where: string[] = [`cooperativa_id = $1`];
    const params: any[] = [cooperativaId];

    if (competencia) {
      where.push(`competencia = $2`);
      params.push(competencia);
    }

    const sql = `SELECT * FROM vw_posicao_cooperado WHERE ${where.join(' AND ')} ORDER BY competencia DESC, nome_completo`;
    return this.prisma.$queryRawUnsafe(sql, ...params);
  }

  async getSuperavitarios(cooperativaId: string, competencia: Date) {
    return this.prisma.$queryRawUnsafe(
      `SELECT * FROM vw_posicao_cooperado
       WHERE cooperativa_id = $1 AND competencia = $2 AND status_geracao = 'SUPERAVITARIO'
       ORDER BY excedente_kwh DESC`,
      cooperativaId,
      competencia,
    );
  }

  async getDeficitarios(cooperativaId: string, competencia: Date) {
    return this.prisma.$queryRawUnsafe(
      `SELECT * FROM vw_posicao_cooperado
       WHERE cooperativa_id = $1 AND competencia = $2 AND status_geracao = 'DEFICITARIO'
       ORDER BY excedente_kwh ASC`,
      cooperativaId,
      competencia,
    );
  }

  async refreshView() {
    await this.prisma.$executeRawUnsafe(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY vw_posicao_cooperado',
    );
    this.logger.log('View vw_posicao_cooperado atualizada com sucesso');
  }
}
