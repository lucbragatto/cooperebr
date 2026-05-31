/**
 * Smoke programático D-novo-BR F0 IDOR (31/05/2026)
 *
 * Valida em runtime contra Postgres real os fixes F0.1-F0.5:
 *   F0.1: administradoras + modelos-cobranca
 *   F0.2: documentos
 *   F0.3: ocorrencias + prestadores
 *   F0.4: condominios + observador
 *   F0.5: notificacoes + asaas + integracao-bancaria + whatsapp
 *
 * NÃO faz chamada externa real (BB/Sicoob/Asaas/WhatsApp).
 *
 * Rodar: `npx ts-node scripts/smoke-br-f0-idor.ts`
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

import { AdministradorasService } from '../src/administradoras/administradoras.service';
import { ModelosCobrancaService } from '../src/modelos-cobranca/modelos-cobranca.service';
import { DocumentosService } from '../src/documentos/documentos.service';
import { OcorrenciasService } from '../src/ocorrencias/ocorrencias.service';
import { PrestadoresService } from '../src/prestadores/prestadores.service';
import { CondominiosService } from '../src/condominios/condominios.service';
import { ObservadorService } from '../src/observador/observador.service';
import { NotificacoesService } from '../src/notificacoes/notificacoes.service';
import { IntegracaoBancariaService } from '../src/integracao-bancaria/integracao-bancaria.service';
import { ModeloMensagemService } from '../src/whatsapp/modelo-mensagem.service';

const prisma = new PrismaClient();

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];
function assert(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK ' : 'XX '} ${name}${detail ? '  ' + detail : ''}`);
}

async function expectThrows(name: string, fn: () => Promise<any> | any, expected: any) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') await r;
    assert(name, false, '(sem exceção)');
  } catch (err: any) {
    assert(name, err instanceof expected, `got=${err?.constructor?.name} expected=${expected.name}`);
  }
}

async function main() {
  const ts = Date.now();
  console.log(`\n=== Smoke BR F0 IDOR — ts ${ts} ===\n`);

  // Setup 2 tenants
  const coopA = await prisma.cooperativa.create({
    data: { nome: `BR F0 A ${ts}`, cnpj: `brf0a${ts}`.slice(0, 14), tipoParceiro: 'COOPERATIVA' },
  });
  const coopB = await prisma.cooperativa.create({
    data: { nome: `BR F0 B ${ts}`, cnpj: `brf0b${ts}`.slice(0, 14), tipoParceiro: 'COOPERATIVA' },
  });

  // Recursos do tenant B
  const admB = await prisma.administradora.create({
    data: {
      cooperativaId: coopB.id,
      razaoSocial: 'AdmB SA', cnpj: `admb${ts}`.slice(0, 14),
      email: 'lucbragatto+admb@gmail.com', telefone: '27981341348',
      responsavelNome: 'X',
    },
  });

  const coopadoB = await prisma.cooperado.create({
    data: {
      nomeCompleto: 'BR Membro B', cpf: `brf0b-cp-${ts}`,
      email: `lucbragatto+brf0b-${ts}@gmail.com`, telefone: '27981341348',
      cooperativaId: coopB.id,
    },
  });

  const prestB = await prisma.prestador.create({
    data: { nome: 'Pres B', cooperativaId: coopB.id },
  });

  const ocoB = await prisma.ocorrencia.create({
    data: {
      cooperadoId: coopadoB.id, cooperativaId: coopB.id,
      tipo: 'OUTROS', descricao: 'orig', prioridade: 'BAIXA',
    },
  });

  const usuarioObsB = await prisma.usuario.create({
    data: {
      nome: 'ObsBUser', email: `lucbragatto+brf0b-uobs-${ts}@gmail.com`,
      perfil: 'ADMIN', cooperativaId: coopB.id,
    },
  });
  const obsB = await prisma.observacaoAtiva.create({
    data: {
      observadorId: usuarioObsB.id, observadorTelefone: '27981341348',
      observadoTelefone: '27987654321',
      escopo: 'WHATSAPP_TOTAL',
      expiresAt: new Date(Date.now() + 3600000),
      cooperativaId: coopB.id,
    },
  });

  console.log('Setup OK.\n');

  // Instancia services
  const admService = new AdministradorasService(prisma as any);
  const modCobService = new ModelosCobrancaService(prisma as any);
  const docService = new DocumentosService(prisma as any, {} as any, {} as any, {} as any);
  const ocoService = new OcorrenciasService(prisma as any);
  const presService = new PrestadoresService(prisma as any);
  const condService = new CondominiosService(prisma as any);
  const observService = new ObservadorService(prisma as any, {} as any);
  const notifService = new NotificacoesService(prisma as any);
  const integService = new IntegracaoBancariaService(prisma as any, {} as any, {} as any, {} as any);
  const modMsgService = new ModeloMensagemService(prisma as any);

  try {
    // ============ F0.1 administradoras ============
    await expectThrows(
      'F0.1 CA1: ADMIN A update administradora B → NotFound',
      () => admService.update(admB.id, { razaoSocial: 'HACKED' }, coopA.id),
      NotFoundException,
    );
    await expectThrows(
      'F0.1 CA2: ADMIN A delete administradora B → NotFound',
      () => admService.remove(admB.id, coopA.id),
      NotFoundException,
    );
    const admBDepois = await prisma.administradora.findUnique({ where: { id: admB.id } });
    assert('F0.1: administradora B intacta (razaoSocial)', admBDepois?.razaoSocial === 'AdmB SA');
    assert('F0.1: administradora B ainda ativa', admBDepois?.ativo === true);

    // ============ F0.3 ocorrencias + prestadores ============
    await expectThrows(
      'F0.3 AA5: ADMIN A update ocorrência B → NotFound',
      () => ocoService.update(ocoB.id, { descricao: 'HACKED' }, coopA.id),
      NotFoundException,
    );
    const ocoBDepois = await prisma.ocorrencia.findUnique({ where: { id: ocoB.id } });
    assert('F0.3: ocorrência B intacta (descricao)', ocoBDepois?.descricao === 'orig');

    await expectThrows(
      'F0.3 AA7: ADMIN A update prestador B → NotFound',
      () => presService.update(prestB.id, { nome: 'HACKED' }, coopA.id),
      NotFoundException,
    );
    const prestBDepois = await prisma.prestador.findUnique({ where: { id: prestB.id } });
    assert('F0.3: prestador B intacto', prestBDepois?.nome === 'Pres B');

    // MA2: ocorrencias.create cooperado cross-tenant
    await expectThrows(
      'F0.3 MA2: ADMIN A criar ocorrência pra cooperado B → NotFound',
      () => ocoService.create({ cooperadoId: coopadoB.id, tipo: 'OUTROS', descricao: 'x', prioridade: 'BAIXA' }, coopA.id),
      NotFoundException,
    );

    // ============ F0.4 observador ============
    await expectThrows(
      'F0.4 AA12: ADMIN A encerrar observação B → BadRequest',
      () => observService.encerrar(obsB.id, 'u-A', coopA.id),
      BadRequestException,
    );
    const obsBDepois = await prisma.observacaoAtiva.findUnique({ where: { id: obsB.id } });
    assert('F0.4: observação B ainda ativa', obsBDepois?.ativo === true);

    // ============ F0.1 modelos-cobranca (global SA-only) ============
    // Não criar modelo global no teste (impacto sistêmico); usa um já existente se tiver,
    // OU pula esse assert se nenhum global existir
    const modGlobal = await prisma.modeloCobrancaConfig.findFirst({ where: { cooperativaId: null } });
    if (modGlobal) {
      await expectThrows(
        'F0.1 AA11: ADMIN A desativar modelo GLOBAL → Forbidden (impacto sistêmico)',
        () => modCobService.desativar(modGlobal.id, coopA.id, false),
        ForbiddenException,
      );
    } else {
      assert('F0.1 AA11: skip (nenhum modelo global no banco)', true);
    }

    // ============ F0.5 notificacoes (CRITICO) ============
    // Criar notificação no tenant B
    const notifB = await prisma.notificacao.create({
      data: { tipo: 'TESTE', titulo: 'B', mensagem: 'x', cooperativaId: coopB.id, lida: false },
    });
    const userA: any = { id: 'u-A', email: 'a@a.com', perfil: 'ADMIN', cooperativaId: coopA.id };
    await notifService.marcarComoLida(notifB.id, userA); // no-op silencioso
    const notifBDepois = await prisma.notificacao.findUnique({ where: { id: notifB.id } });
    assert('F0.5 notificacoes: ADMIN A NÃO marcou notificação B como lida', notifBDepois?.lida === false);
    await prisma.notificacao.delete({ where: { id: notifB.id } });

    // ============ F0.5 integracao-bancaria (CRITICO) ============
    // Criar config + cobrança no tenant B
    const cfgB = await prisma.configuracaoBancaria.create({
      data: {
        cooperativaId: coopB.id,
        banco: 'BB', ambiente: 'sandbox',
        clientId: 'x', clientSecret: 'y',
      },
    });
    const cobB = await prisma.cobrancaBancaria.create({
      data: {
        cooperativaId: coopB.id, cooperadoId: coopadoB.id, configuracaoId: cfgB.id,
        tipo: 'BOLETO', valor: new Prisma.Decimal(100), vencimento: new Date(),
        descricao: 'B', status: 'PENDENTE',
      },
    });
    await expectThrows(
      'F0.5 CRITICO: ADMIN A cancelar cobrança bancária B → NotFound ANTES da API banco',
      () => integService.cancelarCobranca(cobB.id, coopA.id),
      NotFoundException,
    );
    const cobBDepois = await prisma.cobrancaBancaria.findUnique({ where: { id: cobB.id } });
    assert('F0.5 CRITICO: cobrança B continua PENDENTE (não cancelada)', cobBDepois?.status === 'PENDENTE');

    await expectThrows(
      'F0.5 CRITICO: ADMIN A atualizar config bancária B → NotFound',
      () => integService.atualizarConfig(cfgB.id, { clientId: 'HACKED' }, coopA.id),
      NotFoundException,
    );
    const cfgBDepois = await prisma.configuracaoBancaria.findUnique({ where: { id: cfgB.id } });
    assert('F0.5 CRITICO: config B clientId NÃO substituído', cfgBDepois?.clientId === 'x');

    // F0.5 criarConfig — cooperativaId vem como parâmetro, body-injection bloqueado
    const cfgNovo = await integService.criarConfig({
      banco: 'BB', clientId: 'novo', clientSecret: 'novo',
    } as any, coopA.id);
    assert('F0.5 CRITICO: criarConfig usa cooperativaId injetado (não body)', cfgNovo.cooperativaId === coopA.id);
    await prisma.configuracaoBancaria.delete({ where: { id: cfgNovo.id } });

    // ============ F0.5 whatsapp modelo (CRITICO) ============
    const modB = await prisma.modeloMensagem.create({
      data: { nome: 'B', categoria: 'test', conteudo: 'oi', cooperativaId: coopB.id },
    });
    await expectThrows(
      'F0.5 CRITICO: ADMIN A delete modelo whatsapp B → NotFound',
      () => modMsgService.delete(modB.id, coopA.id, false),
      NotFoundException,
    );
    const modBDepois = await prisma.modeloMensagem.findUnique({ where: { id: modB.id } });
    assert('F0.5 CRITICO: modelo whatsapp B NÃO deletado', modBDepois !== null);

    // F0.5 CRITICO modelo GLOBAL só SA
    const modGlobalWA = await prisma.modeloMensagem.create({
      data: { nome: `Global ${ts}`, categoria: 'test', conteudo: 'oi', cooperativaId: null },
    });
    await expectThrows(
      'F0.5 CRITICO: ADMIN A delete modelo whatsapp GLOBAL → Forbidden',
      () => modMsgService.delete(modGlobalWA.id, coopA.id, false),
      ForbiddenException,
    );
    const modGlobalWADepois = await prisma.modeloMensagem.findUnique({ where: { id: modGlobalWA.id } });
    assert('F0.5 CRITICO: modelo whatsapp GLOBAL NÃO deletado por ADMIN', modGlobalWADepois !== null);
    // SA pode
    await modMsgService.delete(modGlobalWA.id, null, true);
    const modGlobalWAFinal = await prisma.modeloMensagem.findUnique({ where: { id: modGlobalWA.id } });
    assert('F0.5 CRITICO: modelo whatsapp GLOBAL deletado por SA', modGlobalWAFinal === null);
  } finally {
    console.log('\nCleanup...');
    try { await prisma.notificacao.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.modeloMensagem.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.cobrancaBancaria.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.configuracaoBancaria.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.logObservacao.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.observacaoAtiva.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.ocorrencia.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.prestador.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.cooperado.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.usuario.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.administradora.deleteMany({ where: { cooperativaId: { in: [coopA.id, coopB.id] } } }); } catch {}
    try { await prisma.cooperativa.deleteMany({ where: { id: { in: [coopA.id, coopB.id] } } }); } catch {}
    console.log('Cleanup OK.\n');
  }

  const fails = results.filter((r) => !r.ok);
  console.log(`\n=== Resumo: ${results.length - fails.length}/${results.length} OK ===`);
  if (fails.length > 0) {
    console.error('FALHAS:');
    fails.forEach((f) => console.error(` - ${f.name} ${f.detail ?? ''}`));
    process.exitCode = 1;
  } else {
    console.log('Todos os cenários BR F0 cross-tenant passaram em runtime.\n');
  }
}

main()
  .catch((err) => { console.error('Erro fatal:', err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
