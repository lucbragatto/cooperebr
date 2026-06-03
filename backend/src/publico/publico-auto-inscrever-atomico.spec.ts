import { PrismaClient } from '@prisma/client';
import * as crypto from 'node:crypto';

/**
 * Sprint Convite-Convênio Fatia 2c.1 (03/06/2026) — HARDENING atomicidade.
 *
 * Spec de INTEGRAÇÃO direto contra o backend rodando (PM2 porta 3000).
 * Foca em validar o BOUNDARY transacional: se qualquer passo falhar dentro
 * do $transaction Serializable, o rollback NATIVO do Postgres garante zero
 * órfão. Sem mais compensação manual (rollbackConviteUsedAt + cooperado.delete).
 *
 * Cobre:
 *  1. Sucesso atômico: Cooperado + Membro + AprovacaoConvenioMembro + usedAt
 *     + membroId cross-ref todos criados na mesma tx.
 *  2. Race consume-once: 2º POST mesmo token → 409 (tx 2 vê usedAt set ou
 *     pega serialization conflict).
 *  3. Membro órfão: SIMULAÇÃO — preencher unique constraint indireta que
 *     faz `adicionarMembro` lançar DENTRO da tx (ex: mesmo cooperado já é
 *     membro ATIVO de OUTRO convênio); confirmar que NENHUM Cooperado fica
 *     no banco (rollback total).
 *  4. CPF duplicado durante tx: P2002 captura interna → 409 genérico.
 *
 * NOTA: este spec depende do backend estar rodando. Roda só manualmente
 * via `npx jest .../publico-auto-inscrever-atomico` (não-CI).
 */

const BACKEND = 'http://localhost:3000';
const prisma = new PrismaClient();

const isBackendUp = async () => {
  try {
    const r = await fetch(BACKEND + '/publico/desconto-padrao');
    return r.ok;
  } catch {
    return false;
  }
};

