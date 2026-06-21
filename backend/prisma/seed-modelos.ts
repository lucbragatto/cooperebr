import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CONTRATO_PADRAO = `CONTRATO DE ADESÃO À {{TIPO_PARCEIRO}}

CONTRATANTE: {{NOME_COOPERADO}}, inscrito(a) no CPF/CNPJ sob o nº {{CPF_CNPJ}}, residente e domiciliado(a) em {{ENDERECO_COOPERADO}}, {{CIDADE_COOPERADO}}/{{ESTADO_COOPERADO}}, CEP {{CEP_COOPERADO}}, titular da Unidade Consumidora nº {{UC}}, junto à concessionária {{DISTRIBUIDORA}}.

CONTRATADA: {{NOME_PARCEIRO}}, inscrita no CNPJ sob o nº {{CNPJ_PARCEIRO}}, com sede em {{ENDERECO_PARCEIRO}}, {{CIDADE_PARCEIRO}}/{{ESTADO_PARCEIRO}}.

CLÁUSULA 1ª – DO OBJETO
O presente contrato tem por objeto a adesão do CONTRATANTE ao sistema de compensação de energia elétrica da CONTRATADA, nos termos da Resolução Normativa ANEEL nº 482/2012 e suas alterações.

CLÁUSULA 2ª – DA USINA GERADORA
A energia será gerada pela usina {{NOME_USINA}}, com potência instalada de {{POTENCIA_USINA}} kWp, localizada em {{CIDADE_USINA}}/{{ESTADO_USINA}}.

CLÁUSULA 3ª – DO DESCONTO
O CONTRATANTE receberá um desconto de {{DESCONTO}}% sobre o valor da energia compensada, calculado sobre a tarifa TUSD+TE vigente.

CLÁUSULA 4ª – DA COTA DE ENERGIA
A cota mensal estimada do CONTRATANTE é de {{COTA_KWH}} kWh, podendo variar conforme a geração da usina e o rateio entre os participantes.

CLÁUSULA 5ª – DA VIGÊNCIA
O presente contrato terá vigência a partir de {{DATA_INICIO}}, por prazo indeterminado, podendo ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias.

CLÁUSULA 6ª – DO PAGAMENTO
O CONTRATANTE pagará mensalmente o valor correspondente à energia compensada com o desconto previsto na Cláusula 3ª, com vencimento no dia {{DIA_VENCIMENTO}} de cada mês.

CLÁUSULA 7ª – DAS DISPOSIÇÕES GERAIS
Este contrato é regido pelas leis brasileiras, elegendo-se o foro da comarca de {{CIDADE_PARCEIRO}}/{{ESTADO_PARCEIRO}} para dirimir quaisquer questões.

{{CIDADE_PARCEIRO}}, {{DATA}}.

_______________________________
{{NOME_COOPERADO}}
CPF/CNPJ: {{CPF_CNPJ}}

_______________________________
{{NOME_PARCEIRO}}
CNPJ: {{CNPJ_PARCEIRO}}`;

const PROCURACAO_PADRAO = `PROCURAÇÃO

OUTORGANTE: {{NOME_COOPERADO}}, {{NACIONALIDADE}}, {{ESTADO_CIVIL}}, inscrito(a) no CPF sob o nº {{CPF_CNPJ}}, residente e domiciliado(a) em {{ENDERECO_COOPERADO}}, {{CIDADE_COOPERADO}}/{{ESTADO_COOPERADO}}, CEP {{CEP_COOPERADO}}, titular da Unidade Consumidora nº {{UC}} junto à concessionária {{DISTRIBUIDORA}}.

OUTORGADA: {{NOME_PARCEIRO}}, inscrita no CNPJ sob o nº {{CNPJ_PARCEIRO}}, com sede em {{ENDERECO_PARCEIRO}}, {{CIDADE_PARCEIRO}}/{{ESTADO_PARCEIRO}}, neste ato representada por {{REPRESENTANTE_LEGAL}}.

PODERES: O OUTORGANTE confere à OUTORGADA poderes específicos para, em seu nome, junto à concessionária {{DISTRIBUIDORA}}:

a) Solicitar a adesão ao Sistema de Compensação de Energia Elétrica (SCEE), conforme Resolução Normativa ANEEL nº 482/2012;
b) Assinar termos de adesão, formulários e demais documentos necessários à inclusão da Unidade Consumidora nº {{UC}} no sistema de compensação;
c) Acompanhar e gerenciar os créditos de energia gerados pela usina {{NOME_USINA}} ({{POTENCIA_USINA}} kWp);
d) Representar o OUTORGANTE perante a concessionária para tratar de assuntos relacionados à compensação de energia.

PRAZO: Esta procuração é válida por prazo indeterminado, podendo ser revogada a qualquer tempo mediante comunicação por escrito.

{{CIDADE_COOPERADO}}, {{DATA}}.

_______________________________
{{NOME_COOPERADO}}
CPF: {{CPF_CNPJ}}`;

function extrairVariaveis(texto: string): string[] {
  const matches = texto.match(/\{\{([A-Z_]+)\}\}/g) || [];
  const unique = [...new Set(matches.map((m) => m.replace(/[{}]/g, '')))];
  return unique;
}

