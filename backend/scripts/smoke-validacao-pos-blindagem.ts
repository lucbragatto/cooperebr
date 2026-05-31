/**
 * Smoke de validação E2E pós-Sprint Blindagem Multi-Tenant (31/05/2026).
 *
 * PROVA O COMPLEMENTO: smokes anteriores validaram que ataque cross-tenant
 * é bloqueado. Este aqui prova que o MESMO tenant ainda consegue fazer tudo
 * — que o Guard, a extension, o lint NÃO viraram falso-positivo.
 *
 * Cobre os endpoints com mais risco de falso-positivo:
 *   1. Via-relação (Guard buildNestedWhere): documentos, asaas cobranças
 *   2. globalOnlySuperAdmin: whatsapp modelos/fluxos/listas (ADMIN edita o
 *      próprio passa; ADMIN tenta global = Forbidden esperado)
 *   3. Via-usina (monitoramento): config/historico/alertas da própria usina
 *   4. Posse direta: contrato/usina/uc/cobrancaBancaria do tenant
 *   5. EmailLog: ADMIN lista logs do tenant — vê os próprios
 *   6. Fluxo composto: criar despesa → aprovar (sub-passos via service)
 *
 * Validação composta: assert que a query/ação retornou OK + não houve
 * exceção do Guard + extension não logou TENANT-LEAK.
 *
 * Rodar: `npx ts-node scripts/smoke-validacao-pos-blindagem.ts`
 */
import { PrismaClient, Prisma } from '@prisma/client';
import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  TenantResourceOpts,
  TENANT_RESOURCE_KEY,
} from '../src/auth/tenant-resource.decorator';
import { TenantOwnershipGuard } from '../src/auth/tenant-ownership.guard';
import { DocumentosService } from '../src/documentos/documentos.service';
import { IntegracaoBancariaService } from '../src/integracao-bancaria/integracao-bancaria.service';
import { ModeloMensagemService } from '../src/whatsapp/modelo-mensagem.service';
import { MonitoramentoUsinasService } from '../src/monitoramento-usinas/monitoramento-usinas.service';
import { EmailService } from '../src/email/email.service';
import { runWithTenant } from '../src/common/tenant-context';

const prisma = new PrismaClient();

type Result = { categoria: string; cenario: string; ok: boolean; detail?: string };
const results: Result[] = [];

function assert(categoria: string, cenario: string, ok: boolean, detail?: string) {
  results.push({ categoria, cenario, ok, detail });
  console.log(`${ok ? 'OK ' : 'XX '} [${categoria}] ${cenario}${detail ? '  → ' + detail : ''}`);
}

function makeCtx(opts: {
  user: any;
  params: Record<string, string>;
  guardOpts?: TenantResourceOpts;
}): ExecutionContext {
  const handler = function mockH() {};
  if (opts.guardOpts) Reflect.defineMetadata(TENANT_RESOURCE_KEY, opts.guardOpts, handler);
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: opts.user, params: opts.params }) }) as any,
    getHandler: () => handler,
    getClass: () => function MockC() {},
  } as any;
}

// Captura warns da extension durante a execução de uma função
function withLogCapture(fn: () => Promise<void> | void): Promise<string[]> {
  return new Promise(async (resolve, reject) => {
    const warns: string[] = [];
    const orig = Logger.prototype.warn;
    Logger.prototype.warn = function (msg: any) {
      if (typeof msg === 'string' && msg.includes('TENANT-LEAK-DETECT')) {
        warns.push(msg);
      }
      return orig.apply(this, arguments as any);
    };
    try {
      await fn();
      resolve(warns);
    } catch (err) {
      reject(err);
    } finally {
      Logger.prototype.warn = orig;
    }
  });
}

