/**
 * Corretiva de segurança 2026-07-16 — Achado 6 (severidade máxima).
 *
 * PIN é credencial PERSISTENTE que protege transação de token. Antes deste
 * fix, quando o cooperado digitava o PIN pelo WhatsApp em resposta à
 * pergunta do bot ("escolha seu PIN de 6 dígitos"), o `whatsapp-bot.service
 * processarMensagem` gravava o inbound como `direcao='ENTRADA'` com o texto
 * cru em `mensagens_whatsapp.conteudo`. Painel admin (`ADMIN` do tenant)
 * lê ao vivo via `ConversaDetalhe.tsx:159`.
 *
 * Contradição: o próprio schema tem `Cooperado.pinHash` (protegido) enquanto
 * o mesmo PIN vira texto legível no log de mensagens (não protegido).
 *
 * Cadeia de exploração: impersonate ativo (P0 catalogado) + PIN lido do log
 * = transacionar como qualquer cooperado com o gate do PIN satisfeito. PIN
 * deixa de ser fator.
 *
 * Fix (classificação por CONTEXTO DE ORIGEM, não regex):
 * `processarMensagem` consulta `ConversaWhatsapp.estado` ANTES de gravar; se
 * bater `ESTADOS_INBOUND_SENSIVEL`, grava sentinel `[REDACTED-SENSIVEL]` no
 * `conteudo`. Metadados intactos.
 *
 * Fonte de verdade UNIQUE: constante `ESTADOS_INBOUND_SENSIVEL` no bot
 * service. Novo estado sensível entra LÁ, não aqui.
 *
 * Regra contatos de teste (Luciano 14/05): jest unitário puro. Nenhum WA
 * real é enviado por este spec.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  WhatsappBotService,
  ESTADOS_INBOUND_SENSIVEL,
  CONTEUDO_REDACTED_INBOUND,
} from './whatsapp-bot.service';

describe('WhatsappBotService.processarMensagem — inbound sensível redigido (Achado 6)', () => {
  const TELEFONE = '5527981341348'; // whitelist dev — Luciano

  function buildSut() {
    const createInbound = jest.fn().mockResolvedValue({ id: 'msg-in' });
    const findUniqueConversa = jest.fn();

    const prismaMock = {
      mensagemWhatsapp: { create: createInbound },
      conversaWhatsapp: { findUnique: findUniqueConversa },
    } as unknown as PrismaService;

    // Instância direta — o teste foca só no método privado `gravarInbound`,
    // isolado dos ~40 handlers de estado que `processarMensagem` invoca
    // depois da gravação.
    const sut = Object.create(WhatsappBotService.prototype) as WhatsappBotService;
    (sut as any).prisma = prismaMock;
    (sut as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

    return { sut, createInbound, findUniqueConversa };
  }

  async function gravar(sut: WhatsappBotService, msg: { telefone: string; tipo: string; corpo: string }): Promise<void> {
    await (sut as any).gravarInbound(msg, msg.corpo);
  }

  it('PAR (1/2) — conversa em estado NORMAL → conteudo gravado INTEGRAL', async () => {
    const { sut, createInbound, findUniqueConversa } = buildSut();
    findUniqueConversa.mockResolvedValue({ estado: 'MENU_COOPERADO' });

    await gravar(sut, { telefone: TELEFONE, tipo: 'texto', corpo: '2' });

    expect(createInbound).toHaveBeenCalledTimes(1);
    const data = createInbound.mock.calls[0][0].data;
    expect(data.direcao).toBe('ENTRADA');
    expect(data.conteudo).toBe('2'); // integral
    expect(data.tipo).toBe('texto');
    expect(data.telefone).toBe(TELEFONE);
  });

  it('PAR (2/2) — conversa em DEFINIR_PIN_AGUARDANDO_PIN → conteudo = "[REDACTED-SENSIVEL]", metadados INTACTOS', async () => {
    const { sut, createInbound, findUniqueConversa } = buildSut();
    findUniqueConversa.mockResolvedValue({ estado: 'DEFINIR_PIN_AGUARDANDO_PIN' });

    const PIN_DIGITADO = '842197'; // o PIN NÃO pode aparecer no conteudo gravado.

    await gravar(sut, { telefone: TELEFONE, tipo: 'texto', corpo: PIN_DIGITADO });

    expect(createInbound).toHaveBeenCalledTimes(1);
    const data = createInbound.mock.calls[0][0].data;
    // Conteúdo REDIGIDO — o PIN NÃO pode aparecer.
    expect(data.conteudo).toBe(CONTEUDO_REDACTED_INBOUND);
    expect(data.conteudo).not.toContain(PIN_DIGITADO);
    // Metadados intactos: quem, quando, como.
    expect(data.direcao).toBe('ENTRADA');
    expect(data.telefone).toBe(TELEFONE);
    expect(data.tipo).toBe('texto');
    expect(data.status).toBe('RECEBIDA');
  });

  it('PAR extra — cobre TODOS os estados sensíveis (DEFINIR_PIN_AGUARDANDO_OTP, AGUARDANDO_CONFIRMACAO, ALTERAR_LIMITE_AGUARDANDO_PIN)', async () => {
    for (const estado of ESTADOS_INBOUND_SENSIVEL) {
      if (estado === 'DEFINIR_PIN_AGUARDANDO_PIN') continue; // já coberto no par (2/2)
      const { sut, createInbound, findUniqueConversa } = buildSut();
      findUniqueConversa.mockResolvedValue({ estado });

      await gravar(sut, { telefone: TELEFONE, tipo: 'texto', corpo: '123456 1234' });

      expect(createInbound).toHaveBeenCalledTimes(1);
      expect(createInbound.mock.calls[0][0].data.conteudo).toBe(CONTEUDO_REDACTED_INBOUND);
    }
  });

  it('conversa INEXISTENTE (primeira mensagem do telefone) → grava INTEGRAL (não pode ser sensível se conversa não existe)', async () => {
    const { sut, createInbound, findUniqueConversa } = buildSut();
    findUniqueConversa.mockResolvedValue(null);

    await gravar(sut, { telefone: TELEFONE, tipo: 'texto', corpo: 'oi' });

    expect(createInbound).toHaveBeenCalledTimes(1);
    expect(createInbound.mock.calls[0][0].data.conteudo).toBe('oi');
  });
});

describe('WhatsappBotService — REDE DE SEGURANÇA (varre estados) (Achado 6)', () => {
  it('nenhum estado de conversa casando /PIN|OTP|SENHA|LIMITE/i fica FORA de ESTADOS_INBOUND_SENSIVEL', () => {
    // Fonte de verdade dos ESTADOS de conversa: literais `estado: '(X)'`
    // (writes no Prisma) e `case '(X)':` DENTRO de `switch(conversa.estado)`
    // no bot.service. Excluídas AÇÕES do fluxo motor (switch da acao dinâmica)
    // por convenção de nomenclatura: começam com prefixo verbal
    // (INICIAR_/VALIDAR_/SALVAR_/CONFIRMAR_/RECEBER_/CONSULTAR_).
    //
    // LIMITAÇÃO: esta rede varre CÓDIGO-FONTE. A máquina de estados também
    // é dirigida por BANCO (`FluxoEtapa`) — estado criado como linha no banco
    // NÃO é visto pelo scan. Hoje é seguro (capturar credencial exige handler
    // no switch, que é fonte), mas se um estado dinâmico começar a receber
    // resposta sensível, a rede não vai flagrar.
    const arquivos = [
      path.join(__dirname, 'whatsapp-bot.service.ts'),
      path.join(__dirname, 'whatsapp-fluxo-motor.service.ts'),
    ];
    const literalEstado = /(?:case\s+|estado:\s*)'([A-Z][A-Z0-9_]{3,})'/g;
    const encontrados = new Set<string>();
    for (const f of arquivos) {
      const txt = fs.readFileSync(f, 'utf8');
      let m;
      while ((m = literalEstado.exec(txt))) {
        encontrados.add(m[1]);
      }
    }
    expect(encontrados.size).toBeGreaterThan(30); // sanidade — grep casou algo

    // Filtra AÇÕES do switch do fluxo motor (não são estados de conversa).
    // Convenção: nomes de ação começam com verbo imperativo.
    const PREFIXOS_ACAO = ['INICIAR_', 'VALIDAR_', 'SALVAR_', 'CONFIRMAR_', 'RECEBER_', 'CONSULTAR_'];
    const soEstados = [...encontrados].filter(
      (e) => !PREFIXOS_ACAO.some((p) => e.startsWith(p)),
    );

    const regexCredencial = /PIN|OTP|SENHA|LIMITE/i;
    const suspeitos = soEstados.filter((e) => regexCredencial.test(e));

    // Allowlist explícita: estados que casam a heurística mas NÃO precisam
    // ser redigidos (a resposta do cooperado neste estado NÃO é credencial).
    // Cada entrada precisa comentário justificando.
    const NAO_SAO_SENSIVEIS: ReadonlySet<string> = new Set([
      // ALTERAR_LIMITE_AGUARDANDO_VALOR — resposta é o VALOR do limite
      // (ex. "200"), não o PIN. Não é credencial; publicar em log não
      // compromete conta.
      'ALTERAR_LIMITE_AGUARDANDO_VALOR',
    ]);

    const foraDaLista = suspeitos.filter(
      (e) => !ESTADOS_INBOUND_SENSIVEL.has(e) && !NAO_SAO_SENSIVEIS.has(e),
    );

    // Se cair aqui: ou o estado é sensível (adicionar em
    // ESTADOS_INBOUND_SENSIVEL) ou é falso positivo (adicionar em
    // NAO_SAO_SENSIVEIS COM comentário justificando).
    expect(foraDaLista).toEqual([]);
  });
});