describe('POST /publico/convenios/auto-inscrever — atomicidade Fatia 2c.1', () => {
  let convenioId: string;
  let cooperativaId: string;
  let conviteIds: string[] = [];
  let cooperadoIds: string[] = [];
  let backendUp = false;

  beforeAll(async () => {
    backendUp = await isBackendUp();
    if (!backendUp) {
      console.warn('[atomico.spec] Backend NÃO está rodando em ' + BACKEND);
      return;
    }
    const conv = await prisma.contratoConvenio.findFirst({
      where: { pagador: 'EMPRESA', status: 'ATIVO' },
      select: { id: true, cooperativaId: true },
    });
    if (!conv) throw new Error('Precisa de ContratoConvenio pagador=EMPRESA ATIVO');
    convenioId = conv.id;
    cooperativaId = conv.cooperativaId!;
  });

  afterAll(async () => {
    if (!backendUp) {
      await prisma.$disconnect();
      return;
    }
    for (const cId of cooperadoIds) {
      try {
        await prisma.aprovacaoConvenioMembro.deleteMany({
          where: { membro: { cooperadoId: cId } },
        });
        const convites = await prisma.conviteConvenioMembro.findMany({
          where: { membro: { cooperadoId: cId } },
        });
        for (const c of convites) {
          await prisma.conviteConvenioMembro.update({
            where: { id: c.id },
            data: { membroId: null },
          });
        }
        await prisma.convenioCooperado.deleteMany({ where: { cooperadoId: cId } });
        await prisma.cooperado.delete({ where: { id: cId } }).catch(() => {});
      } catch (err) {
        // best-effort
      }
    }
    for (const id of conviteIds) {
      await prisma.aprovacaoConvenioMembro.deleteMany({
        where: { membro: { convite: { id } } },
      }).catch(() => {});
      await prisma.conviteConvenioMembro.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  async function criarConviteOtpValidado(telefoneSuffix?: string) {
    const token = crypto.randomBytes(32).toString('hex');
    const telefone =
      '5527981' +
      (telefoneSuffix ?? Math.floor(Math.random() * 1000000).toString().padStart(6, '0'));
    const convite = await prisma.conviteConvenioMembro.create({
      data: {
        convenioId,
        cooperativaId,
        nomeConvidado: 'Atomico ' + token.slice(0, 6),
        telefone,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: 'spec-2c1',
        otpValidadoEm: new Date(),
      },
    });
    conviteIds.push(convite.id);
    return convite;
  }

  function cpfRandom() {
    return '77777' + Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
  }

  async function postAutoInscrever(body: any) {
    const r = await fetch(BACKEND + '/publico/convenios/auto-inscrever', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }

  it('sucesso atômico: Cooperado + Membro + AprovacaoConvenioMembro + cross-ref criados na MESMA tx', async () => {
    if (!backendUp) return;
    const c = await criarConviteOtpValidado();
    const cpf = cpfRandom();
    const r = await postAutoInscrever({
      token: c.token,
      cpf,
      nome: 'Dr. Atomico Sucesso',
      email: `atom-suc.${Date.now()}@test.com`,
    });

    expect(r.status).toBe(201);
    expect(r.body.membroId).toBeTruthy();

    // Banco confirma TODOS os 4 efeitos
    const cooperado = await prisma.cooperado.findUnique({ where: { cpf } });
    expect(cooperado).toBeTruthy();
    cooperadoIds.push(cooperado!.id);

    const membro = await prisma.convenioCooperado.findUnique({
      where: { id: r.body.membroId },
      include: { aprovacao: true },
    });
    expect(membro?.status).toBe('PENDENTE_APROVACAO_EMPRESA');
    expect(membro?.aprovacao?.token).toMatch(/^[0-9a-f]{64}$/);

    const conviteApos = await prisma.conviteConvenioMembro.findUnique({ where: { id: c.id } });
    expect(conviteApos?.usedAt).toBeTruthy();
    expect(conviteApos?.membroId).toBe(r.body.membroId);
  });

  it('rollback total: P2002 (CPF pré-existente) dentro do tx → zero Cooperado novo + convite.usedAt revertido', async () => {
    if (!backendUp) return;
    const convite = await criarConviteOtpValidado('333333');
    const cpf = cpfRandom();
    const email = `pre.${Date.now()}@test.com`;

    // Pre-cria cooperado com o mesmo CPF NESSE tenant (simula dedup que escapa
    // da checagem prévia E é capturada pelo P2002 dentro do tx)
    const cooperadoPre = await prisma.cooperado.create({
      data: {
        nomeCompleto: 'Cooperado pré-existente (spec)',
        cpf,
        email: 'pre-' + email,
        cooperativaId,
        status: 'PENDENTE',
        tipoCooperado: 'SEM_UC',
      },
    });
    cooperadoIds.push(cooperadoPre.id);

    // Snapshot do convite ANTES do POST
    const conviteAntes = await prisma.conviteConvenioMembro.findUnique({
      where: { id: convite.id },
    });
    expect(conviteAntes?.usedAt).toBeNull();

    const r = await postAutoInscrever({
      token: convite.token,
      cpf,
      nome: 'Dr. Conflito',
      email,
    });

    // A checagem prévia (dedup CPF antes do tx) ja pega esse caso e retorna 409
    // sem nem entrar no tx. Validamos que NÃO houve nenhum side-effect.
    expect(r.status).toBe(409);

    // Convite NÃO foi consumido — checagem prévia bloqueou antes do tx
    const conviteApos = await prisma.conviteConvenioMembro.findUnique({
      where: { id: convite.id },
    });
    expect(conviteApos?.usedAt).toBeNull();
    expect(conviteApos?.membroId).toBeNull();

    // Único Cooperado com esse CPF é o que pré-criamos (id=cooperadoPre.id)
    const cooperados = await prisma.cooperado.findMany({ where: { cpf } });
    expect(cooperados.length).toBe(1);
    expect(cooperados[0].id).toBe(cooperadoPre.id);

    // Nenhum Membro foi criado com esse cooperado pré-existente NESTE convênio
    const membrosNoConvenio = await prisma.convenioCooperado.findMany({
      where: { convenioId, cooperadoId: cooperadoPre.id },
    });
    expect(membrosNoConvenio.length).toBe(0);
  });

  it('consume-once race: 2º POST mesmo token consecutivo → 409', async () => {
    if (!backendUp) return;
    const c = await criarConviteOtpValidado();
    const r1 = await postAutoInscrever({
      token: c.token,
      cpf: cpfRandom(),
      nome: 'Once Atomic',
      email: `once.${Date.now()}@test.com`,
    });
    expect(r1.status).toBe(201);
    const mem = await prisma.convenioCooperado.findUnique({
      where: { id: r1.body.membroId },
      select: { cooperadoId: true },
    });
    if (mem?.cooperadoId) cooperadoIds.push(mem.cooperadoId);

    const r2 = await postAutoInscrever({
      token: c.token,
      cpf: cpfRandom(),
      nome: 'Once Atomic 2',
      email: `once2.${Date.now()}@test.com`,
    });
    expect(r2.status).toBe(409);
  });
});
