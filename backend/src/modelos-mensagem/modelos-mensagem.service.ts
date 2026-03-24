import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const VARIAVEIS_EXEMPLO: Record<string, string> = {
  '{{nome}}': 'João Silva',
  '{{economia}}': 'R$ 150,00',
  '{{link}}': 'https://coopere.br/proposta/abc123',
  '{{desconto}}': '18%',
  '{{mes}}': 'março/2026',
};

@Injectable()
export class ModelosMensagemService {
  constructor(private prisma: PrismaService) {}

  findAll(categoria?: string) {
    return this.prisma.modeloMensagem.findMany({
      where: categoria ? { categoria } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.modeloMensagem.findUniqueOrThrow({ where: { id } });
  }

  create(data: { cooperativaId?: string; nome: string; categoria: string; conteudo: string; ativo?: boolean }) {
    return this.prisma.modeloMensagem.create({ data });
  }

  update(id: string, data: { nome?: string; categoria?: string; conteudo?: string; ativo?: boolean }) {
    return this.prisma.modeloMensagem.update({ where: { id }, data });
  }

  delete(id: string) {
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
}