// Sprint M47 (21/06/2026) — termo de desligamento da distribuidora/
// cooperativa concorrente. TENANT-AGNÓSTICO: variáveis {{provedora.*}} em
// branco (princípio multi-tenant de templates, regra inegociável 17/05).
// Admin de cada parceiro preenche {{provedora.nome}}, {{provedora.cnpj}} etc
// na primeira customização (ou via Sprint Módulo Documentos futura).
const DESLIGAMENTO_CONCORRENTE_PADRAO = `TERMO DE DESLIGAMENTO DE FORNECEDOR DE GERAÇÃO DISTRIBUÍDA

DECLARANTE: {{NOME_COOPERADO}}, inscrito(a) no CPF/CNPJ sob o nº {{CPF_CNPJ}}, residente e domiciliado(a) em {{ENDERECO_COOPERADO}}, {{CIDADE_COOPERADO}}/{{ESTADO_COOPERADO}}, titular da Unidade Consumidora nº {{UC}} junto à concessionária {{DISTRIBUIDORA}}.

FORNECEDOR ANTERIOR: {{FORNECEDOR_GD_ANTERIOR}}, do qual o(a) DECLARANTE recebia créditos de Geração Distribuída no Sistema de Compensação de Energia Elétrica (SCEE), nos termos da Lei 14.300/2022 e da Resolução Normativa ANEEL nº 1.000/2021.

NOVO PROVEDOR DE GD: {{provedora.nome}}, inscrita no CNPJ sob o nº {{provedora.cnpj}}, com sede em {{provedora.endereco}}, {{provedora.cidade}}/{{provedora.estado}}, representada por {{provedora.representanteLegal}}.

CLÁUSULA 1ª – DO OBJETO
O presente termo formaliza o desligamento voluntário do(a) DECLARANTE do sistema de Geração Distribuída fornecido por {{FORNECEDOR_GD_ANTERIOR}}, com migração da Unidade Consumidora nº {{UC}} para o sistema operado por {{provedora.nome}}.

CLÁUSULA 2ª – DA RESPONSABILIDADE PELO PROCESSO JUNTO À CONCESSIONÁRIA
O(A) DECLARANTE autoriza {{provedora.nome}} a representá-lo(a) junto à concessionária {{DISTRIBUIDORA}} para todos os atos necessários ao desligamento do fornecedor anterior e habilitação da nova alocação SCEE, incluindo retirada da UC da lista de rateio de {{FORNECEDOR_GD_ANTERIOR}}.

CLÁUSULA 3ª – DA NÃO-DUPLICIDADE DE ALOCAÇÃO
O(A) DECLARANTE declara, sob as penas da lei, que durante o período de transição NÃO permanecerá alocado(a) simultaneamente em dois sistemas de Geração Distribuída, em conformidade com o art. 14 da Lei 14.300/2022.

CLÁUSULA 4ª – DA AUSÊNCIA DE PENDÊNCIAS
O(A) DECLARANTE confirma estar adimplente com {{FORNECEDOR_GD_ANTERIOR}} até a data deste termo e assume responsabilidade por eventuais obrigações financeiras remanescentes com o fornecedor anterior.

CLÁUSULA 5ª – DA VIGÊNCIA
Este termo tem efeito a partir de {{DATA_DESLIGAMENTO}} e perdura até a confirmação formal do desligamento por {{FORNECEDOR_GD_ANTERIOR}} e da entrada do(a) DECLARANTE no sistema de {{provedora.nome}}.

{{CIDADE_COOPERADO}}, {{DATA}}.

_______________________________
{{NOME_COOPERADO}}
CPF/CNPJ: {{CPF_CNPJ}}

_______________________________
{{provedora.nome}}
CNPJ: {{provedora.cnpj}}`;

async function main() {
  console.log('Seeding modelos de documento padrão...');

  const contratoPadrao = await prisma.modeloDocumento.upsert({
    where: { id: 'modelo-contrato-padrao' },
    update: {
      conteudo: CONTRATO_PADRAO,
      variaveis: extrairVariaveis(CONTRATO_PADRAO),
    },
    create: {
      id: 'modelo-contrato-padrao',
      tipo: 'CONTRATO',
      nome: 'Contrato Padrão CoopereBR',
      conteudo: CONTRATO_PADRAO,
      variaveis: extrairVariaveis(CONTRATO_PADRAO),
      isPadrao: true,
      ativo: true,
    },
  });

  const procuracaoPadrao = await prisma.modeloDocumento.upsert({
    where: { id: 'modelo-procuracao-padrao' },
    update: {
      conteudo: PROCURACAO_PADRAO,
      variaveis: extrairVariaveis(PROCURACAO_PADRAO),
    },
    create: {
      id: 'modelo-procuracao-padrao',
      tipo: 'PROCURACAO',
      nome: 'Procuração Padrão CoopereBR',
      conteudo: PROCURACAO_PADRAO,
      variaveis: extrairVariaveis(PROCURACAO_PADRAO),
      isPadrao: true,
      ativo: true,
    },
  });

  // Sprint M47 (21/06/2026) — tipo DESLIGAMENTO_CONCORRENTE pra fluxo de
  // migração externa. Tenant-agnóstico ({{provedora.*}} em branco).
  const desligamentoPadrao = await prisma.modeloDocumento.upsert({
    where: { id: 'modelo-desligamento-concorrente-padrao' },
    update: {
      conteudo: DESLIGAMENTO_CONCORRENTE_PADRAO,
      variaveis: extrairVariaveis(DESLIGAMENTO_CONCORRENTE_PADRAO),
    },
    create: {
      id: 'modelo-desligamento-concorrente-padrao',
      tipo: 'DESLIGAMENTO_CONCORRENTE',
      nome: 'Termo de Desligamento de Fornecedor GD (padrão)',
      conteudo: DESLIGAMENTO_CONCORRENTE_PADRAO,
      variaveis: extrairVariaveis(DESLIGAMENTO_CONCORRENTE_PADRAO),
      isPadrao: true,
      ativo: true,
    },
  });

  console.log('Modelos criados:', {
    contrato: contratoPadrao.id,
    procuracao: procuracaoPadrao.id,
    desligamento: desligamentoPadrao.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
