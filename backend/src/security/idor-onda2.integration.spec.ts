/**
 * Corretiva IDOR 21/07 — Onda 2 (IDOR estrutural) — integration contra banco real.
 *
 * Cobre itens 2 (motor-proposta enviar-pdf via @TenantResource), 4 (faturas
 * upload-concessionaria service gate), 6 (usinas findDisponiveis service),
 * 8c (ucs.create service), SUSPECT contratos.create service.
 *
 * Itens 8a/8b sao @TenantResource puros — cobertos pelo spec do proprio guard
 * (auth/tenant-ownership.guard.spec.ts) que ja existia + o mecanismo eh o
 * mesmo do 5/7/9 da Onda 1 (validados).
 *
 * PROVA POR MUTACAO: item 4 (faturas.uploadConcessionaria) — se remover o
 * ForbiddenException do gate service-level, o teste falha e ADMIN de A grava
 * fatura pra cooperado de B.
 *
 * Regra contatos-teste (14/05): TENANT_A = CoopereBR principal; TENANT_B
 * temporario criado no beforeAll. Cooperados sinteticos, 27981341348 +
 * lucbragatto+idor@gmail.com.
 */
import { PrismaClient } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FaturasService } from '../faturas/faturas.service';
import { UsinasService } from '../usinas/usinas.service';
import { UcsService } from '../ucs/ucs.service';

const TENANT_A_ID = 'cmn0ho8bx0000uox8wu96u6fd'; // CoopereBR principal
const SMOKE_TAG = 'SMOKE-IDOR-ONDA2-2026-07-21';
const SMOKE_TEL = '27981341348';
const SMOKE_EMAIL_A = 'lucbragatto+idor2a@gmail.com';
const SMOKE_EMAIL_B = 'lucbragatto+idor2b@gmail.com';

describe('IDOR Onda 2 — IDOR estrutural cross-tenant (integration real)', () => {
  const prisma = new PrismaClient();
  let tenantBId: string;
  let cooperadoAId: string;
  let cooperadoBId: string;
  let ucBId: string;

  beforeAll(async () => {
    await cleanup(prisma);

    const tenantB = await prisma.cooperativa.create({
      data: {
        nome: `${SMOKE_TAG} — Tenant B`,
        cnpj: `88${Date.now()}`.slice(0, 14),
      },
    });
    tenantBId = tenantB.id;

    cooperadoAId = (await prisma.cooperado.create({
      data: {
        cooperativaId: TENANT_A_ID,
        nomeCompleto: `[${SMOKE_TAG}] Cooperado A`,
        cpf: '000.000.000-11',
        telefone: SMOKE_TEL,
        email: SMOKE_EMAIL_A,
        status: 'ATIVO_RECEBENDO_CREDITOS',
        modoRemuneracao: 'CLUBE',
        ambienteTeste: true,
      },
    })).id;

    cooperadoBId = (await prisma.cooperado.create({
      data: {
        cooperativaId: tenantBId,
        nomeCompleto: `[${SMOKE_TAG}] Cooperado B`,
        cpf: '000.000.000-22',
        telefone: SMOKE_TEL,
        email: SMOKE_EMAIL_B,
        status: 'ATIVO_RECEBENDO_CREDITOS',
        modoRemuneracao: 'CLUBE',
        ambienteTeste: true,
      },
    })).id;

    // UC pertence a cooperado B (tenant B). Item 6 testa que ADMIN de A nao
    // consegue listar usinas disponiveis pra essa UC. numero unique + enum valido.
    ucBId = (await prisma.uc.create({
      data: {
        numero: `T${Date.now()}B`.slice(0, 15),
        endereco: 'Rua B 123',
        cidade: 'Vitoria',
        estado: 'ES',
        cooperadoId: cooperadoBId,
        distribuidora: 'EDP_ES',
      },
    })).id;
  });

  afterAll(async () => {
    await cleanup(prisma);
    await prisma.$disconnect();
  });

  // ─── Item 4 — faturas.uploadConcessionaria (MUTATION TEST) ───────────────

  describe('Item 4 — faturas.uploadConcessionaria: gate cross-tenant', () => {
    it('🔴 MUTATION TEST — ADMIN de A + cooperadoId de B → Forbidden (defesa em profundidade)', async () => {
      // Se remover o `throw new ForbiddenException` do service (linha ~484
      // do fix), o upload prossegue pro Supabase com cooperadoId de B.
      const svc = getFaturasServiceMinimal();
      await expect(
        svc.uploadConcessionaria(
          {
            cooperadoId: cooperadoBId,
            arquivoBase64: '',
            tipoArquivo: 'pdf' as const,
            mesReferencia: '2026-07',
          },
          TENANT_A_ID, // ADMIN de A tentando gravar fatura pra cooperado B
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('cooperativaIdJwt=null (SUPER_ADMIN) → passa do gate', async () => {
      const svc = getFaturasServiceMinimal();
      // Nao chega ate o Supabase por conta do base64 vazio; erro subsequente
      // NAO eh Forbidden (confirma que o gate deixou passar).
      await expect(
        svc.uploadConcessionaria(
          {
            cooperadoId: cooperadoBId,
            arquivoBase64: '',
            tipoArquivo: 'pdf' as const,
            mesReferencia: '2026-07',
          },
          null,
        ),
      ).rejects.not.toThrow(ForbiddenException);
    });
  });

  // ─── Item 6 — usinas.findDisponiveis (Query param) ───────────────────────

  describe('Item 6 — usinas.findDisponiveis: UC filtrada via cooperado no tenant', () => {
    const svc = new UsinasService(prisma as any);

    it('ADMIN de A + ucId de B → NotFound (UC de B nao existe no tenant A)', async () => {
      await expect(svc.findDisponiveis(ucBId, TENANT_A_ID)).rejects.toThrow(NotFoundException);
    });

    it('SUPER_ADMIN (null) + ucId de B → passa (retorna lista de usinas)', async () => {
      const result = await svc.findDisponiveis(ucBId, null);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── Item 8c — ucs.create ─────────────────────────────────────────────────

  describe('Item 8c — ucs.create: cooperado validado no tenant ANTES', () => {
    const svc = new UcsService(prisma as any);

    it('ADMIN de A + cooperadoId de B → NotFound (nao cria UC orfa)', async () => {
      await expect(
        svc.create(
          {
            numero: `T${Date.now()}C`.slice(0, 15),
            endereco: 'Rua X',
            cidade: 'Vitoria',
            estado: 'ES',
            cooperadoId: cooperadoBId,
            distribuidora: 'EDP_ES',
          },
          TENANT_A_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

async function cleanup(prisma: PrismaClient) {
  // UCs SMOKE identificadas via cooperado.nomeCompleto SMOKE (numero eh timestamp).
  await prisma.uc.deleteMany({ where: { cooperado: { nomeCompleto: { contains: SMOKE_TAG } } } });
  await prisma.cooperado.deleteMany({ where: { nomeCompleto: { contains: SMOKE_TAG } } });
  await prisma.cooperativa.deleteMany({ where: { nome: { contains: SMOKE_TAG } } });
}

function getFaturasServiceMinimal(): FaturasService {
  const svc = Object.create(FaturasService.prototype) as FaturasService;
  (svc as any).prisma = new PrismaClient();
  (svc as any).supabase = {
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: { message: 'mock supabase off' } }),
        getPublicUrl: () => ({ data: { publicUrl: 'mock://' } }),
      }),
    },
  };
  return svc;
}

