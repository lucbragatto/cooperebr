import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const PLANO_CONTAS_PADRAO = [
  { codigo: '1.1.01', nome: 'Mensalidades de Cooperados', tipo: 'RECEITA', grupo: 'RECEITAS_OPERACIONAIS' },
  { codigo: '1.1.02', nome: 'Aluguel de Usina', tipo: 'RECEITA', grupo: 'RECEITAS_OPERACIONAIS' },
  { codigo: '1.1.03', nome: 'Repasse de Sobra - Usina', tipo: 'RECEITA', grupo: 'RECEITAS_OPERACIONAIS' },
  { codigo: '1.1.04', nome: 'Aluguel de Carregador EV', tipo: 'RECEITA', grupo: 'RECEITAS_OPERACIONAIS' },
  { codigo: '1.1.05', nome: 'Outras Receitas', tipo: 'RECEITA', grupo: 'RECEITAS_OPERACIONAIS' },
  { codigo: '2.1.01', nome: 'Transmissao/Distribuicao EDP', tipo: 'DESPESA', grupo: 'DESPESAS_FIXAS' },
  { codigo: '2.1.02', nome: 'Seguro da Usina', tipo: 'DESPESA', grupo: 'DESPESAS_FIXAS' },
  { codigo: '2.1.03', nome: 'Vigilancia', tipo: 'DESPESA', grupo: 'DESPESAS_FIXAS' },
  { codigo: '2.1.04', nome: 'Aluguel da Cooperativa', tipo: 'DESPESA', grupo: 'DESPESAS_FIXAS' },
  { codigo: '2.1.05', nome: 'Arrendamento Area da Usina', tipo: 'DESPESA', grupo: 'DESPESAS_FIXAS' },
  { codigo: '2.1.06', nome: 'Sistema de Cobranca', tipo: 'DESPESA', grupo: 'DESPESAS_FIXAS' },
  { codigo: '2.2.01', nome: 'Manutencao da Usina', tipo: 'DESPESA', grupo: 'DESPESAS_VARIAVEIS' },
  { codigo: '2.2.02', nome: 'Manutencao de Equipamentos', tipo: 'DESPESA', grupo: 'DESPESAS_VARIAVEIS' },
  { codigo: '2.2.03', nome: 'Outras Despesas Variaveis', tipo: 'DESPESA', grupo: 'DESPESAS_VARIAVEIS' },
  { codigo: '3.1.01', nome: 'Pagamento Aluguel - Cooperado Proprietario', tipo: 'DESPESA', grupo: 'OBRIGACOES_COOPERADOS' },
  { codigo: '3.1.02', nome: 'Distribuicao de Sobras', tipo: 'DESPESA', grupo: 'OBRIGACOES_COOPERADOS' },
  { codigo: '4.1.01', nome: 'INSS', tipo: 'DESPESA', grupo: 'TRIBUTOS' },
  { codigo: '4.1.02', nome: 'FGTS', tipo: 'DESPESA', grupo: 'TRIBUTOS' },
  { codigo: '4.1.03', nome: 'IRRF', tipo: 'DESPESA', grupo: 'TRIBUTOS' },
  { codigo: '4.1.04', nome: 'ISS', tipo: 'DESPESA', grupo: 'TRIBUTOS' },
];

@Injectable()
export class PlanoContasService implements OnModuleInit {
  private readonly logger = new Logger(PlanoContasService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedPlanoContas();
  }

  private async seedPlanoContas() {
    const count = await this.prisma.planoContas.count();
    if (count > 0) return;

    this.logger.log('Seed: criando plano de contas padrão...');
    for (const item of PLANO_CONTAS_PADRAO) {
      await this.prisma.planoContas.create({ data: item });
    }
    this.logger.log(`Seed: ${PLANO_CONTAS_PADRAO.length} contas criadas.`);
  }

  async findAll(cooperativaId?: string) {
    return this.prisma.planoContas.findMany({
      where: cooperativaId ? { cooperativaId } : undefined,
      orderBy: { codigo: 'asc' },
    });
  }

  async findOne(id: string, cooperativaId?: string) {
    // D-48-financeiro IDOR fix: findFirst com filtro tenant.
    // PlanoContas global (cooperativaId=null) é visível a todos via findAll;
    // findOne valida que ADMIN só lê próprios + globais.
    const conta = await this.prisma.planoContas.findFirst({
      where: cooperativaId
        ? { id, OR: [{ cooperativaId }, { cooperativaId: null }] }
        : { id },
    });
    if (!conta) throw new NotFoundException(`Plano de contas com id ${id} não encontrado`);
    return conta;
  }

  async create(data: {
    codigo: string;
    nome: string;
    tipo: string;
    grupo: string;
    descricao?: string;
    cooperativaId?: string;
  }) {
    return this.prisma.planoContas.create({ data });
  }

