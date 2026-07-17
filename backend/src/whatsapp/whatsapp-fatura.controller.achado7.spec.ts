/**
 * Corretiva de segurança 2026-07-16 — Achado 7.
 *
 * Escopo: prova que o endpoint `GET /whatsapp/conversas` (getConversas)
 * NÃO retorna `ConversaWhatsapp.dadosTemp` no payload JSON. Antes do fix,
 * `findMany` sem `select` retornava a row inteira, e o `dadosTemp`
 * (scratchpad usado pelo fluxo motor pra guardar hash+salt do PIN proposto
 * durante DEFINIR_PIN — e QUALQUER coisa que fluxo futuro puser) chegava
 * ao browser via JSON. Um ADMIN do tenant lia via DevTools.
 *
 * Este spec é o teste de FRONTEIRA DE CONTENÇÃO — se alguém remover o
 * select no futuro (regressão), o assert `NOT toHaveProperty('dadosTemp')`
 * quebra. Achado 6 e Achado 7 parte 4 (hash com defesa em profundidade)
 * dependem desta contenção pra a cadeia inteira ficar de pé.
 */
import { WhatsappFaturaController } from './whatsapp-fatura.controller';
import { PrismaService } from '../prisma.service';

describe('WhatsappFaturaController.getConversas — payload NÃO contém dadosTemp (Achado 7)', () => {
  function buildSut() {
    const conversaFindMany = jest.fn();
    const conversaCount = jest.fn().mockResolvedValue(1);
    const cooperadoFindMany = jest.fn().mockResolvedValue([]);
    const mensagemFindMany = jest.fn().mockResolvedValue([]);

    const prismaMock = {
      conversaWhatsapp: { findMany: conversaFindMany, count: conversaCount },
      cooperado: { findMany: cooperadoFindMany },
      mensagemWhatsapp: { findMany: mensagemFindMany },
    } as unknown as PrismaService;

    const controller = Object.create(WhatsappFaturaController.prototype) as WhatsappFaturaController;
    (controller as any).prisma = prismaMock;

    return { controller, conversaFindMany, conversaCount };
  }

  const REQ_ADMIN = {
    user: { perfil: 'ADMIN', cooperativaId: 'tenant-A' },
  } as any;

  it('payload NÃO contém `dadosTemp` (contenção) — mesmo quando o banco tem PIN residente', async () => {
    const { controller, conversaFindMany } = buildSut();

    // Simula o banco tendo o PIN residente (Achado 7 sem fix). O select
    // do controller PRECISA impedir que isto suba pro payload.
    conversaFindMany.mockImplementation(async (args: { select?: Record<string, boolean> }) => {
      // Emula comportamento real do Prisma: se select foi informado,
      // devolve só os campos pedidos. Se não, devolve tudo (bug do
      // Achado 7).
      const rowInteira = {
        id: 'conv-1',
        telefone: '5527981341348',
        estado: 'DEFINIR_PIN_AGUARDANDO_CONFIRMACAO',
        cooperadoId: 'coop-1',
        cooperativaId: 'tenant-A',
        updatedAt: new Date('2026-07-16T18:00:00Z'),
        dadosTemp: {
          definirPinPropostoHash: 'abc123...deadbeef',
          definirPinPropostoSalt: 'saltyfeed',
        },
        contadorFallback: 0,
      };
      if (args.select) {
        const out: any = {};
        for (const k of Object.keys(args.select)) {
          if ((args.select as any)[k]) out[k] = (rowInteira as any)[k];
        }
        return [out];
      }
      return [rowInteira];
    });

    const resp = await controller.getConversas(REQ_ADMIN);

    expect(resp.items).toHaveLength(1);
    const item = resp.items[0] as Record<string, unknown>;

    // Campos que a UI usa PRESENTES.
    expect(item).toHaveProperty('id', 'conv-1');
    expect(item).toHaveProperty('telefone', '5527981341348');
    expect(item).toHaveProperty('estado', 'DEFINIR_PIN_AGUARDANDO_CONFIRMACAO');
    expect(item).toHaveProperty('cooperadoId', 'coop-1');
    expect(item).toHaveProperty('updatedAt');

    // PROVA CIRÚRGICA DO FIX: dadosTemp NÃO chega ao payload.
    expect(item).not.toHaveProperty('dadosTemp');
    // Serializando pra JSON também não pode ter as chaves do scratchpad.
    const json = JSON.stringify(resp);
    expect(json).not.toContain('definirPinPropostoHash');
    expect(json).not.toContain('definirPinPropostoSalt');
    expect(json).not.toContain('saltyfeed');
  });

  it('argumentos do findMany incluem `select` explícito com o shape da UI', async () => {
    const { controller, conversaFindMany } = buildSut();
    conversaFindMany.mockResolvedValue([]);

    await controller.getConversas(REQ_ADMIN);

    expect(conversaFindMany).toHaveBeenCalledTimes(1);
    const args = conversaFindMany.mock.calls[0][0];
    expect(args).toHaveProperty('select');
    // Campos-UI presentes.
    expect(args.select).toMatchObject({
      id: true,
      telefone: true,
      estado: true,
      cooperadoId: true,
      cooperativaId: true,
      updatedAt: true,
    });
    // dadosTemp NÃO está no select.
    expect(args.select).not.toHaveProperty('dadosTemp');
  });
});
