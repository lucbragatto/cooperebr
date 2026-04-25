import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DistribuidoraEnum } from '@prisma/client';
import { PrismaService } from '../prisma.service';

const DISTRIBUIDORAS_VALIDAS = new Set<DistribuidoraEnum>([
  'EDP_ES', 'EDP_SP', 'CEMIG', 'ENEL_SP', 'LIGHT_RJ', 'CELESC', 'OUTRAS',
]);

/**
 * Normaliza o `numero` canônico SISGD pra 10 dígitos com zero à esquerda.
 * Aceita entrada com pontuação/espaços (ex: "0.000.512.828.054-91" → "00005128280549" → erro).
 * Aceita só dígitos (1-10): preenche com zeros à esquerda.
 *
 * Lança BadRequestException se a entrada não couber em 10 dígitos.
 */
export function normalizarNumeroCanonico(raw: string): string {
  if (!raw) throw new BadRequestException('Campo `numero` é obrigatório');
  const digitos = String(raw).replace(/\D+/g, '');
  if (digitos.length === 0) throw new BadRequestException('Campo `numero` precisa ter dígitos');
  if (digitos.length > 10) {
    throw new BadRequestException(
      `Campo \`numero\` aceita até 10 dígitos canônicos SISGD. Recebido: "${raw}" (${digitos.length} dígitos). ` +
      `Formato display da concessionária deve ir em \`numeroUC\` ou ser convertido antes.`,
    );
  }
  return digitos.padStart(10, '0');
}

/**
 * Normaliza o `numeroUC` legado pra 9 dígitos com zero à esquerda.
 * Lança BadRequestException se a entrada exceder 9 dígitos.
 */
export function normalizarNumeroUC(raw: string): string {
  const digitos = String(raw).replace(/\D+/g, '');
  if (digitos.length === 0) throw new BadRequestException('`numeroUC` precisa ter dígitos');
  if (digitos.length > 9) {
    throw new BadRequestException(
      `Campo \`numeroUC\` (legado) aceita até 9 dígitos. Recebido: "${raw}" (${digitos.length} dígitos).`,
    );
  }
  return digitos.padStart(9, '0');
}

function validarDistribuidora(raw: unknown): DistribuidoraEnum {
  if (!raw) {
    throw new BadRequestException('Campo `distribuidora` é obrigatório');
  }
  const valor = String(raw).toUpperCase().trim();
  if (!DISTRIBUIDORAS_VALIDAS.has(valor as DistribuidoraEnum)) {
    throw new BadRequestException(
      `Distribuidora inválida: "${raw}". Valores aceitos: ${[...DISTRIBUIDORAS_VALIDAS].join(', ')}.`,
    );
  }
  return valor as DistribuidoraEnum;
}

/**
 * Best-effort: aceita strings legadas ("EDP ES", "EDP", "EDP-ES") e mapeia para
 * o enum. Se não reconhecer, retorna OUTRAS (não falha) — usado em pipelines
 * que recebem dados de OCR ou DTOs antigos. Bloco 2 do Sprint 11 vai
 * eliminar a maioria dos calls quando a normalização ficar pronta.
 */
export function coerceDistribuidora(raw: string | undefined | null): DistribuidoraEnum {
  if (!raw) return 'OUTRAS';
  const normalizado = String(raw).toUpperCase().replace(/[\s\-.]+/g, '_');
  if (DISTRIBUIDORAS_VALIDAS.has(normalizado as DistribuidoraEnum)) {
    return normalizado as DistribuidoraEnum;
  }
  // Heurística básica pra strings textuais comuns
  if (/EDP.*ES|ESPIRITO.*SANTO/.test(normalizado)) return 'EDP_ES';
  if (/EDP.*SP|SAO.*PAULO|EDP_BANDEIRANTE/.test(normalizado)) return 'EDP_SP';
  if (/CEMIG/.test(normalizado)) return 'CEMIG';
  if (/ENEL.*SP|ELETROPAULO/.test(normalizado)) return 'ENEL_SP';
  if (/LIGHT/.test(normalizado)) return 'LIGHT_RJ';
  if (/CELESC/.test(normalizado)) return 'CELESC';
  return 'OUTRAS';
}

