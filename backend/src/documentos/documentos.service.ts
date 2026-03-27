/// <reference types="multer" />
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { CooperadosService } from '../cooperados/cooperados.service';
import { WhatsappCicloVidaService } from '../whatsapp/whatsapp-ciclo-vida.service';

const BUCKET = 'documentos-cooperados';

const tipoDocumentoLabel: Record<string, string> = {
  RG_FRENTE: 'RG (Frente)',
  RG_VERSO: 'RG (Verso)',
  CNH_FRENTE: 'CNH (Frente)',
  CNH_VERSO: 'CNH (Verso)',
  CONTRATO_SOCIAL: 'Contrato Social',
  OUTROS: 'Outros',
};

@Injectable()
export class DocumentosService {
  private supabase: SupabaseClient;

  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
    private cooperadosService: CooperadosService,
    private whatsappCicloVida: WhatsappCicloVidaService,
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

    // Notificar cooperado via WhatsApp
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: doc.cooperadoId },
      select: { id: true, nomeCompleto: true, telefone: true, cooperativaId: true },
    });
    if (cooperado) {
      this.whatsappCicloVida.notificarDocumentoAprovado(cooperado).catch(() => {});
    }

    await this.cooperadosService.checkProntoParaAtivar(doc.cooperadoId);

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

    // Notificar cooperado via WhatsApp
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: doc.cooperadoId },
      select: { id: true, nomeCompleto: true, telefone: true, cooperativaId: true },
    });
    if (cooperado) {
      this.whatsappCicloVida.notificarDocumentoReprovado(cooperado, motivoRejeicao.trim()).catch(() => {});
    }

    return resultado;
  }

  async uploadAdmin(cooperadoId: string, tipo: string, arquivo: Express.Multer.File) {
    if (!arquivo) throw new BadRequestException('Arquivo obrigatório.');
    if (!tipo) throw new BadRequestException('Tipo de documento obrigatório.');

    const ext = arquivo.originalname.split('.').pop() ?? 'bin';
    const storagePath = `${cooperadoId}/${tipo}_admin_${Date.now()}.${ext}`;

    const { error } = await this.supabase.storage
      .from(BUCKET)
      .upload(storagePath, arquivo.buffer, { contentType: arquivo.mimetype });
    if (error) throw new BadRequestException(`Erro no upload: ${error.message}`);

    const { data: urlData } = this.supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    const existing = await this.prisma.documentoCooperado.findUnique({
      where: { cooperadoId_tipo: { cooperadoId, tipo: tipo as any } },
    });

    const doc = existing
      ? await this.prisma.documentoCooperado.update({
          where: { id: existing.id },
          data: { url: urlData.publicUrl, nomeArquivo: arquivo.originalname, tamanhoBytes: arquivo.size, status: 'PENDENTE', motivoRejeicao: null },
        })
      : await this.prisma.documentoCooperado.create({
          data: { cooperadoId, tipo: tipo as any, url: urlData.publicUrl, nomeArquivo: arquivo.originalname, tamanhoBytes: arquivo.size, status: 'PENDENTE' },
        });

    await this.notificacoes.criar({
      tipo: 'NOVO_DOCUMENTO',
      titulo: 'Novo documento enviado',
      mensagem: `Documento ${tipoDocumentoLabel[tipo] ?? tipo} enviado para aprovação.`,
      cooperadoId,
      link: `/dashboard/cooperados/${cooperadoId}`,
    });

    return doc;
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
