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

  // Menu do cooperado
  { id: 'f-menu-cooperado', nome: 'Menu do Cooperado', ordem: 3, estado: 'MENU_COOPERADO', gatilhos: [
    { resposta: '1', proximoEstado: 'MENU_COOPERADO', acao: 'VER_CREDITOS' },
    { resposta: '2', proximoEstado: 'MENU_COOPERADO', acao: 'VER_FATURA' },
    { resposta: '3', proximoEstado: 'AGUARDANDO_FOTO_FATURA' },
    { resposta: '4', proximoEstado: 'ATUALIZACAO_CONTRATO' },
    { resposta: '5', proximoEstado: 'MENU_COOPERADO', acao: 'GERAR_LINK_INDICACAO' },
    { resposta: '6', proximoEstado: 'AGUARDANDO_ATENDENTE' },
    { resposta: '7', proximoEstado: 'AGUARDANDO_ATENDENTE' },
  ]},

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

  // Proxy
  { id: 'f-proxy-nome', nome: 'Cadastro por Proxy — Nome do Amigo', ordem: 13, estado: 'CADASTRO_PROXY_NOME', gatilhos: [] },
  { id: 'f-proxy-tel', nome: 'Cadastro por Proxy — Telefone do Amigo', ordem: 14, estado: 'CADASTRO_PROXY_TELEFONE', gatilhos: [] },
  { id: 'f-proxy-fatura', nome: 'Cadastro por Proxy — Fatura do Amigo', ordem: 15, estado: 'AGUARDANDO_FATURA_PROXY', gatilhos: [], acaoAutomatica: 'PROCESSAR_OCR_PROXY' },
  { id: 'f-proxy-confirmar', nome: 'Cadastro por Proxy — Confirmar', ordem: 16, estado: 'CONFIRMAR_PROXY', gatilhos: [
    { resposta: '1', proximoEstado: 'CONCLUIDO', acao: 'CRIAR_COOPERADO_PROXY' },
    { resposta: '2', proximoEstado: 'CONCLUIDO' },
  ]},

  // Menu de cobranças
  { id: 'f-menu-fatura', nome: 'Menu de Cobranças/Faturas', ordem: 17, estado: 'MENU_FATURA', gatilhos: [] },

  // Atualização de dados
  { id: 'f-atualizar-cadastro', nome: 'Atualizar Cadastro', ordem: 18, estado: 'ATUALIZACAO_CADASTRO', gatilhos: [
    { resposta: '1', proximoEstado: 'AGUARDANDO_NOVO_NOME' },
    { resposta: '2', proximoEstado: 'AGUARDANDO_NOVO_EMAIL' },
    { resposta: '3', proximoEstado: 'AGUARDANDO_NOVO_TELEFONE' },
    { resposta: '4', proximoEstado: 'AGUARDANDO_NOVO_CEP' },
  ]},
  { id: 'f-atualizar-contrato', nome: 'Atualizar Contrato', ordem: 19, estado: 'ATUALIZACAO_CONTRATO', gatilhos: [
    { resposta: '1', proximoEstado: 'MENU_COOPERADO', acao: 'SOLICITAR_AUMENTO_KWH' },
    { resposta: '2', proximoEstado: 'MENU_COOPERADO', acao: 'SOLICITAR_REDUCAO_KWH' },
    { resposta: '3', proximoEstado: 'MENU_COOPERADO', acao: 'SUSPENDER_CONTRATO' },
    { resposta: '4', proximoEstado: 'MENU_COOPERADO', acao: 'ENCERRAR_CONTRATO' },
  ]},

  // Atendente
  { id: 'f-atendente', nome: 'Aguardando Atendente Humano', ordem: 20, estado: 'AGUARDANDO_ATENDENTE', gatilhos: [] },

  // NPS
  { id: 'f-nps', nome: 'NPS — Aguardando Nota', ordem: 21, estado: 'NPS_AGUARDANDO_NOTA', gatilhos: [] },

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