interface CreateUcInput {
  numero: string;
  endereco: string;
  cidade: string;
  estado: string;
  cooperadoId: string;
  distribuidora: DistribuidoraEnum | string;
  numeroUC?: string;
  numeroConcessionariaOriginal?: string;
  cep?: string;
  bairro?: string;
  classificacao?: string;
  codigoMedidor?: string;
  modalidadeTarifaria?: string;
  tensaoNominal?: string;
  tipoFornecimento?: string;
}

interface UpdateUcInput {
  numero?: string;
  numeroUC?: string;
  numeroConcessionariaOriginal?: string;
  distribuidora?: DistribuidoraEnum | string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  bairro?: string;
  classificacao?: string;
  codigoMedidor?: string;
  modalidadeTarifaria?: string;
  tensaoNominal?: string;
  tipoFornecimento?: string;
}

/**
 * Valida tamanho máximo do `numeroConcessionariaOriginal` (50 chars).
 * Não normaliza — preserva pontuação/hífen exatamente como na fatura.
 */
function validarNumeroOriginal(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const valor = String(raw).trim();
  if (valor.length === 0) return undefined;
  if (valor.length > 50) {
    throw new BadRequestException(
      `\`numeroConcessionariaOriginal\` excede 50 caracteres (recebido: ${valor.length}).`,
    );
  }
  return valor;
}

@Injectable()
export class UcsService {
  constructor(private prisma: PrismaService) {}

  async findAll(cooperativaId?: string) {
    return this.prisma.uc.findMany({
      where: cooperativaId ? { cooperado: { cooperativaId } } : undefined,
      include: { cooperado: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const uc = await this.prisma.uc.findUnique({
      where: { id },
      include: { cooperado: true },
    });
    if (!uc) throw new NotFoundException(`UC com id ${id} não encontrada`);
    return uc;
  }

  async findByCooperado(cooperadoId: string) {
    return this.prisma.uc.findMany({
      where: { cooperadoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateUcInput) {
    const numero = normalizarNumeroCanonico(data.numero);
    const distribuidora = validarDistribuidora(data.distribuidora);
    const numeroUC = data.numeroUC ? normalizarNumeroUC(data.numeroUC) : undefined;
    const numeroConcessionariaOriginal = validarNumeroOriginal(data.numeroConcessionariaOriginal);

    return this.prisma.uc.create({
      data: {
        numero,
        numeroUC,
        numeroConcessionariaOriginal,
        distribuidora,
        endereco: data.endereco,
        cidade: data.cidade,
        estado: data.estado,
        cooperadoId: data.cooperadoId,
        cep: data.cep,
        bairro: data.bairro,
        classificacao: data.classificacao,
        codigoMedidor: data.codigoMedidor,
        modalidadeTarifaria: data.modalidadeTarifaria,
        tensaoNominal: data.tensaoNominal,
        tipoFornecimento: data.tipoFornecimento,
      },
    });
  }

  async update(id: string, data: UpdateUcInput) {
    const patch: Record<string, unknown> = {};
    if (data.numero !== undefined) patch.numero = normalizarNumeroCanonico(data.numero);
    if (data.numeroUC !== undefined) {
      patch.numeroUC = data.numeroUC === '' ? null : normalizarNumeroUC(data.numeroUC);
    }
    if (data.numeroConcessionariaOriginal !== undefined) {
      patch.numeroConcessionariaOriginal =
        data.numeroConcessionariaOriginal === '' ? null : validarNumeroOriginal(data.numeroConcessionariaOriginal);
    }
    if (data.distribuidora !== undefined) patch.distribuidora = validarDistribuidora(data.distribuidora);
    for (const campo of [
      'endereco', 'cidade', 'estado', 'cep', 'bairro',
      'classificacao', 'codigoMedidor', 'modalidadeTarifaria',
      'tensaoNominal', 'tipoFornecimento',
    ] as const) {
      if (data[campo] !== undefined) patch[campo] = data[campo];
    }
    return this.prisma.uc.update({ where: { id }, data: patch });
  }

  async remove(id: string) {
    const contratos = await this.prisma.contrato.count({
      where: { ucId: id, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO', 'LISTA_ESPERA'] } },
    });
    if (contratos > 0) {
      throw new BadRequestException(
        'Não é possível excluir UC com contratos vinculados. Encerre os contratos antes de remover.',
      );
    }
    return this.prisma.uc.delete({ where: { id } });
  }
}
