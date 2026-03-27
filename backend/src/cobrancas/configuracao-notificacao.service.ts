import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export enum TipoNotificacaoCobranca {
  AVENCER_MAIS5 = 'AVENCER_MAIS5',
  AVENCER_2A4 = 'AVENCER_2A4',
  AVENCER_AMANHA = 'AVENCER_AMANHA',
  VENCE_HOJE = 'VENCE_HOJE',
  VENCIDA_CARENCIA = 'VENCIDA_CARENCIA',
  VENCIDA_MULTA = 'VENCIDA_MULTA',
}

const TEXTOS_PADRAO: Record<TipoNotificacaoCobranca, string> = {
  [TipoNotificacaoCobranca.AVENCER_MAIS5]:
    'Sua fatura vence em *{{dias}} dias* — R$ {{valor}}',
  [TipoNotificacaoCobranca.AVENCER_2A4]:
    '⏰ Sua fatura vence em *{{dias}} dias*. Não deixe para a última hora! R$ {{valor}}',
  [TipoNotificacaoCobranca.AVENCER_AMANHA]:
    '⚠️ Sua fatura vence *amanhã* — R$ {{valor}}',
  [TipoNotificacaoCobranca.VENCE_HOJE]:
    '🔔 Sua fatura vence *hoje*! Evite multas. R$ {{valor}}',
  [TipoNotificacaoCobranca.VENCIDA_CARENCIA]:
    'Sua fatura venceu há *{{dias}} dias* — ainda no prazo de carência, sem multa. R$ {{valor}}',
  [TipoNotificacaoCobranca.VENCIDA_MULTA]:
    '⚠️ Fatura em atraso ({{dias}} dias) — valor atualizado: *R$ {{valorAtualizado}}*\nMulta 2%: R$ {{multa}} | Juros: R$ {{juros}}',
};

const DIAS_REFERENCIA_PADRAO: Record<TipoNotificacaoCobranca, number> = {
  [TipoNotificacaoCobranca.AVENCER_MAIS5]: 5,
  [TipoNotificacaoCobranca.AVENCER_2A4]: 2,
  [TipoNotificacaoCobranca.AVENCER_AMANHA]: 1,
  [TipoNotificacaoCobranca.VENCE_HOJE]: 0,
  [TipoNotificacaoCobranca.VENCIDA_CARENCIA]: -1,
  [TipoNotificacaoCobranca.VENCIDA_MULTA]: -4,
};

@Injectable()
export class ConfiguracaoNotificacaoService {
  constructor(private prisma: PrismaService) {}

  async getTexto(
    cooperativaId: string | null,
    tipo: TipoNotificacaoCobranca,
    variaveis: Record<string, string | number>,
  ): Promise<string> {
    let config: { texto: string; ativo: boolean } | null = null;

    // 1. Config específica da cooperativa
    if (cooperativaId) {
      config = await this.prisma.configuracaoNotificacaoCobranca.findUnique({
        where: { cooperativaId_tipo: { cooperativaId, tipo } },
        select: { texto: true, ativo: true },
      });
    }

    // 2. Config global (cooperativaId null)
    if (!config) {
      config = await this.prisma.configuracaoNotificacaoCobranca.findFirst({
        where: { cooperativaId: null, tipo },
        select: { texto: true, ativo: true },
      });
    }

    // 3. Fallback hardcoded
    const template = config?.texto ?? TEXTOS_PADRAO[tipo];

    // Substituir variáveis {{chave}}
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      variaveis[key] !== undefined ? String(variaveis[key]) : `{{${key}}}`,
    );
  }

  async listar(cooperativaId?: string) {
    const configs = await this.prisma.configuracaoNotificacaoCobranca.findMany({
      where: cooperativaId
        ? { OR: [{ cooperativaId }, { cooperativaId: null }] }
        : { cooperativaId: null },
      orderBy: { tipo: 'asc' },
    });

    // Merge com defaults — para cada tipo, retornar config da cooperativa ou global ou padrão
    return Object.values(TipoNotificacaoCobranca).map((tipo) => {
      const especifica = configs.find(
        (c) => c.tipo === tipo && c.cooperativaId === cooperativaId,
      );
      const global = configs.find(
        (c) => c.tipo === tipo && c.cooperativaId === null,
      );
      const config = especifica ?? global;

      return {
        tipo,
        ativo: config?.ativo ?? true,
        diasReferencia: config?.diasReferencia ?? DIAS_REFERENCIA_PADRAO[tipo],
        texto: config?.texto ?? TEXTOS_PADRAO[tipo],
        cooperativaId: config?.cooperativaId ?? null,
        id: config?.id ?? null,
        isDefault: !config,
      };
    });
  }

  async upsert(
    cooperativaId: string | null,
    tipo: TipoNotificacaoCobranca,
    dados: { ativo?: boolean; diasReferencia?: number; texto?: string },
  ) {
    const where = cooperativaId
      ? { cooperativaId_tipo: { cooperativaId, tipo } }
      : { cooperativaId_tipo: { cooperativaId: '', tipo } };

    // For global (null cooperativaId), use findFirst + create/update
    if (!cooperativaId) {
      const existing = await this.prisma.configuracaoNotificacaoCobranca.findFirst({
        where: { cooperativaId: null, tipo },
      });
      if (existing) {
        return this.prisma.configuracaoNotificacaoCobranca.update({
          where: { id: existing.id },
          data: dados,
        });
      }
      return this.prisma.configuracaoNotificacaoCobranca.create({
        data: {
          tipo,
          cooperativaId: null,
          ativo: dados.ativo ?? true,
          diasReferencia: dados.diasReferencia ?? DIAS_REFERENCIA_PADRAO[tipo],
          texto: dados.texto ?? TEXTOS_PADRAO[tipo],
        },
      });
    }

    return this.prisma.configuracaoNotificacaoCobranca.upsert({
      where,
      create: {
        cooperativaId,
        tipo,
        ativo: dados.ativo ?? true,
        diasReferencia: dados.diasReferencia ?? DIAS_REFERENCIA_PADRAO[tipo],
        texto: dados.texto ?? TEXTOS_PADRAO[tipo],
      },
      update: dados,
    });
  }
}
