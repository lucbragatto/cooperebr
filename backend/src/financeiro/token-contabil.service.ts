import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * Lançamentos contábeis automáticos para operações de CooperToken.
 *
 * Contas utilizadas (criadas automaticamente se não existirem):
 * - 5.1.01 Custo Desconto Concedido (DESPESA)
 * - 5.1.02 Passivo Tokens a Resgatar (DESPESA — contrapartida de passivo)
 * - 1.2.01 Receita Venda Tokens (RECEITA)
 * - 1.2.02 Receita Tokens Expirados (RECEITA)
 */

interface LancamentoTokenParams {
  cooperativaId: string;
  cooperadoId?: string;
  valor: number;
  competencia: string;
  descricao: string;
  observacoes?: string;
}

const CONTAS_TOKEN = [
  { codigo: '5.1.01', nome: 'Custo Desconto Concedido', tipo: 'DESPESA', grupo: 'TOKENS' },
  { codigo: '5.1.02', nome: 'Passivo Tokens a Resgatar', tipo: 'DESPESA', grupo: 'TOKENS' },
  { codigo: '1.2.01', nome: 'Receita Venda Tokens', tipo: 'RECEITA', grupo: 'TOKENS' },
  { codigo: '1.2.02', nome: 'Receita Tokens Expirados', tipo: 'RECEITA', grupo: 'TOKENS' },
] as const;

@Injectable()
export class TokenContabilService {
  private readonly logger = new Logger(TokenContabilService.name);

  constructor(private prisma: PrismaService) {}

  /** Garante que as contas de token existem no plano de contas */
  private async garantirContas(cooperativaId?: string): Promise<Map<string, string>> {
    const mapa = new Map<string, string>();
    for (const conta of CONTAS_TOKEN) {
      let existing = await this.prisma.planoContas.findFirst({
        where: { codigo: conta.codigo, cooperativaId: cooperativaId ?? undefined },
      });
      if (!existing) {
        existing = await this.prisma.planoContas.create({
          data: { ...conta, cooperativaId },
        });
        this.logger.log(`Plano de contas criado: ${conta.codigo} - ${conta.nome}`);
      }
      mapa.set(conta.codigo, existing.id);
    }
    return mapa;
  }

  private getCompetencia(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * 1. Emissão FATURA_CHEIA_TOKEN
   * D: Custo Desconto Concedido (5.1.01)
   * C: Passivo Tokens a Resgatar (5.1.02)
   */
  async lancarEmissaoFaturaCheia(params: LancamentoTokenParams) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;

    const [debito, credito] = await Promise.all([
      this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'DESPESA',
          descricao: `[Token] D: Custo Desconto Concedido — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get('5.1.01'),
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: params.observacoes ?? 'Emissão token fatura-cheia',
        },
      }),
      this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'RECEITA',
          descricao: `[Token] C: Passivo Tokens a Resgatar — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get('5.1.02'),
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: params.observacoes ?? 'Emissão token fatura-cheia (passivo)',
        },
      }),
    ]);

    this.logger.log(`Lançamento contábil emissão fatura-cheia: R$ ${valor} (${params.cooperativaId})`);
    return { debito, credito };
  }

  /**
   * 2. Compra parceiro PAGO
   * D: Caixa (entrada de dinheiro — representada como RECEITA)
   * C: Receita Venda Tokens (1.2.01)
   */
  async lancarCompraParceiroPago(params: LancamentoTokenParams) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;

    const lancamento = await this.prisma.lancamentoCaixa.create({
      data: {
        tipo: 'RECEITA',
        descricao: `[Token] Receita Venda Tokens — ${params.descricao}`,
        valor,
        competencia,
        status: 'REALIZADO',
        dataPagamento: new Date(),
        planoContasId: contas.get('1.2.01'),
        cooperadoId: params.cooperadoId,
        cooperativaId: params.cooperativaId,
        observacoes: params.observacoes ?? 'Compra de tokens por parceiro',
      },
    });

    this.logger.log(`Lançamento contábil compra parceiro: R$ ${valor} (${params.cooperativaId})`);
    return lancamento;
  }

  /**
   * 3. Resgate na fatura (usar-na-fatura)
   * D: Passivo Tokens a Resgatar (5.1.02) — baixa do passivo
   */
  async lancarResgateFatura(params: LancamentoTokenParams) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;

    const lancamento = await this.prisma.lancamentoCaixa.create({
      data: {
        tipo: 'DESPESA',
        descricao: `[Token] Baixa Passivo Tokens (resgate fatura) — ${params.descricao}`,
        valor,
        competencia,
        status: 'REALIZADO',
        dataPagamento: new Date(),
        planoContasId: contas.get('5.1.02'),
        cooperadoId: params.cooperadoId,
        cooperativaId: params.cooperativaId,
        observacoes: params.observacoes ?? 'Resgate de tokens na fatura (baixa passivo)',
      },
    });

    this.logger.log(`Lançamento contábil resgate fatura: R$ ${valor} (${params.cooperativaId})`);
    return lancamento;
  }

  /**
   * 4. Expiração de tokens
   * D: Passivo Tokens a Resgatar (5.1.02) — baixa
   * C: Receita Tokens Expirados (1.2.02)
   */
  async lancarExpiracao(params: LancamentoTokenParams) {
    const contas = await this.garantirContas(params.cooperativaId);
    const competencia = params.competencia || this.getCompetencia();
    const valor = Math.round(params.valor * 100) / 100;

    const [baixaPassivo, receita] = await Promise.all([
      this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'DESPESA',
          descricao: `[Token] Baixa Passivo Tokens (expiração) — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get('5.1.02'),
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: params.observacoes ?? 'Expiração de tokens (baixa passivo)',
        },
      }),
      this.prisma.lancamentoCaixa.create({
        data: {
          tipo: 'RECEITA',
          descricao: `[Token] Receita Tokens Expirados — ${params.descricao}`,
          valor,
          competencia,
          status: 'REALIZADO',
          dataPagamento: new Date(),
          planoContasId: contas.get('1.2.02'),
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          observacoes: params.observacoes ?? 'Receita de tokens expirados',
        },
      }),
    ]);

    this.logger.log(`Lançamento contábil expiração: R$ ${valor} (${params.cooperativaId})`);
    return { baixaPassivo, receita };
  }
}
