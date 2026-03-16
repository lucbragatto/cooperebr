import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const BUCKET = 'documentos-cooperados';

const tipoDocumentoLabel: Record<string, string> = {
  RG_FRENTE: 'RG (Frente)',
  RG_VERSO: 'RG (Verso)',
  CNH_FRENTE: 'CNH (Frente)',
  CNH_VERSO: 'CNH (Verso)',
  CONTRATO_SOCIAL: 'Contrato Social',
};

@Injectable()
export class DocumentosService {
  private supabase: SupabaseClient;

  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
  }

  async findByCooperado(cooperadoId: string) {
    return this.prisma.documentoCooperado.findMany({
      where: { cooperadoId },
      orderBy: { tipo: 'asc' },
    });
  }

  async aprovar(id: string) {
    const doc = await this.prisma.documentoCooperado.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Documento não encontrado.');

    const resultado = await this.prisma.documentoCooperado.update({
      where: { id },
      data: { status: 'APROVADO', motivoRejeicao: null },
    });

    await this.notificacoes.criar({
      tipo: 'DOCUMENTO_APROVADO',
      titulo: 'Documento aprovado',
      mensagem: `Seu documento ${tipoDocumentoLabel[doc.tipo] ?? doc.tipo} foi aprovado.`,
      cooperadoId: doc.cooperadoId,
      link: `/dashboard/cooperados/${doc.cooperadoId}`,
    });

    return resultado;
  }

  async reprovar(id: string, motivoRejeicao: string) {
    if (!motivoRejeicao?.trim()) {
      throw new BadRequestException('Motivo de rejeição é obrigatório.');
    }
    const doc = await this.prisma.documentoCooperado.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Documento não encontrado.');

    const resultado = await this.prisma.documentoCooperado.update({
      where: { id },
      data: { status: 'REPROVADO', motivoRejeicao: motivoRejeicao.trim() },
    });

    await this.notificacoes.criar({
      tipo: 'DOCUMENTO_REPROVADO',
      titulo: 'Documento reprovado',
      mensagem: `Seu documento ${tipoDocumentoLabel[doc.tipo] ?? doc.tipo} foi reprovado. Motivo: ${motivoRejeicao.trim()}`,
      cooperadoId: doc.cooperadoId,
      link: `/dashboard/cooperados/${doc.cooperadoId}`,
    });

    return resultado;
  }

  async remove(id: string) {
    const doc = await this.prisma.documentoCooperado.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Documento não encontrado.');

    // Extrair caminho no storage a partir da URL pública
    const supabaseUrl = process.env.SUPABASE_URL!;
    const prefix = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/`;
    if (doc.url.startsWith(prefix)) {
      const storagePath = doc.url.slice(prefix.length);
      await this.supabase.storage.from(BUCKET).remove([storagePath]);
    }

    await this.prisma.documentoCooperado.delete({ where: { id } });
    return { sucesso: true };
  }
}
