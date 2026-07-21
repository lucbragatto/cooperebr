/**
 * Corretiva IDOR 21/07 — Onda 1 (LGPD) — integration tests contra banco real.
 *
 * Cobre os itens da Onda 1 que envolvem ledigem de dado pessoal cross-tenant.
 * Itens 5/7/9 (@TenantResource) sao cobertos pelo spec do proprio guard
 * (auth/tenant-ownership.guard.spec.ts) — aqui focamos nos itens 1 (pix-excedente
 * LGPD, prioridade absoluta) e 3 (faturas.uploadDocumento).
 *
 * PROVA POR MUTACAO (regra Luciano): o teste "ADMIN A + cooperadoId B → NotFound"
 * do pix-excedente vira mutation test — se algum futuro refactor voltar o
 * `findUnique` sem filtro tenant (linha 53 original), este teste falha.
 *
 * SIDE EFFECTS mockados (regra Luciano "SEM disparo real"):
 * - AsaasService.getApiClient → mock (nao chega ate ele porque flag esta
 *   desativada + validacao de tenant roda ANTES).
 * - Supabase upload → nao chega ate ele porque validacao de tenant roda ANTES
 *   do primeiro `supabase.storage.from(...).upload(...)`.
 * - WA/email → uploadDocumento nao dispara (upload puro).
 *
 * Regra contatos-teste (14/05): TENANT_A = CoopereBR principal (real). TENANT_B
 * = tenant temporario SMOKE-IDOR-ONDA1 criado no beforeAll e removido no
 * afterAll. Cooperados sinteticos, contatos redirecionados pra 27981341348 /
 * lucbragatto+idor@gmail.com (aliases whitelistados).
 */
import { PrismaClient } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { PixExcedenteService } from '../financeiro/pix-excedente.service';
import { FaturasService } from '../faturas/faturas.service';

const TENANT_A_ID = 'cmn0ho8bx0000uox8wu96u6fd'; // CoopereBR principal (CLAUDE.md)
const SMOKE_TAG = 'SMOKE-IDOR-ONDA1-2026-07-21';
const SMOKE_TEL = '27981341348';
const SMOKE_EMAIL_A = 'lucbragatto+idor-a@gmail.com';
const SMOKE_EMAIL_B = 'lucbragatto+idor-b@gmail.com';

