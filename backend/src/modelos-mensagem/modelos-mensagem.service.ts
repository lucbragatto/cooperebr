import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const VARIAVEIS_EXEMPLO: Record<string, string> = {
  '{{nome}}': 'João Silva',
  '{{economia}}': 'R$ 150,00',
  '{{link}}': 'https://coopere.br/proposta/abc123',
  '{{desconto}}': '18%',
  '{{mes}}': 'março/2026',
};

/**
 * Escopo multi-tenant para queries de ModeloMensagem.
 *
 * - `undefined` → escopo SUPER_ADMIN (sem filtro, vê tudo de todas as cooperativas).
 * - `null`      → escopo "anônimo / lead novo" (vê apenas templates globais com cooperativaId=null).
 * - `string`    → escopo tenant (vê próprios + globais).
 *
 * Convenção: cooperativaId=null já é usado como "template global" nos seeds
 * (ver backend/prisma/seed-fluxo-padrao.ts).
 */
export type EscopoTenant = string | null | undefined;

interface CreateModeloMensagemInput {
  cooperativaId?: string | null;
  nome: string;
  categoria: string;
  conteudo: string;
  ativo?: boolean;
}

interface UpdateModeloMensagemInput {
  nome?: string;
  categoria?: string;
  conteudo?: string;
  ativo?: boolean;
}

@Injectable()
export class ModelosMensagemService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lista modelos respeitando o escopo multi-tenant.
   * Ver {@link EscopoTenant} para semântica dos valores.
   */
  findAll(categoria: string | undefined, escopo: EscopoTenant) {
    const where: Record<string, unknown> = {};
    if (categoria) where.categoria = categoria;
    Object.assign(where, this.filtroTenant(escopo));

    return this.prisma.modeloMensagem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Busca um modelo garantindo que pertence ao escopo (próprio ou global).
   * Lança 404 se não existe ou se pertence a outro tenant.
   */
  async findOne(id: string, escopo: EscopoTenant) {
    const modelo = await this.prisma.modeloMensagem.findUnique({ where: { id } });
    if (!modelo) throw new NotFoundException(`Modelo de mensagem ${id} não encontrado`);
    this.garantirAcesso(modelo.cooperativaId, escopo);
    return modelo;
  }

  /**
   * Cria modelo. Se o escopo é um tenant específico, força cooperativaId
   * para esse tenant (impede admin do tenant A criar modelo no tenant B).
   * SUPER_ADMIN pode criar global (cooperativaId=null) ou em qualquer tenant.
   */
  create(data: CreateModeloMensagemInput, escopo: EscopoTenant) {
    const cooperativaId =
      escopo === undefined ? (data.cooperativaId ?? null) : escopo;

    return this.prisma.modeloMensagem.create({
      data: {
        ...data,
        cooperativaId,
      },
    });
  }

  async update(id: string, data: UpdateModeloMensagemInput, escopo: EscopoTenant) {
    await this.findOne(id, escopo); // valida acesso
    return this.prisma.modeloMensagem.update({ where: { id }, data });
  }

  async delete(id: string, escopo: EscopoTenant) {
    await this.findOne(id, escopo); // valida acesso
    return this.prisma.modeloMensagem.delete({ where: { id } });
  }

  substituirVariaveis(conteudo: string): string {
    let texto = conteudo;
    for (const [variavel, valor] of Object.entries(VARIAVEIS_EXEMPLO)) {
      texto = texto.replaceAll(variavel, valor);
    }
    return texto;
  }

  async incrementarUsos(id: string) {
    return this.prisma.modeloMensagem.update({
      where: { id },
      data: { usosCount: { increment: 1 } },
    });
  }

  // ─── helpers internos ────────────────────────────────────────────────────

  /**
   * Monta o filtro Prisma de cooperativaId conforme o escopo.
   * Retorna `{}` quando o chamador é SUPER_ADMIN (sem filtro).
   */
  private filtroTenant(escopo: EscopoTenant): Record<string, unknown> {
    if (escopo === undefined) return {}; // SUPER_ADMIN — sem filtro
    if (escopo === null) return { cooperativaId: null }; // só globais
    return { OR: [{ cooperativaId: escopo }, { cooperativaId: null }] };
  }

  /**
   * Garante que o recurso pertence ao escopo (próprio ou global).
   * SUPER_ADMIN passa sempre.
   */
  private garantirAcesso(recursoCooperativaId: string | null, escopo: EscopoTenant): void {
    if (escopo === undefined) return; // SUPER_ADMIN
    if (recursoCooperativaId === null) return; // recurso global é leitura permitida
    if (recursoCooperativaId !== escopo) {
      throw new ForbiddenException('Acesso negado: recurso pertence a outro tenant');
    }
  }
}