  async update(id: string, data: Partial<{
    codigo: string;
    nome: string;
    tipo: string;
    grupo: string;
    descricao: string;
    ativo: boolean;
  }>, cooperativaId?: string) {
    // D-48-financeiro IDOR fix: ADMIN só edita planos do próprio tenant
    // (globais cooperativaId=null reservados a SUPER_ADMIN).
    if (cooperativaId) {
      const exists = await this.prisma.planoContas.findFirst({
        where: { id, cooperativaId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException(`Plano de contas com id ${id} não encontrado`);
    } else {
      await this.findOne(id);
    }
    return this.prisma.planoContas.update({ where: { id }, data });
  }

  /**
   * D-novo-CT-CT.8 (01/06/2026) — Classifica conta no plano segregado
   * (naturezaContabil + naturezaCooperativa + fundamentoLegal).
   *
   * MESMO guard IDOR do update(): ADMIN só classifica contas do próprio
   * tenant; globais (cooperativaId=null) só SUPER_ADMIN (Guard sistêmico
   * @TenantResource bloqueia ADMIN antes de chegar aqui — mantido aqui
   * por defesa em profundidade).
   *
   * Patch parcial: campos omitidos NÃO sobrescrevem com undefined.
   * Campo enviado com `null` explicitamente limpa a classificação.
   */
  async classificar(
    id: string,
    dto: {
      naturezaCooperativa?: 'PROPRIO' | 'AUXILIAR' | 'NAO_COOPERATIVO' | null;
      naturezaContabil?:
        | 'ATIVO'
        | 'PASSIVO'
        | 'PATRIMONIO_LIQUIDO'
        | 'RECEITA_ATO_PROPRIO'
        | 'RECEITA_ATO_AUXILIAR'
        | 'RECEITA_NAO_COOPERATIVO'
        | 'DESPESA_ATO_PROPRIO'
        | 'DESPESA_ATO_AUXILIAR'
        | 'DESPESA_NAO_COOPERATIVO'
        | 'FUNDOS_OBRIGATORIOS'
        | 'SOBRAS_DISTRIBUIVEIS'
        | 'RESULTADO_NAO_COOPERATIVO'
        | null;
      fundamentoLegal?: string | null;
    },
    cooperativaId?: string,
  ) {
    if (cooperativaId) {
      const exists = await this.prisma.planoContas.findFirst({
        where: { id, cooperativaId },
        select: { id: true },
      });
      if (!exists) {
        throw new NotFoundException(`Plano de contas com id ${id} não encontrado`);
      }
    } else {
      await this.findOne(id);
    }

    // ENFORCEMENT P0-1 (multi-regime — relatório 2026-05-31 conformidade
    // contabil): classificação cooperativa (Próprio/Auxiliar/Não-Coop) é
    // EXCLUSIVA de parceiro COOPERATIVA. Lei 5.764/71 Arts. 79/86/88 não
    // aplica a CONSORCIO/ASSOCIACAO/CONDOMINIO — recolhem por regime próprio.
    // Globais (cooperativaId=null) = templates de plataforma, sem enforcement
    // (só SUPER_ADMIN classifica via Guard sistêmico).
    if (
      'naturezaCooperativa' in dto &&
      dto.naturezaCooperativa != null
    ) {
      const conta = await this.prisma.planoContas.findUnique({
        where: { id },
        select: { cooperativaId: true },
      });
      if (conta?.cooperativaId) {
        const coop = await this.prisma.cooperativa.findUnique({
          where: { id: conta.cooperativaId },
          select: { tipoParceiro: true, nome: true },
        });
        if (coop && coop.tipoParceiro !== 'COOPERATIVA') {
          throw new BadRequestException(
            `Classificação de ato cooperativo (Art. 79/86/88) só se aplica a parceiros COOPERATIVA. ` +
              `${coop.nome} é ${coop.tipoParceiro} e recolhe por regime próprio — você pode registrar naturezaContabil e fundamentoLegal, mas naturezaCooperativa NÃO se aplica.`,
          );
        }
      }
    }

    // Patch parcial — só envia campos presentes no DTO. Permite null explícito
    // pra limpar classificação.
    const data: Record<string, unknown> = {};
    if ('naturezaCooperativa' in dto) data.naturezaCooperativa = dto.naturezaCooperativa;
    if ('naturezaContabil' in dto) data.naturezaContabil = dto.naturezaContabil;
    if ('fundamentoLegal' in dto) data.fundamentoLegal = dto.fundamentoLegal;

    return this.prisma.planoContas.update({
      where: { id },
      data: data as any,
      select: {
        id: true,
        codigo: true,
        nome: true,
        naturezaContabil: true,
        naturezaCooperativa: true,
        fundamentoLegal: true,
      },
    });
  }

  async remove(id: string, cooperativaId?: string) {
    // D-48-financeiro IDOR fix: mesma regra de update.
    if (cooperativaId) {
      const exists = await this.prisma.planoContas.findFirst({
        where: { id, cooperativaId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException(`Plano de contas com id ${id} não encontrado`);
    }
    const lancamentos = await this.prisma.lancamentoCaixa.count({ where: { planoContasId: id } });
    if (lancamentos > 0) {
      return this.prisma.planoContas.update({ where: { id }, data: { ativo: false } });
    }
    return this.prisma.planoContas.delete({ where: { id } });
  }
}