describe('IDOR Onda 1 — vazamento LGPD cross-tenant (integration real)', () => {
  const prisma = new PrismaClient();
  let tenantBId: string;
  let cooperadoAId: string;
  let cooperadoBId: string;

  beforeAll(async () => {
    await cleanup(prisma);

    // Cria tenant B temporario — so nome + cnpj (unico) sao required
    const tenantB = await prisma.cooperativa.create({
      data: {
        nome: `${SMOKE_TAG} — Tenant B`,
        cnpj: `99${Date.now()}`.slice(0, 14),
      },
    });
    tenantBId = tenantB.id;

    // Cooperado A no tenant A com pixChave (dado LGPD)
    const cooperadoA = await prisma.cooperado.create({
      data: {
        cooperativaId: TENANT_A_ID,
        nomeCompleto: `[${SMOKE_TAG}] Cooperado A`,
        cpf: '000.000.000-11',
        telefone: SMOKE_TEL,
        email: SMOKE_EMAIL_A,
        status: 'ATIVO_RECEBENDO_CREDITOS',
        modoRemuneracao: 'CLUBE',
        ambienteTeste: true,
        pixChave: 'cooperado-A-pix-secreto',
        pixTipo: 'ALEATORIA',
      },
    });
    cooperadoAId = cooperadoA.id;

    // Cooperado B no tenant B com pixChave DIFERENTE (o dado que NAO pode vazar)
    const cooperadoB = await prisma.cooperado.create({
      data: {
        cooperativaId: tenantBId,
        nomeCompleto: `[${SMOKE_TAG}] Cooperado B`,
        cpf: '000.000.000-22',
        telefone: SMOKE_TEL,
        email: SMOKE_EMAIL_B,
        status: 'ATIVO_RECEBENDO_CREDITOS',
        modoRemuneracao: 'CLUBE',
        ambienteTeste: true,
        pixChave: 'cooperado-B-pix-SECRETO-nao-vazar',
        pixTipo: 'ALEATORIA',
      },
    });
    cooperadoBId = cooperadoB.id;
  });

  afterAll(async () => {
    await cleanup(prisma);
    await prisma.$disconnect();
  });

  // ─── Item 1: POST /financeiro/pix-excedente ─────────────────────────────

  describe('Item 1 — pix-excedente: leitura de pixChave cross-tenant', () => {
    const asaasMock = { getApiClient: jest.fn() } as any;
    const svc = new PixExcedenteService(prisma as any, asaasMock);

    it('🔴 MUTATION TEST — ADMIN de A + cooperadoId de B → NotFound + zero TransferenciaPix criado', async () => {
      // Cenario do vazamento: ADMIN autenticado no tenant A tenta ler
      // dados do cooperadoId B. Comportamento antigo: findUnique retorna
      // dados de B incluindo pixChave → LGPD violado + TransferenciaPix
      // SIMULADO gravada no banco A. Comportamento novo: findFirst com
      // filtro tenant → null → NotFound antes de qualquer efeito.
      const transferenciasAntes = await prisma.transferenciaPix.count();

      await expect(
        svc.processarPixExcedente({
          cooperadoId: cooperadoBId,
          cooperativaId: TENANT_A_ID, // ADMIN de A alegando poder ler cooperado B
          kwhExcedente: 100,
          tarifaKwh: 0.8,
          mesReferencia: '2026-07',
        }),
      ).rejects.toThrow(NotFoundException);

      const transferenciasDepois = await prisma.transferenciaPix.count();
      expect(transferenciasDepois).toBe(transferenciasAntes); // ZERO delta — nenhum registro criado
      expect(asaasMock.getApiClient).not.toHaveBeenCalled(); // flag off nem chega
    });

    it('ADMIN de A + cooperadoId de A → segue fluxo normal (cria TransferenciaPix SIMULADO)', async () => {
      // Caller LEGITIMO — pixChave aparece no response por design (ADMIN tem
      // permissao pra ver dados do proprio tenant). O teste MUTATION acima
      // (ADMIN A → cooperadoId B → NotFound) e o que prova o gate LGPD.
      const transferenciasAntes = await prisma.transferenciaPix.count();

      const result = await svc.processarPixExcedente({
        cooperadoId: cooperadoAId,
        cooperativaId: TENANT_A_ID,
        kwhExcedente: 100,
        tarifaKwh: 0.8,
        mesReferencia: '2026-07',
      });

      expect(result).toBeDefined();
      const transferenciasDepois = await prisma.transferenciaPix.count();
      expect(transferenciasDepois).toBe(transferenciasAntes + 1); // criou 1 SIMULADO
    });

    it('SUPER_ADMIN (cooperativaId=null) + cooperadoId de B → bypass legitimo cross-tenant', async () => {
      // Regra: SUPER_ADMIN pode agir cross-tenant intencionalmente. Este teste
      // confirma que o bypass funciona (nao ganha NotFound). Retorno com
      // pixChave e esperado pro caller legitimo — nao e vazamento.
      const result = await svc.processarPixExcedente({
        cooperadoId: cooperadoBId,
        cooperativaId: null, // NULL = SUPER_ADMIN bypass (resolveTenantIdFromReq)
        kwhExcedente: 100,
        tarifaKwh: 0.8,
        mesReferencia: '2026-07',
      });
      expect(result).toBeDefined();
    });
  });

  // ─── Item 3: POST /faturas/documento ─────────────────────────────────────

  describe('Item 3 — faturas.uploadDocumento: gate cross-tenant service-level', () => {
    // O controller ja fecha o self-check FATURA-01 pra COOPERADO. Aqui testamos
    // a defesa em profundidade no SERVICE — cobre ADMIN/OPERADOR de A tentando
    // gravar documento de cooperado B (self-check nao dispara pra ADMIN).
    it('cooperativaIdJwt de A + cooperadoId de B → NotFound (nao chega ao Supabase)', async () => {
      const svc = await getFaturasServiceMinimal();
      await expect(
        svc.uploadDocumento(
          {
            cooperadoId: cooperadoBId,
            tipoDocumento: 'RG',
            arquivoBase64: '', // vazio — nao chega ate aqui de qualquer jeito
            tipoArquivo: 'pdf' as const,
          },
          TENANT_A_ID, // ADMIN de A alegando gravar doc de cooperado B
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('cooperativaIdJwt=null (SUPER_ADMIN) → passa do gate (nao valida tenant)', async () => {
      const svc = await getFaturasServiceMinimal();
      // SUPER_ADMIN passa do gate; erro posterior (base64 vazio → Supabase upload
      // vai falhar) confirma que a validacao de tenant NAO foi o que barrou.
      await expect(
        svc.uploadDocumento(
          {
            cooperadoId: cooperadoBId,
            tipoDocumento: 'RG',
            arquivoBase64: '',
            tipoArquivo: 'pdf' as const,
          },
          null, // SUPER_ADMIN bypass
        ),
      ).rejects.not.toThrow(NotFoundException); // rejeicao vem do Supabase (outro erro)
    });
  });
});

async function cleanup(prisma: PrismaClient) {
  // Ordem importa por FK. Remove TransferenciaPix de cooperados/tenants SMOKE,
  // depois cooperados SMOKE, depois cooperativas SMOKE.
  await prisma.transferenciaPix.deleteMany({
    where: {
      OR: [
        { cooperado: { nomeCompleto: { contains: SMOKE_TAG } } },
      ],
    },
  });
  await prisma.cooperado.deleteMany({
    where: { nomeCompleto: { contains: SMOKE_TAG } },
  });
  await prisma.cooperativa.deleteMany({
    where: { nome: { contains: SMOKE_TAG } },
  });
}

async function getFaturasServiceMinimal(): Promise<FaturasService> {
  // Minimo pra chamar uploadDocumento — so precisa de prisma pra validar o
  // cooperado no tenant. Outras deps do FaturasService (Supabase, WA, etc)
  // sao invocadas somente depois do gate — sem interesse pro teste de IDOR.
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
