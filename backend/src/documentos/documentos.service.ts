import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma.service';

const BUCKET = 'documentos-cooperados';

@Injectable()
export class DocumentosService {
  private supabase: SupabaseClient;

  constructor(private prisma: PrismaService) {
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

    return this.prisma.documentoCooperado.update({
      where: { id },
      data: { status: 'APROVADO', motivoRejeicao: null },
    });
  }

  async reprovar(id: string, motivoRejeicao: string) {
    if (!motivoRejeicao?.trim()) {
      throw new BadRequestException('Motivo de rejeição é obrigatório.');
    }
    const doc = await this.prisma.documentoCooperado.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Documento não encontrado.');

    return this.prisma.documentoCooperado.update({
      where: { id },
      data: { status: 'REPROVADO', motivoRejeicao: motivoRejeicao.trim() },
    });
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