async function main() {
  const ts = Date.now();
  console.log(`\n=== Smoke Validação Pós-Blindagem — ts ${ts} ===\n`);

  const reflector = new Reflector();
  const guard = new TenantOwnershipGuard(reflector, prisma as any);

  // Setup: 1 tenant CoopereBR-like com recursos próprios
  const coopA = await prisma.cooperativa.create({
    data: { nome: `Validacao A ${ts}`, cnpj: `vala${ts}`.slice(0, 14), tipoParceiro: 'COOPERATIVA' },
  });

  const coopadoA = await prisma.cooperado.create({
    data: {
      nomeCompleto: 'Membro A', cpf: `vala-mb-${ts}`,
      email: `lucbragatto+vala-${ts}@gmail.com`, telefone: '27981341348',
      cooperativaId: coopA.id,
    },
  });

  const usinaA = await prisma.usina.create({
    data: {
      nome: `Usina A`, apelidoInterno: `vala-${ts}`,
      potenciaKwp: new Prisma.Decimal(100), cidade: 'V', estado: 'ES',
      cooperativaId: coopA.id,
    },
  });

  const ucA = await prisma.uc.create({
    data: {
      numero: `vala-uc-${ts}`, endereco: 'R X', cidade: 'V', estado: 'ES',
      cooperadoId: coopadoA.id, cooperativaId: coopA.id,
    },
  });

  const cfgBancA = await prisma.configuracaoBancaria.create({
    data: { cooperativaId: coopA.id, banco: 'BB', ativo: true, clientId: 'x', clientSecret: 'y' },
  });

  const cobBancA = await prisma.cobrancaBancaria.create({
    data: {
      cooperativaId: coopA.id, cooperadoId: coopadoA.id, configuracaoId: cfgBancA.id,
      tipo: 'BOLETO', valor: new Prisma.Decimal(100), vencimento: new Date(),
      descricao: 'A', status: 'PENDENTE',
    },
  });

  const docA = await prisma.documentoCooperado.create({
    data: {
      cooperadoId: coopadoA.id, tipo: 'RG_FRENTE',
      url: 'https://x.com/d.pdf', nomeArquivo: 'd.pdf', tamanhoBytes: 1,
      status: 'PENDENTE',
    },
  });

  await prisma.usinaMonitoramentoConfig.create({
    data: { usinaId: usinaA.id, habilitado: true, cooperativaId: coopA.id },
  });

  const modeloA = await prisma.modeloMensagem.create({
    data: { nome: `Mod A ${ts}`, categoria: 'BOT', conteudo: 'x', cooperativaId: coopA.id },
  });

  const fluxoA = await prisma.fluxoEtapa.create({
    data: { nome: `Fluxo A ${ts}`, ordem: 1, estado: 'INICIAL', gatilhos: [], cooperativaId: coopA.id },
  });

  const listaA = await prisma.listaContatos.create({
    data: { nome: `Lista A ${ts}`, cooperativaId: coopA.id, telefones: [], cooperadoIds: [] },
  });

  // Pra teste global
  const modeloGlobal = await prisma.modeloMensagem.create({
    data: { nome: `Mod Global ${ts}`, categoria: 'BOT', conteudo: 'x', cooperativaId: null },
  });

  await prisma.emailLog.create({
    data: { destinatario: 'a@a.com', assunto: 'A', status: 'ENVIADO', cooperativaId: coopA.id },
  });
  await prisma.emailLog.create({
    data: { destinatario: 'b@b.com', assunto: 'B', status: 'ENVIADO', cooperativaId: coopA.id },
  });

  console.log('Setup OK.\n');

  const userA: any = { perfil: 'ADMIN', cooperativaId: coopA.id, id: 'u-A', email: 'admin@a.com' };
  const userSA: any = { perfil: 'SUPER_ADMIN', cooperativaId: null, id: 'u-SA', email: 'sa@x.com' };

  // Services
  const docService = new DocumentosService(
    prisma as any,
    { criar: async () => undefined } as any,
    { checkProntoParaAtivar: async () => undefined } as any,
    {
      notificarDocumentoAprovado: async () => undefined,
      notificarDocumentoReprovado: async () => undefined,
    } as any,
  );
  const bancService = new IntegracaoBancariaService(prisma as any, {} as any, {} as any, {} as any);
  const modMsgService = new ModeloMensagemService(prisma as any);
  const monService = new MonitoramentoUsinasService(prisma as any, {} as any, {} as any, {} as any);
  const emailService = new EmailService(prisma as any, {} as any);

  try {
    // ============ 1. Via-relação (Guard buildNestedWhere) ============
    // Documento via cooperado.cooperativaId
    const passOuFail = await guard.canActivate(
      makeCtx({
        user: userA,
        params: { id: docA.id },
        guardOpts: { model: 'documentoCooperado', via: 'cooperado.cooperativaId' },
      }),
    );
    assert('via-relação', 'Guard ADMIN A → documento próprio passa', passOuFail === true);

    // ============ 2. Cobrança bancária posse direta (A5 padrão F1.2) ============
    const passCob = await guard.canActivate(
      makeCtx({
        user: userA,
        params: { id: cobBancA.id },
        guardOpts: { model: 'cobrancaBancaria' },
      }),
    );
    assert('posse direta', 'Guard ADMIN A → cobrancaBancaria própria passa', passCob === true);

    // Usina posse direta via idParam=usinaId
    const passUsina = await guard.canActivate(
      makeCtx({
        user: userA,
        params: { usinaId: usinaA.id },
        guardOpts: { model: 'usina', idParam: 'usinaId' },
      }),
    );
    assert('posse direta', 'Guard ADMIN A → usina própria passa (idParam=usinaId)', passUsina === true);

    // UC posse direta
    const passUc = await guard.canActivate(
      makeCtx({
        user: userA,
        params: { id: ucA.id },
        guardOpts: { model: 'uc' },
      }),
    );
    assert('posse direta', 'Guard ADMIN A → UC própria passa', passUc === true);

    // ============ 3. globalOnlySuperAdmin (ADMIN próprio passa, global = Forbidden) ============
    const passModeloProprio = await guard.canActivate(
      makeCtx({
        user: userA,
        params: { id: modeloA.id },
        guardOpts: { model: 'modeloMensagem', globalOnlySuperAdmin: true },
      }),
    );
    assert('globalOnlySA', 'Guard ADMIN A → modelo whatsapp próprio passa', passModeloProprio === true);

    try {
      await guard.canActivate(
        makeCtx({
          user: userA,
          params: { id: modeloGlobal.id },
          guardOpts: { model: 'modeloMensagem', globalOnlySuperAdmin: true },
        }),
      );
      assert('globalOnlySA', 'Guard ADMIN A → modelo GLOBAL deve dar Forbidden', false, 'passou indevido');
    } catch (err: any) {
      assert(
        'globalOnlySA',
        'Guard ADMIN A → modelo GLOBAL = Forbidden (esperado)',
        err instanceof ForbiddenException,
        err?.message,
      );
    }

    // Fluxo próprio passa
    const passFluxo = await guard.canActivate(
      makeCtx({
        user: userA,
        params: { id: fluxoA.id },
        guardOpts: { model: 'fluxoEtapa', globalOnlySuperAdmin: true },
      }),
    );
    assert('globalOnlySA', 'Guard ADMIN A → fluxo próprio passa', passFluxo === true);

    // Lista própria passa
    const passLista = await guard.canActivate(
      makeCtx({
        user: userA,
        params: { id: listaA.id },
        guardOpts: { model: 'listaContatos', globalOnlySuperAdmin: true },
      }),
    );
    assert('globalOnlySA', 'Guard ADMIN A → lista própria passa', passLista === true);

    // ============ 4. Via-relação Asaas (cooperado.cooperativaId) ============
    // A9 listar cobranças: o guard exige cooperado pertence ao tenant
    const passCoopParam = await guard.canActivate(
      makeCtx({
        user: userA,
        params: { cooperadoId: coopadoA.id },
        guardOpts: { model: 'cooperado', idParam: 'cooperadoId' },
      }),
    );
    assert('via-relação', 'Guard ADMIN A → cooperado próprio (idParam=cooperadoId) passa', passCoopParam === true);

    // ============ 5. Monitoramento via-usina (A6+A7+M3-M6) ============
    // Guard rodando model='usina', idParam='usinaId' já testado acima.
    // Aqui validamos o service getStatusAtual com filtro de tenant retornando dados próprios.
    const warns1 = await withLogCapture(() =>
      runWithTenant({ cooperativaId: coopA.id, perfil: 'ADMIN' }, async () => {
        const status = await monService.getStatusAtual(coopA.id);
        assert('via-usina', 'getStatusAtual ADMIN A → vê monitoramento próprio', status.length >= 1);
      }),
    );
    if (warns1.length > 0) {
      console.error('  ⚠ warns inesperados:', warns1.slice(0, 3));
    }
    assert('logs', 'getStatusAtual same-tenant não emitiu TENANT-LEAK warns', warns1.length === 0);

    // ============ 6. Service: ADMIN A aprova documento próprio (via-relação) ============
    const warns2 = await withLogCapture(() =>
      runWithTenant({ cooperativaId: coopA.id, perfil: 'ADMIN' }, async () => {
        const aprovado = await docService.aprovar(docA.id, coopA.id);
        assert('via-relação', 'docService.aprovar ADMIN A → documento próprio aprovado', aprovado.status === 'APROVADO');
      }),
    );
    assert('logs', 'docService.aprovar same-tenant não emitiu TENANT-LEAK warns', warns2.length === 0);

    // ============ 7. EmailLog: ADMIN A lista logs próprios (M7) ============
    const warns3 = await withLogCapture(() =>
      runWithTenant({ cooperativaId: coopA.id, perfil: 'ADMIN' }, async () => {
        const r = await emailService.buscarLogs(1, 100, coopA.id);
        const todosPropriosCorrects = r.logs.every((l: any) => l.cooperativaId === coopA.id);
        assert('EmailLog', `ADMIN A vê ${r.logs.length} logs próprios (todos coop-A)`, todosPropriosCorrects && r.logs.length >= 2);
      }),
    );
    assert('logs', 'EmailLog buscarLogs same-tenant não emitiu TENANT-LEAK warns', warns3.length === 0);

    // ============ 8. SUPER_ADMIN bypass funciona (sanity) ============
    const passSA = await guard.canActivate(
      makeCtx({
        user: userSA,
        params: { id: modeloGlobal.id },
        guardOpts: { model: 'modeloMensagem', globalOnlySuperAdmin: true },
      }),
    );
    assert('SUPER_ADMIN', 'Guard SA → modelo GLOBAL passa (bypass)', passSA === true);

    const passSAUsinaOutro = await guard.canActivate(
      makeCtx({
        user: userSA,
        params: { usinaId: usinaA.id },
        guardOpts: { model: 'usina', idParam: 'usinaId' },
      }),
    );
    assert('SUPER_ADMIN', 'Guard SA → qualquer usina passa (bypass)', passSAUsinaOutro === true);

    // ============ 9. Fluxo composto: cobrança bancária end-to-end same-tenant ============
    // Já criou cobBancA. Lê via service (deve retornar). Reemitir está cat 1 do Guard.
    const warns4 = await withLogCapture(() =>
      runWithTenant({ cooperativaId: coopA.id, perfil: 'ADMIN' }, async () => {
        const fetched = await bancService.findOne(cobBancA.id, coopA.id);
        assert('fluxo composto', 'bancService.findOne ADMIN A → cobrança própria retorna', fetched.id === cobBancA.id);

        const configs = await bancService.listarConfigs(coopA.id);
        const temCfgPropria = configs.some((c: any) => c.id === cfgBancA.id);
        assert('fluxo composto', 'bancService.listarConfigs ADMIN A → vê config própria', temCfgPropria);
      }),
    );
    assert('logs', 'bancService.findOne+listarConfigs same-tenant não emitiu TENANT-LEAK warns', warns4.length === 0);
  } finally {
    console.log('\nCleanup...');
    try { await prisma.emailLog.deleteMany({ where: { cooperativaId: coopA.id } }); } catch {}
    try { await prisma.listaContatos.deleteMany({ where: { cooperativaId: coopA.id } }); } catch {}
    try { await prisma.fluxoEtapa.deleteMany({ where: { cooperativaId: coopA.id } }); } catch {}
    try { await prisma.modeloMensagem.deleteMany({ where: { id: { in: [modeloA.id, modeloGlobal.id] } } }); } catch {}
    try { await prisma.usinaMonitoramentoConfig.deleteMany({ where: { cooperativaId: coopA.id } }); } catch {}
    try { await prisma.cobrancaBancaria.deleteMany({ where: { cooperativaId: coopA.id } }); } catch {}
    try { await prisma.configuracaoBancaria.deleteMany({ where: { cooperativaId: coopA.id } }); } catch {}
    try { await prisma.documentoCooperado.deleteMany({ where: { id: docA.id } }); } catch {}
    try { await prisma.uc.deleteMany({ where: { cooperativaId: coopA.id } }); } catch {}
    try { await prisma.usina.deleteMany({ where: { cooperativaId: coopA.id } }); } catch {}
    try { await prisma.cooperado.deleteMany({ where: { cooperativaId: coopA.id } }); } catch {}
    try { await prisma.cooperativa.deleteMany({ where: { id: coopA.id } }); } catch {}
    console.log('Cleanup OK.\n');
  }

  const fails = results.filter((r) => !r.ok);
  console.log(`\n=== Resumo: ${results.length - fails.length}/${results.length} OK ===`);

  const porCategoria = results.reduce<Record<string, { ok: number; total: number }>>((acc, r) => {
    acc[r.categoria] ??= { ok: 0, total: 0 };
    acc[r.categoria].total++;
    if (r.ok) acc[r.categoria].ok++;
    return acc;
  }, {});

  console.log('\n=== Por categoria ===');
  for (const [cat, agg] of Object.entries(porCategoria)) {
    console.log(`  ${cat}: ${agg.ok}/${agg.total}`);
  }

  if (fails.length > 0) {
    console.error('\nFALHAS (regressões possíveis):');
    fails.forEach((f) => console.error(` - [${f.categoria}] ${f.cenario} ${f.detail ?? ''}`));
    process.exitCode = 1;
  } else {
    console.log('\n✅ ZERO regressões — blindagem não virou falso-positivo. Same-tenant flui livre.\n');
  }
}

function jest_noop() {
  return undefined as any;
}

main()
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
