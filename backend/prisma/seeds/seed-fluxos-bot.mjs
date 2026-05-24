import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// Apagar fluxos existentes e recriar todos
await p.fluxoEtapa.deleteMany({});

const fluxos = [
  // Fluxo principal
  { id: 'f-inicial', nome: 'Boas-vindas / Menu Principal', ordem: 1, estado: 'INICIAL', gatilhos: [], acaoAutomatica: 'MOSTRAR_MENU_PRINCIPAL' },
  { id: 'f-menu-principal', nome: 'Menu Principal', ordem: 2, estado: 'MENU_PRINCIPAL', gatilhos: [
    { resposta: '1', proximoEstado: 'MENU_COOPERADO', acao: 'VERIFICAR_COOPERADO' },
    { resposta: '2', proximoEstado: 'MENU_SEM_FATURA' },
    { resposta: '3', proximoEstado: 'AGUARDANDO_ATENDENTE' },
    { resposta: '4', proximoEstado: 'MENU_CONVITE_INDICACAO', acao: 'GERAR_LINK_INDICACAO' },
  ]},

  // Menu do cooperado (gatilhos "1" e "2" cabeados no Bloco 3 do Sprint Bot
  // Autoatendimento — 21/05: viraram transicao real pras etapas VER_SALDO_CREDITOS
  // e VER_PROXIMA_FATURA com acaoAutomatica propria. NAO usar campo `acao` em
  // gatilho — motor nao processa, fica orfao).
  // Bloco 8 (24/05): gatilho '2' agora vai pra MENU_FATURA (menu completo com
  // PIX/boleto/historico/ja paguei) em vez de VER_PROXIMA_FATURA (que so mostra
  // a proxima fatura simples). VER_PROXIMA_FATURA fica orfa — D-novo-AF Housekeeping.
  { id: 'f-menu-cooperado', nome: 'Menu do Cooperado', ordem: 3, estado: 'MENU_COOPERADO', gatilhos: [
    { resposta: '1', proximoEstado: 'VER_SALDO_CREDITOS' },
    { resposta: '2', proximoEstado: 'MENU_FATURA' },
    { resposta: '3', proximoEstado: 'AGUARDANDO_FOTO_FATURA' },
    { resposta: '4', proximoEstado: 'ATUALIZACAO_CONTRATO' },
    { resposta: '5', proximoEstado: 'ENVIAR_CONVITE', acao: 'GERAR_LINK_INDICACAO' },
    { resposta: '6', proximoEstado: 'AGUARDANDO_ATENDENTE' },
    { resposta: '7', proximoEstado: 'AGUARDANDO_ATENDENTE' },
    // Bloco 7 (23/05) — comando manual de teste pra disparar NPS sem
    // esperar trigger automatico. Decisao Luciano: aberto pra qualquer
    // cooperado (worst case = auto-NPS, sem dano). Palavra distintiva
    // que cooperado normal nao digita casualmente.
    { resposta: 'AVALIAR', proximoEstado: 'NPS_AGUARDANDO_NOTA' },
  ]},

  // Bloco 3 (21/05) — Etapas terminais que consultam dados reais via acao.
  // Sem modeloMensagemId proprio: a acao busca o modelo do banco
  // (saldo_creditos_resultado / proxima_fatura_resultado) e renderiza com
  // os dados consultados (plano + saldo da distribuidora / cobranca + link Asaas).
  { id: 'f-ver-saldo-creditos', nome: 'Ver Saldo de Creditos', ordem: 50, estado: 'VER_SALDO_CREDITOS', gatilhos: [], acaoAutomatica: 'CONSULTAR_SALDO_CREDITOS' },
  { id: 'f-ver-proxima-fatura', nome: 'Ver Proxima Fatura', ordem: 51, estado: 'VER_PROXIMA_FATURA', gatilhos: [], acaoAutomatica: 'CONSULTAR_PROXIMA_FATURA' },

  // Fluxo sem fatura
  { id: 'f-sem-fatura', nome: 'Sem Fatura — Opções', ordem: 4, estado: 'MENU_SEM_FATURA', gatilhos: [
    { resposta: '1', proximoEstado: 'AGUARDANDO_FOTO_FATURA' },
    { resposta: '2', proximoEstado: 'AGUARDANDO_DISPOSITIVO_EMAIL' },
    { resposta: '3', proximoEstado: 'AGUARDANDO_DISTRIBUIDORA' },
  ]},
  { id: 'f-dispositivo-email', nome: 'Dispositivo para buscar email', ordem: 5, estado: 'AGUARDANDO_DISPOSITIVO_EMAIL', gatilhos: [
    { resposta: 'CEL', proximoEstado: 'AGUARDANDO_FOTO_FATURA' },
    { resposta: 'PC', proximoEstado: 'AGUARDANDO_FOTO_FATURA' },
  ]},
  { id: 'f-distribuidora', nome: 'Escolher Distribuidora', ordem: 6, estado: 'AGUARDANDO_DISTRIBUIDORA', gatilhos: [
    { resposta: 'EDP-ES', proximoEstado: 'AGUARDANDO_FOTO_FATURA' },
    { resposta: 'CEMIG', proximoEstado: 'AGUARDANDO_FOTO_FATURA' },
    { resposta: 'COPEL', proximoEstado: 'AGUARDANDO_FOTO_FATURA' },
    { resposta: 'LIGHT', proximoEstado: 'AGUARDANDO_FOTO_FATURA' },
    { resposta: 'OUTRA', proximoEstado: 'AGUARDANDO_FOTO_FATURA' },
  ]},

  // Fluxo de fatura e simulação
  { id: 'f-aguardando-foto', nome: 'Aguardando Foto/PDF da Fatura', ordem: 7, estado: 'AGUARDANDO_FOTO_FATURA', gatilhos: [], acaoAutomatica: 'PROCESSAR_OCR' },
  { id: 'f-confirmacao-dados', nome: 'Confirmar Dados Extraídos', ordem: 8, estado: 'AGUARDANDO_CONFIRMACAO_DADOS', gatilhos: [
    { resposta: 'SIM', proximoEstado: 'AGUARDANDO_CONFIRMACAO_PROPOSTA', acao: 'GERAR_PROPOSTA' },
    { resposta: '1', proximoEstado: 'AGUARDANDO_CONFIRMACAO_PROPOSTA', acao: 'GERAR_PROPOSTA' },
  ]},
  { id: 'f-confirmacao-proposta', nome: 'Confirmar Proposta / Simulação', ordem: 9, estado: 'AGUARDANDO_CONFIRMACAO_PROPOSTA', gatilhos: [
    { resposta: 'SIM', proximoEstado: 'AGUARDANDO_CONFIRMACAO_CADASTRO' },
    { resposta: '1', proximoEstado: 'AGUARDANDO_CONFIRMACAO_CADASTRO' },
  ]},
  { id: 'f-confirmacao-cadastro', nome: 'Confirmar Cadastro', ordem: 10, estado: 'AGUARDANDO_CONFIRMACAO_CADASTRO', gatilhos: [
    { resposta: 'SIM', proximoEstado: 'CONCLUIDO', acao: 'CRIAR_COOPERADO' },
    { resposta: '1', proximoEstado: 'CONCLUIDO', acao: 'CRIAR_COOPERADO' },
  ]},
  { id: 'f-concluido', nome: 'Cadastro Concluído', ordem: 11, estado: 'CONCLUIDO', gatilhos: [] },

  // Lead fora da área
  { id: 'f-lead-fora-area', nome: 'Lead Fora da Área de Atuação', ordem: 12, estado: 'LEAD_FORA_AREA', gatilhos: [
    { resposta: '1', proximoEstado: 'CONCLUIDO', acao: 'SALVAR_LEAD_EXPANSAO' },
    { resposta: '2', proximoEstado: 'CONCLUIDO' },
  ]},

  // Proxy — Bloco 6 (23/05): 4 etapas no motor dinamico via gatilho wildcard
  // + acao. Etapa AGUARDANDO_FATURA_PROXY aceita midia (Bloco 6 Etapa B
  // estendeu motor pra propagar mediaBase64 + mimeType). Estado pos-confirma:
  // MENU_COOPERADO (consistente Blocos 4/1.b/7 — NAO CONCLUIDO).
  { id: 'f-proxy-nome', nome: 'Cadastro por Proxy — Nome do Amigo', ordem: 13, estado: 'CADASTRO_PROXY_NOME', gatilhos: [
    { resposta: '*', proximoEstado: 'CADASTRO_PROXY_TELEFONE', acao: 'SALVAR_PROXY_NOME' },
  ]},
  { id: 'f-proxy-tel', nome: 'Cadastro por Proxy — Telefone do Amigo', ordem: 14, estado: 'CADASTRO_PROXY_TELEFONE', gatilhos: [
    { resposta: '*', proximoEstado: 'AGUARDANDO_FATURA_PROXY', acao: 'SALVAR_PROXY_TELEFONE' },
  ]},
  { id: 'f-proxy-fatura', nome: 'Cadastro por Proxy — Fatura do Amigo', ordem: 15, estado: 'AGUARDANDO_FATURA_PROXY', gatilhos: [
    { resposta: '*', proximoEstado: 'CONFIRMAR_PROXY', acao: 'PROCESSAR_OCR_PROXY' },
  ]},
  { id: 'f-proxy-confirmar', nome: 'Cadastro por Proxy — Confirmar', ordem: 16, estado: 'CONFIRMAR_PROXY', gatilhos: [
    { resposta: '1', proximoEstado: 'MENU_COOPERADO', acao: 'CRIAR_COOPERADO_PROXY' },
    { resposta: '2', proximoEstado: 'MENU_COOPERADO' },
  ]},

  // Menu de cobranças
  // Bloco 8 (24/05): MENU_FATURA cabeado ao motor dinamico — 4 sub-opcoes.
  // modeloMensagemId aponta pra modelo `menu_fatura` (Bloco 2). Ativo=true.
  { id: 'f-menu-fatura', nome: 'Menu de Cobranças/Faturas', ordem: 17, estado: 'MENU_FATURA', gatilhos: [
    { resposta: '1', proximoEstado: 'MENU_FATURA', acao: 'VER_FATURA_ATUAL' },
    { resposta: '2', proximoEstado: 'MENU_FATURA', acao: 'VER_HISTORICO_PAGAMENTOS' },
    { resposta: '3', proximoEstado: 'AGUARDANDO_FORMA_PAGAMENTO', acao: 'SOLICITAR_CONFIRMACAO_PAGAMENTO' },
    { resposta: '4', proximoEstado: 'MENU_COOPERADO', acao: 'SOLICITAR_NEGOCIACAO_HUMANA' },
  ]},
  { id: 'f-aguardando-forma-pagamento', nome: 'Aguardando Forma de Pagamento (ja paguei)', ordem: 58, estado: 'AGUARDANDO_FORMA_PAGAMENTO', gatilhos: [
    { resposta: '*', proximoEstado: 'MENU_COOPERADO', acao: 'SALVAR_CONFIRMACAO_PAGAMENTO' },
  ]},

  // Atualização de dados
  // Bloco 4 (22/05) — Telefone REMOVIDO do menu (decisão Luciano: trocar
  // telefone pelo proprio WhatsApp quebra a proxima sessao do bot —
  // notificacoes vao pro numero novo enquanto o cooperado continua usando o
  // antigo. Operacao consciente fica no portal web / equipe).
  { id: 'f-atualizar-cadastro', nome: 'Atualizar Cadastro', ordem: 18, estado: 'ATUALIZACAO_CADASTRO', gatilhos: [
    { resposta: '1', proximoEstado: 'AGUARDANDO_NOVO_NOME' },
    { resposta: '2', proximoEstado: 'AGUARDANDO_NOVO_EMAIL' },
    { resposta: '3', proximoEstado: 'AGUARDANDO_NOVO_CEP' },
  ]},
  // Bloco 5 (24/05): liga ao motor dinamico via Gatilho.acao. As acoes
  // INICIAR_SOLICITACAO_* criam SolicitacaoAlteracaoContrato PENDENTE
  // (bot NAO altera contrato direto — equipe aprova via painel admin).
  { id: 'f-atualizar-contrato', nome: 'Atualizar Contrato', ordem: 19, estado: 'ATUALIZACAO_CONTRATO', gatilhos: [
    { resposta: '1', proximoEstado: 'AGUARDANDO_NOVO_KWH', acao: 'INICIAR_SOLICITACAO_AUMENTAR_KWH' },
    { resposta: '2', proximoEstado: 'AGUARDANDO_NOVO_KWH', acao: 'INICIAR_SOLICITACAO_DIMINUIR_KWH' },
    { resposta: '3', proximoEstado: 'AGUARDANDO_MOTIVO_SUSPENSAO', acao: 'INICIAR_SOLICITACAO_SUSPENDER' },
    { resposta: '4', proximoEstado: 'CONFIRMAR_ENCERRAMENTO', acao: 'INICIAR_SOLICITACAO_ENCERRAR' },
  ]},
  // Bloco 5 etapas intermediarias (24/05): wildcard SALVAR_SOLICITACAO_*
  // valida input + cria solicitacao + notifica equipe + WA cooperado + MENU.
  { id: 'f-aguardando-novo-kwh', nome: 'Aguardando Novo kWh do Contrato', ordem: 55, estado: 'AGUARDANDO_NOVO_KWH', gatilhos: [
    { resposta: '*', proximoEstado: 'MENU_COOPERADO', acao: 'SALVAR_SOLICITACAO_KWH' },
  ]},
  { id: 'f-aguardando-motivo-suspensao', nome: 'Aguardando Motivo da Suspensao', ordem: 56, estado: 'AGUARDANDO_MOTIVO_SUSPENSAO', gatilhos: [
    { resposta: '*', proximoEstado: 'MENU_COOPERADO', acao: 'SALVAR_SOLICITACAO_SUSPENDER' },
  ]},
  { id: 'f-confirmar-encerramento', nome: 'Confirmar Encerramento de Contrato', ordem: 57, estado: 'CONFIRMAR_ENCERRAMENTO', gatilhos: [
    { resposta: '*', proximoEstado: 'MENU_COOPERADO', acao: 'SALVAR_SOLICITACAO_ENCERRAR' },
  ]},

  // Atendente
  { id: 'f-atendente', nome: 'Aguardando Atendente Humano', ordem: 20, estado: 'AGUARDANDO_ATENDENTE', gatilhos: [] },

  // NPS
  // Bloco 7 (23/05): gatilho wildcard liga ao motor dinamico via Gatilho.acao.
  // Acao REGISTRAR_NPS valida 0-10, persiste NpsResposta + transiciona MENU_COOPERADO.
  { id: 'f-nps', nome: 'NPS — Aguardando Nota', ordem: 21, estado: 'NPS_AGUARDANDO_NOTA', gatilhos: [
    { resposta: '*', proximoEstado: 'MENU_COOPERADO', acao: 'REGISTRAR_NPS' },
  ]},

  // Inadimplente
  { id: 'f-inadimplente', nome: 'Menu Inadimplente', ordem: 22, estado: 'MENU_INADIMPLENTE', gatilhos: [] },
];

for (const f of fluxos) {
  await p.fluxoEtapa.create({
    data: {
      id: f.id,
      nome: f.nome,
      ordem: f.ordem,
      estado: f.estado,
      gatilhos: f.gatilhos,
      acaoAutomatica: f.acaoAutomatica ?? null,
      ativo: true,
    }
  });
}

console.log(`Criados ${fluxos.length} fluxos.`);
await p.$disconnect();
