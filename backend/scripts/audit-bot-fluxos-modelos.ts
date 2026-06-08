/**
 * Auditoria completa bot WA (TAREFA 1.b) — mensagens, fluxos, gaps.
 *
 * Detecta:
 * - FluxoEtapa órfãs (gatilho aponta pra estado inexistente)
 * - Gatilhos sem ação E sem proximoEstado
 * - Modelos sem etapa
 * - Etapas sem modelo (e sem acaoAutomatica)
 * - Nomenclatura: confusão CooperTokens × créditos kWh
 * - Navegação universal: estados sem voltar/menu/sair
 * - Acões referenciadas em gatilhos que NÃO existem no switch executarAcao
 * - Conflitos tenant>global
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
const prisma = new PrismaClient();

interface GatilhoT {
  resposta: string;
  proximoEstado: string;
  acao?: string;
}

// Lista canônica de ações implementadas no executarAcao do
// WhatsappFluxoMotorService (motor:485-650+). Atualizar quando novas
// ações forem adicionadas.
const ACOES_IMPLEMENTADAS = new Set([
  'CRIAR_LEAD',
  'GERAR_PROPOSTA',
  'NOTIFICAR_EQUIPE',
  'ENVIAR_LINK_INDICACAO',
  'GERAR_LINK_INDICACAO',
  'CONSULTAR_SALDO_CREDITOS',
  'CONSULTAR_PROXIMA_FATURA',
  'CONSULTAR_SALDO_TOKENS',
  'CONSULTAR_EXTRATO_TOKENS',
  'EXTRATO_TOKENS_PAGINAR',
  'CONSULTAR_LIMITE_TOKENS',
  'VALIDAR_PIN_ALTERAR_LIMITE',
  'SALVAR_NOVO_LIMITE_TOKEN',
  'ATUALIZAR_NOME_COOPERADO',
  'ATUALIZAR_EMAIL_COOPERADO',
  'ATUALIZAR_CEP_COOPERADO',
  'REGISTRAR_NPS',
  'SALVAR_PROXY_NOME',
  'SALVAR_PROXY_TELEFONE',
  'PROCESSAR_OCR_PROXY',
  'CRIAR_COOPERADO_PROXY',
  'INICIAR_SOLICITACAO_AUMENTAR_KWH',
  'INICIAR_SOLICITACAO_DIMINUIR_KWH',
  'SALVAR_SOLICITACAO_KWH',
  'INICIAR_SOLICITACAO_SUSPENDER',
  'SALVAR_SOLICITACAO_SUSPENDER',
  'INICIAR_SOLICITACAO_ENCERRAR',
  'SALVAR_SOLICITACAO_ENCERRAR',
  'VER_FATURA_ATUAL',
  'VER_HISTORICO_PAGAMENTOS',
  'SOLICITAR_CONFIRMACAO_PAGAMENTO',
  'SALVAR_CONFIRMACAO_PAGAMENTO',
  'SOLICITAR_NEGOCIACAO_HUMANA',
]);

// Estados terminais aceitos (não exigem gatilhos)
const ESTADOS_TERMINAIS = new Set([
  'CONCLUIDO',
  'ENCERRADO',
  'AGENDADO_RETORNO',
  'AGUARDANDO_ATENDENTE',
]);

async function main() {
  console.log('\n═══ AUDITORIA BOT WA — MODELOS + FLUXOS ═══\n');

  // ── 1. Carrega tudo
  const etapas = await prisma.fluxoEtapa.findMany({
    select: {
      id: true, nome: true, estado: true, cooperativaId: true, ordem: true,
      acaoAutomatica: true, modeloMensagemId: true, gatilhos: true, ativo: true,
    },
  });
  const modelos = await prisma.modeloMensagem.findMany({
    select: { id: true, nome: true, cooperativaId: true, conteudo: true, categoria: true },
  });
  console.log(`Etapas ativas: ${etapas.filter(e => e.ativo).length}/${etapas.length}`);
  console.log(`Modelos: ${modelos.length}\n`);

  // ── 2. Estados existentes (por escopo: global + por tenant)
  const estadosGlobais = new Set(etapas.filter(e => !e.cooperativaId && e.ativo).map(e => e.estado));
  const estadosPorTenant = new Map<string, Set<string>>();
  for (const e of etapas) {
    if (e.cooperativaId && e.ativo) {
      if (!estadosPorTenant.has(e.cooperativaId)) estadosPorTenant.set(e.cooperativaId, new Set());
      estadosPorTenant.get(e.cooperativaId)!.add(e.estado);
    }
  }

  // Estados hardcoded conhecidos do WhatsappBotService.handle*
  const ESTADOS_HARDCODED = new Set([
    'INICIAL', 'MENU_PRINCIPAL', 'MENU_COOPERADO', 'MENU_CLIENTE', 'MENU_CONVITE',
    'MENU_FATURA', 'MENU_SEM_FATURA', 'MENU_QR_PROPAGANDA', 'MENU_CONVIDAR_AMIGO',
    'MENU_CONVITE_INDICACAO', 'CONCLUIDO', 'PRIMEIRO_ATENDIMENTO_AI',
    'AGUARDANDO_CONFIRMACAO_DADOS', 'AGUARDANDO_CONFIRMACAO_PROPOSTA',
    'AGUARDANDO_CONFIRMACAO_CADASTRO', 'AGUARDANDO_FOTO_FATURA',
    'AGUARDANDO_COMPROVANTE_PAGAMENTO', 'AGUARDANDO_DISPOSITIVO_EMAIL',
    'AGUARDANDO_DISTRIBUIDORA', 'AGUARDANDO_VALOR_FATURA',
    'RESULTADO_SIMULACAO_RAPIDA', 'NEGOCIACAO_PARCELAMENTO',
    'CADASTRO_EXPRESS_NOME', 'CADASTRO_EXPRESS_CPF', 'CADASTRO_EXPRESS_EMAIL',
    'CADASTRO_EXPRESS_VALOR_FATURA', 'LEAD_FORA_AREA',
    'ATUALIZACAO_CADASTRO', 'AGUARDANDO_NOVO_NOME', 'AGUARDANDO_NOVO_EMAIL',
    'AGUARDANDO_NOVO_CEP', 'ATUALIZACAO_CONTRATO', 'AGUARDANDO_NOVO_KWH',
    'CONFIRMAR_ENCERRAMENTO', 'CADASTRO_PROXY_NOME', 'CADASTRO_PROXY_TELEFONE',
    'AGUARDANDO_FATURA_PROXY', 'CONFIRMAR_PROXY', 'NPS_AGUARDANDO_NOTA',
    'AGUARDANDO_ATENDENTE', 'AGUARDANDO_NOME', 'AGUARDANDO_CPF',
    'AGUARDANDO_EMAIL', 'AGUARDANDO_NOME_TERCEIRO', 'AGUARDANDO_TELEFONE_TERCEIRO',
    'AGUARDANDO_PROPRIETARIO_FATURA', 'AGUARDANDO_CONFIRMACAO_OCR',
    'AGUARDANDO_CONFIRMACAO_CELULAR', 'AGUARDANDO_CELULAR_CORRETO',
    'AGUARDANDO_INDICACAO', 'RECEBENDO_CONTATOS',
    'ENCERRADO', 'AGENDADO_RETORNO',
  ]);

  // ── 3. Audit gatilhos quebrados
  console.log('── (A) Gatilhos órfãos (apontam pra estado inexistente) ──');
  const orfaos: string[] = [];
  for (const e of etapas) {
    if (!e.ativo) continue;
    const gatilhos = (Array.isArray(e.gatilhos) ? e.gatilhos : []) as unknown as GatilhoT[];
    for (const g of gatilhos) {
      const escopo = e.cooperativaId ?? 'global';
      const estadosVisiveis = e.cooperativaId
        ? new Set([...estadosGlobais, ...(estadosPorTenant.get(e.cooperativaId) ?? [])])
        : estadosGlobais;
      if (!ESTADOS_HARDCODED.has(g.proximoEstado) &&
          !estadosVisiveis.has(g.proximoEstado) &&
          !ESTADOS_TERMINAIS.has(g.proximoEstado)) {
        orfaos.push(`[${escopo}] ${e.estado}.gatilho="${g.resposta}" → ${g.proximoEstado} (INEXISTENTE)`);
      }
    }
  }
  if (orfaos.length === 0) console.log('  ✅ Nenhum gatilho órfão.');
  else orfaos.forEach(l => console.log('  ⚠️  ' + l));

  // ── 4. Ações referenciadas vs implementadas
  console.log('\n── (B) Ações em gatilhos NÃO implementadas no motor ──');
  const acoesNaoImpl: string[] = [];
  for (const e of etapas) {
    if (!e.ativo) continue;
    if (e.acaoAutomatica && !ACOES_IMPLEMENTADAS.has(e.acaoAutomatica)) {
      acoesNaoImpl.push(`[${e.cooperativaId ?? 'global'}] ${e.estado}.acaoAutomatica="${e.acaoAutomatica}" NÃO implementada`);
    }
    const gatilhos = (Array.isArray(e.gatilhos) ? e.gatilhos : []) as unknown as GatilhoT[];
    for (const g of gatilhos) {
      if (g.acao && !ACOES_IMPLEMENTADAS.has(g.acao)) {
        acoesNaoImpl.push(`[${e.cooperativaId ?? 'global'}] ${e.estado}.gatilho="${g.resposta}".acao="${g.acao}" NÃO implementada`);
      }
    }
  }
  if (acoesNaoImpl.length === 0) console.log('  ✅ Todas as ações referenciadas têm impl.');
  else acoesNaoImpl.forEach(l => console.log('  ⚠️  ' + l));

  // ── 5. Modelos sem etapa associada
  console.log('\n── (C) Modelos órfãos (nenhuma etapa usa) ──');
  const modelosUsados = new Set(etapas.filter(e => e.modeloMensagemId).map(e => e.modeloMensagemId!));
  const orfaosM = modelos.filter(m => !modelosUsados.has(m.id) && m.categoria === 'BOT');
  if (orfaosM.length === 0) console.log('  ✅ Nenhum modelo BOT órfão.');
  else orfaosM.forEach(m => console.log(`  ℹ️  ${m.nome} (id=${m.id}, tenant=${m.cooperativaId ?? 'global'}) — sem etapa, talvez usado em código`));

  // ── 6. Etapas sem renderizar (sem modelo E sem ação)
  console.log('\n── (D) Etapas sem modelo + sem ação (silenciosas) ──');
  const silenciosas: string[] = [];
  for (const e of etapas) {
    if (!e.ativo) continue;
    if (ESTADOS_TERMINAIS.has(e.estado)) continue;
    if (!e.modeloMensagemId && !e.acaoAutomatica) {
      const gatilhos = (Array.isArray(e.gatilhos) ? e.gatilhos : []) as unknown as GatilhoT[];
      // Etapas wildcard-only (todas com .acao) OK — handler envia mensagem
      const todasComAcao = gatilhos.length > 0 && gatilhos.every(g => g.acao);
      if (!todasComAcao) {
        silenciosas.push(`[${e.cooperativaId ?? 'global'}] ${e.estado} — não envia mensagem nem executa ação`);
      }
    }
  }
  if (silenciosas.length === 0) console.log('  ✅ Nenhuma etapa silenciosa.');
  else silenciosas.forEach(l => console.log('  ⚠️  ' + l));

  // ── 7. Nomenclatura — buscar "crédito" + "kWh" + "CooperToken" em modelos
  console.log('\n── (E) Confusão CooperTokens × créditos kWh em modelos ──');
  const confusos: string[] = [];
  for (const m of modelos) {
    const c = m.conteudo;
    const temToken = /coopertoken/i.test(c);
    const temKwh = /kwh|crédit/i.test(c);
    if (temToken && temKwh && !c.includes('NÃO confunda')) {
      confusos.push(`  ℹ️ Modelo "${m.nome}" (tenant=${m.cooperativaId ?? 'global'}) cita ambos sem disclaimer`);
    }
  }
  if (confusos.length === 0) console.log('  ✅ Nada confuso detectado.');
  else confusos.forEach(l => console.log(l));

  // ── 8. Navegação universal: comandos INÍCIO/SAIR/MENU/voltar tratados na precedência
  console.log('\n── (F) Comandos universais (precedência hardcoded no motor) ──');
  console.log('  ℹ️  INÍCIO/SAIR/MENU/CHAMAR_DEPOIS funcionam por detectarComandoUniversal');
  console.log('     (whatsapp-fluxo-motor.service.ts:92) — ANTES dos gatilhos da etapa.');
  console.log('     Não precisam ser declarados em cada FluxoEtapa.');

  // ── 9. MENU_COOPERADO hardcoded × seed F1.3 (regressão crítica)
  console.log('\n── (G) MENU_COOPERADO render hardcoded vs seed F1.3 ──');
  console.log('  ⚠️  whatsapp-bot.service.ts:672-684 (handleMenuPrincipal case "1") +');
  console.log('     :829-833 (handleMenuCooperado fallback) renderizam menu HARDCODED');
  console.log('     com 7 opções, SEM "8 CooperTokens". Motor dinâmico processa "8"');
  console.log('     se digitado, mas usuário não vê opção. FIX: adicionar opção 8.');

  // ── 10. Conflitos tenant>global
  console.log('\n── (H) FluxoEtapa override tenant vs global ──');
  const conflitos: string[] = [];
  for (const [tenantId, ests] of estadosPorTenant) {
    for (const est of ests) {
      if (estadosGlobais.has(est)) {
        conflitos.push(`  ⚠️  Estado "${est}" tem versão GLOBAL E TENANT=${tenantId} (tenant vence — verificar drift)`);
      }
    }
  }
  if (conflitos.length === 0) console.log('  ✅ Sem overrides ativos — comportamento global vale pra todos.');
  else conflitos.forEach(l => console.log(l));

  // ── 11. Resumo
  console.log('\n══════════════════════════════════════════════════════');
  console.log('Resumo:');
  console.log(`  Gatilhos órfãos:          ${orfaos.length}`);
  console.log(`  Ações não-implementadas:  ${acoesNaoImpl.length}`);
  console.log(`  Modelos BOT órfãos:       ${orfaosM.length}`);
  console.log(`  Etapas silenciosas:       ${silenciosas.length}`);
  console.log(`  Modelos confusos:         ${confusos.length}`);
  console.log(`  Conflitos tenant>global:  ${conflitos.length}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
