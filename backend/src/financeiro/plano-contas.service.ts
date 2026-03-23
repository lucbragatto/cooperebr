import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
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

  async findOne(id: string) {
    const conta = await this.prisma.planoContas.findUnique({ where: { id } });
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
  }>) {
    await this.findOne(id);
    return this.prisma.planoContas.update({ where: { id }, data });
  }

  async remove(id: string) {
    const lancamentos = await this.prisma.lancamentoCaixa.count({ where: { planoContasId: id } });
    if (lancamentos > 0) {
      // Desativar em vez de excluir se há lançamentos vinculados
      return this.prisma.planoContas.update({ where: { id }, data: { ativo: false } });
    }
    return this.prisma.planoContas.delete({ where: { id } });
  }
}
