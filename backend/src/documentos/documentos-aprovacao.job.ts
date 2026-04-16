import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { ConfigTenantService } from '../config-tenant/config-tenant.service';
import { MotorPropostaService } from '../motor-proposta/motor-proposta.service';

@Injectable()
export class DocumentosAprovacaoJob {
  private readonly logger = new Logger(DocumentosAprovacaoJob.name);

  constructor(
    private prisma: PrismaService,
    private configTenant: ConfigTenantService,
    private motorProposta: MotorPropostaService,
  ) {}

  @Cron('0 */1 * * *')
  async processarAprovacaoAutomatica() {
    const cooperativas = await this.prisma.cooperativa.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
    });

    for (const coop of cooperativas) {
      try {
        await this.processarCooperativa(coop.id, coop.nome);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        this.logger.error(`Erro ao processar aprovação automática para ${coop.nome}: ${msg}`);
      }
    }
  }

  private async processarCooperativa(cooperativaId: string, nomeCooperativa: string) {
    const habilitado = await this.configTenant.get('aprovacao_documentos_automatica', cooperativaId);
    if (habilitado !== 'true') return;

    const prazoStr = await this.configTenant.get('prazo_aprovacao_auto_horas', cooperativaId);
    const prazoHoras = prazoStr ? Number(prazoStr) : 24;
    if (!Number.isFinite(prazoHoras) || prazoHoras <= 0) return;

    const cooperados = await this.prisma.cooperado.findMany({
      where: {
        cooperativaId,
        status: 'PENDENTE_DOCUMENTOS',
      },
      select: { id: true, nomeCompleto: true },
    });

    for (const cooperado of cooperados) {
      try {
        await this.avaliarCooperado(cooperado.id, cooperado.nomeCompleto, cooperativaId, prazoHoras, nomeCooperativa);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        this.logger.error(`Erro ao avaliar cooperado ${cooperado.id}: ${msg}`);
      }
    }
  }

  private async avaliarCooperado(
    cooperadoId: string,
    nomeCooperado: string,
    cooperativaId: string,
    prazoHoras: number,
    nomeCooperativa: string,
  ) {
    const docs = await this.prisma.documentoCooperado.findMany({
      where: { cooperadoId },
      orderBy: { createdAt: 'desc' },
    });

    if (docs.length === 0) return;

    // Verificar se algum doc foi reprovado — admin já interveio manualmente
    if (docs.some(d => d.status === 'REPROVADO')) return;

    // Prazo: contar a partir do ÚLTIMO documento enviado
    const ultimoDoc = docs[0];
    const agora = new Date();
    const diffHoras = (agora.getTime() - new Date(ultimoDoc.createdAt).getTime()) / (1000 * 60 * 60);
    if (diffHoras < prazoHoras) return;

    // Buscar proposta ACEITA do cooperado para chamar analisarDocumentos
    const proposta = await this.prisma.propostaCooperado.findFirst({
      where: { cooperadoId, status: 'ACEITA' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (!proposta) {
      this.logger.warn(`Cooperado ${cooperadoId} em PENDENTE_DOCUMENTOS sem proposta ACEITA — pulando`);
      return;
    }

    this.logger.log(
      `Aprovação automática: ${nomeCooperado} (${nomeCooperativa}) — ` +
      `${docs.length} doc(s), último há ${Math.round(diffHoras)}h, prazo ${prazoHoras}h`,
    );

    await this.motorProposta.analisarDocumentos(proposta.id, 'APROVADO', undefined, cooperativaId);
  }
}
