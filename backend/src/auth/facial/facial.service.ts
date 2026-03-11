import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { PrismaService } from '../../prisma.service';
import { CadastrarFacialDto } from './dto/cadastrar-facial.dto';
import { VerificarFacialDto } from './dto/verificar-facial.dto';

const BUCKET = 'fotos-faciais';
const IMG_SIZE = 64;

@Injectable()
export class FacialService {
  private supabase: SupabaseClient;

  constructor(private prisma: PrismaService) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
  }

  async cadastrar(dto: CadastrarFacialDto): Promise<{ sucesso: boolean; url: string }> {
    const buffer = this.base64ParaBuffer(dto.fotoBase64);
    const bufferJpeg = await sharp(buffer).jpeg().toBuffer();
    const filePath = `${dto.usuarioId}/${Date.now()}.jpg`;

    const { data: uploadData, error: uploadError } = await this.supabase.storage
      .from(BUCKET)
      .upload(filePath, bufferJpeg, { contentType: 'image/jpeg', upsert: true });

    if (uploadError || !uploadData) {
      throw new BadRequestException(
        `Erro ao fazer upload da foto: ${uploadError?.message ?? 'desconhecido'}`,
      );
    }

    const { data: urlData } = this.supabase.storage
      .from(BUCKET)
      .getPublicUrl(uploadData.path);

    const url = urlData.publicUrl;

    await this.prisma.usuario.update({
      where: { id: dto.usuarioId },
      data: { fotoFacialUrl: url },
    });

    return { sucesso: true, url };
  }

  async verificar(dto: VerificarFacialDto): Promise<{ autorizado: boolean; similaridade: number }> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: dto.usuarioId },
      select: { fotoFacialUrl: true },
    });

    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (!usuario.fotoFacialUrl) {
      throw new BadRequestException('Usuário não possui foto facial cadastrada');
    }

    const bufferNova = this.base64ParaBuffer(dto.fotoBase64);

    const fileName = usuario.fotoFacialUrl.split('/fotos-faciais/')[1];
    const { data, error } = await this.supabase.storage
      .from(BUCKET)
      .download(fileName);

    if (error || !data) {
      throw new BadRequestException('Erro ao baixar foto cadastrada');
    }

    const bufferCadastrada = Buffer.from(await data.arrayBuffer());

    const [pixelsNova, pixelsCadastrada] = await Promise.all([
      this.normalizarImagem(bufferNova),
      this.normalizarImagem(bufferCadastrada),
    ]);

    const similaridade = this.calcularSimilaridade(pixelsNova, pixelsCadastrada);
    const autorizado = similaridade >= 0.6;

    return { autorizado, similaridade };
  }

  private base64ParaBuffer(base64: string): Buffer {
    const dados = base64.includes(',') ? base64.split(',')[1] : base64;
    return Buffer.from(dados, 'base64');
  }

  private async normalizarImagem(buffer: Buffer): Promise<number[]> {
    const raw = await sharp(buffer)
      .resize(IMG_SIZE, IMG_SIZE)
      .grayscale()
      .raw()
      .toBuffer();

    return Array.from(raw).map((p) => (p as number) / 255);
  }

  private calcularSimilaridade(a: number[], b: number[]): number {
    const distancia = Math.sqrt(
      a.reduce((acc, val, i) => acc + Math.pow(val - b[i], 2), 0),
    );
    const maxDistancia = Math.sqrt(a.length);
    return Math.max(0, 1 - distancia / maxDistancia);
  }
}
