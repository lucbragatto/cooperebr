-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'COOPERADO');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('RG_FRENTE', 'RG_VERSO', 'CNH_FRENTE', 'CNH_VERSO', 'CONTRATO_SOCIAL', 'OUTROS');

-- CreateEnum
CREATE TYPE "StatusDocumento" AS ENUM ('PENDENTE', 'APROVADO', 'REPROVADO');

-- CreateEnum
CREATE TYPE "StatusCooperado" AS ENUM ('PENDENTE_ASSINATURA', 'PENDENTE', 'PENDENTE_VALIDACAO', 'PENDENTE_DOCUMENTOS', 'AGUARDANDO_CONCESSIONARIA', 'APROVADO', 'ATIVO', 'ATIVO_RECEBENDO_CREDITOS', 'SUSPENSO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "TipoCooperado" AS ENUM ('COM_UC', 'SEM_UC', 'GERADOR', 'CARREGADOR_VEICULAR', 'USUARIO_CARREGADOR');

-- CreateEnum
CREATE TYPE "StatusUsina" AS ENUM ('CADASTRADA', 'AGUARDANDO_HOMOLOGACAO', 'HOMOLOGADA', 'EM_PRODUCAO', 'SUSPENSA');

-- CreateEnum
CREATE TYPE "ModeloCobranca" AS ENUM ('FIXO_MENSAL', 'CREDITOS_COMPENSADOS', 'CREDITOS_DINAMICO');

-- CreateEnum
CREATE TYPE "TipoCampanha" AS ENUM ('PADRAO', 'CAMPANHA');

-- CreateEnum
CREATE TYPE "StatusContrato" AS ENUM ('PENDENTE_ATIVACAO', 'EM_APROVACAO', 'AGUARDANDO_ASSINATURA', 'ASSINATURA_SOLICITADA', 'APROVADO', 'ATIVO', 'SUSPENSO', 'ENCERRADO', 'LISTA_ESPERA');

-- CreateEnum
CREATE TYPE "StatusCobranca" AS ENUM ('PENDENTE', 'A_VENCER', 'PAGO', 'VENCIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoOcorrencia" AS ENUM ('FALTA_ENERGIA', 'MEDICAO_INCORRETA', 'PROBLEMA_FATURA', 'SOLICITACAO', 'FALHA_USINA', 'DESLIGAMENTO', 'OUTROS');

-- CreateEnum
CREATE TYPE "StatusOcorrencia" AS ENUM ('ABERTA', 'EM_ANDAMENTO', 'RESOLVIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "PrioridadeOcorrencia" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "StatusFatura" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "BaseCalculo" AS ENUM ('TUSD_TE', 'TOTAL_FATURA');

-- CreateTable
CREATE TABLE "cooperativas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "endereco" TEXT,
    "numero" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "tipoParceiro" TEXT NOT NULL DEFAULT 'COOPERATIVA',
    "multaAtraso" DECIMAL(5,2) NOT NULL DEFAULT 2.0,
    "jurosDiarios" DECIMAL(5,3) NOT NULL DEFAULT 0.033,
    "diasCarencia" INTEGER NOT NULL DEFAULT 3,
    "intervaloMinCobrancaHoras" INTEGER NOT NULL DEFAULT 24,
    "planoSaasId" TEXT,
    "diaVencimentoSaas" INTEGER NOT NULL DEFAULT 10,
    "statusSaas" TEXT NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cooperativas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cpf" TEXT,
    "telefone" TEXT,
    "supabaseId" TEXT,
    "perfil" "PerfilUsuario" NOT NULL DEFAULT 'COOPERADO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "fotoFacialUrl" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooperados" (
    "id" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "status" "StatusCooperado" NOT NULL DEFAULT 'PENDENTE',
    "cotaKwhMensal" DECIMAL(10,2),
    "documento" TEXT,
    "tipoDocumento" TEXT,
    "preferenciaCobranca" TEXT,
    "tipoCooperado" "TipoCooperado" NOT NULL DEFAULT 'COM_UC',
    "termoAdesaoAceito" BOOLEAN NOT NULL DEFAULT false,
    "termoAdesaoAceitoEm" TIMESTAMP(3),
    "usinaPropriaId" TEXT,
    "percentualRepasse" DECIMAL(5,2),
    "cooperativaId" TEXT,
    "dataInicioCreditos" TIMESTAMP(3),
    "protocoloConcessionaria" TEXT,
    "representanteLegalNome" TEXT,
    "representanteLegalCpf" TEXT,
    "representanteLegalCargo" TEXT,
    "tipoPessoa" TEXT DEFAULT 'PF',
    "dataNascimento" TIMESTAMP(3),
    "razaoSocial" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pixChave" TEXT,
    "pixTipo" TEXT,
    "codigoIndicacao" TEXT NOT NULL,
    "cooperadoIndicadorId" TEXT,
    "tokenAssinatura" TEXT,
    "tokenAssinaturaExp" TIMESTAMP(3),

    CONSTRAINT "cooperados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_cooperados" (
    "id" TEXT NOT NULL,
    "cooperadoId" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "url" TEXT NOT NULL,
    "nomeArquivo" TEXT,
    "tamanhoBytes" INTEGER,
    "status" "StatusDocumento" NOT NULL DEFAULT 'PENDENTE',
    "motivoRejeicao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_cooperados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ucs" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "numeroUC" TEXT,
    "codigoMedidor" TEXT,
    "cep" TEXT,
    "bairro" TEXT,
    "distribuidora" TEXT,
    "classificacao" TEXT,
    "modalidadeTarifaria" TEXT,
    "tensaoNominal" TEXT,
    "tipoFornecimento" TEXT,
    "cooperadoId" TEXT NOT NULL,
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ucs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usinas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "potenciaKwp" DECIMAL(10,2) NOT NULL,
    "capacidadeKwh" DECIMAL(15,2),
    "producaoMensalKwh" DECIMAL(15,2),
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "statusHomologacao" "StatusUsina" NOT NULL DEFAULT 'CADASTRADA',
    "dataHomologacao" TIMESTAMP(3),
    "dataInicioProducao" TIMESTAMP(3),
    "observacoes" TEXT,
    "modeloCobrancaOverride" "ModeloCobranca",
    "distribuidora" TEXT,
    "cooperativaId" TEXT,
    "proprietarioNome" TEXT,
    "proprietarioCpfCnpj" TEXT,
    "proprietarioTelefone" TEXT,
    "proprietarioEmail" TEXT,
    "proprietarioTipo" TEXT NOT NULL DEFAULT 'PF',
    "proprietarioCooperadoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "cooperadoId" TEXT NOT NULL,
    "ucId" TEXT NOT NULL,
    "usinaId" TEXT,
    "planoId" TEXT,
    "propostaId" TEXT,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "percentualDesconto" DECIMAL(5,2) NOT NULL,
    "kwhContrato" DECIMAL(10,5),
    "percentualUsina" DECIMAL(8,4),
    "status" "StatusContrato" NOT NULL DEFAULT 'PENDENTE_ATIVACAO',
    "modeloCobrancaOverride" "ModeloCobranca",
    "kwhContratoAnual" DECIMAL(15,2),
    "kwhContratoMensal" DECIMAL(15,2),
    "descontoOverride" DECIMAL(5,2),
    "baseCalculoOverride" TEXT,
    "regrasAplicadas" JSONB,
    "cooperativaId" TEXT,
    "ultimoReajusteEm" TIMESTAMP(3),
    "ultimoReajusteIndice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "modeloCobranca" "ModeloCobranca" NOT NULL,
    "descontoBase" DECIMAL(5,2) NOT NULL,
    "temPromocao" BOOLEAN NOT NULL DEFAULT false,
    "descontoPromocional" DECIMAL(5,2),
    "mesesPromocao" INTEGER,
    "publico" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "tipoCampanha" "TipoCampanha" NOT NULL DEFAULT 'PADRAO',
    "dataInicioVigencia" TIMESTAMP(3),
    "dataFimVigencia" TIMESTAMP(3),
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobrancas" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "mesReferencia" INTEGER NOT NULL,
    "anoReferencia" INTEGER NOT NULL,
    "valorBruto" DECIMAL(10,2) NOT NULL,
    "percentualDesconto" DECIMAL(5,2) NOT NULL,
    "valorDesconto" DECIMAL(10,2) NOT NULL,
    "valorLiquido" DECIMAL(10,2) NOT NULL,
    "status" "StatusCobranca" NOT NULL DEFAULT 'PENDENTE',
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "dataPagamento" TIMESTAMP(3),
    "valorPago" DECIMAL(10,2),
    "motivoCancelamento" TEXT,
    "observacoesNegociacao" TEXT,
    "kwhEntregue" DOUBLE PRECISION,
    "kwhConsumido" DOUBLE PRECISION,
    "kwhCompensado" DOUBLE PRECISION,
    "kwhSaldo" DOUBLE PRECISION,
    "competencia" TIMESTAMP(3),
    "geracaoMensalId" TEXT,
    "descontoAplicado" DOUBLE PRECISION,
    "baseCalculoUsada" TEXT,
    "fonteDesconto" TEXT,
    "cooperativaId" TEXT,
    "valorMulta" DECIMAL(10,2),
    "valorJuros" DECIMAL(10,2),
    "valorAtualizado" DECIMAL(10,2),
    "whatsappEnviadoEm" TIMESTAMP(3),
    "notificadoVencimento" BOOLEAN NOT NULL DEFAULT false,
    "ultimaCobrancaWhatsappEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cobrancas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocorrencias" (
    "id" TEXT NOT NULL,
    "cooperadoId" TEXT NOT NULL,
    "ucId" TEXT,
    "tipo" "TipoOcorrencia" NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "StatusOcorrencia" NOT NULL DEFAULT 'ABERTA',
    "prioridade" "PrioridadeOcorrencia" NOT NULL,
    "resolucao" TEXT,
    "prestadorId" TEXT,
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocorrencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faturas_processadas" (
    "id" TEXT NOT NULL,
    "cooperadoId" TEXT NOT NULL,
    "ucId" TEXT,
    "arquivoUrl" TEXT,
    "dadosExtraidos" JSONB NOT NULL,
    "historicoConsumo" JSONB NOT NULL,
    "mesesUtilizados" INTEGER NOT NULL,
    "mesesDescartados" INTEGER NOT NULL,
    "mediaKwhCalculada" DECIMAL(10,2) NOT NULL,
    "thresholdUtilizado" DECIMAL(5,2) NOT NULL,
    "status" "StatusFatura" NOT NULL DEFAULT 'PENDENTE',
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faturas_processadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "cooperadoId" TEXT,
    "adminId" TEXT,
    "link" TEXT,
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_tenant" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descricao" TEXT,
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao_motor" (
    "id" TEXT NOT NULL,
    "fonteKwh" TEXT NOT NULL DEFAULT 'MES_RECENTE',
    "thresholdOutlier" DECIMAL(10,5) NOT NULL DEFAULT 1.50000,
    "acaoOutlier" TEXT NOT NULL DEFAULT 'OFERECER_OPCAO',
    "baseDesconto" TEXT NOT NULL DEFAULT 'TARIFA_UNIT',
    "descontoPadrao" DECIMAL(10,5) NOT NULL DEFAULT 20.00000,
    "descontoMinimo" DECIMAL(10,5) NOT NULL DEFAULT 15.00000,
    "descontoMaximo" DECIMAL(10,5) NOT NULL DEFAULT 30.00000,
    "acaoResultadoAcima" TEXT NOT NULL DEFAULT 'AUMENTAR_DESCONTO',
    "acaoResultadoAbaixo" TEXT NOT NULL DEFAULT 'USAR_FATURA',
    "indicesCorrecao" TEXT[] DEFAULT ARRAY['IPCA']::TEXT[],
    "combinacaoIndices" TEXT NOT NULL DEFAULT 'MAIOR',
    "limiteReajusteConces" BOOLEAN NOT NULL DEFAULT true,
    "diaAplicacaoAnual" INTEGER NOT NULL DEFAULT 1,
    "mesAplicacaoAnual" INTEGER NOT NULL DEFAULT 1,
    "aplicacaoCorrecao" TEXT NOT NULL DEFAULT 'GERAL',
    "aprovarManualmente" BOOLEAN NOT NULL DEFAULT true,
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_motor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifas_concessionaria" (
    "id" TEXT NOT NULL,
    "concessionaria" TEXT NOT NULL,
    "dataVigencia" TIMESTAMP(3) NOT NULL,
    "tusdAnterior" DECIMAL(10,5) NOT NULL,
    "tusdNova" DECIMAL(10,5) NOT NULL,
    "teAnterior" DECIMAL(10,5) NOT NULL,
    "teNova" DECIMAL(10,5) NOT NULL,
    "percentualAnunciado" DECIMAL(10,5) NOT NULL,
    "percentualApurado" DECIMAL(10,5) NOT NULL,
    "percentualAplicado" DECIMAL(10,5) NOT NULL,
    "observacoes" TEXT,
    "aprovadoPor" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarifas_concessionaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_reajustes" (
    "id" TEXT NOT NULL,
    "tarifaId" TEXT NOT NULL,
    "dataAplicacao" TIMESTAMP(3) NOT NULL,
    "indiceUtilizado" TEXT NOT NULL,
    "percentualIndice" DECIMAL(10,5) NOT NULL,
    "percentualAnunciado" DECIMAL(10,5) NOT NULL,
    "percentualApurado" DECIMAL(10,5) NOT NULL,
    "percentualAplicado" DECIMAL(10,5) NOT NULL,
    "diferencaConc" DECIMAL(10,5) NOT NULL,
    "cooperadosAfetados" INTEGER NOT NULL,
    "valorMedioAnterior" DECIMAL(10,5) NOT NULL,
    "valorMedioNovo" DECIMAL(10,5) NOT NULL,
    "impactoMensalTotal" DECIMAL(10,5) NOT NULL,
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_reajustes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "propostas_cooperado" (
    "id" TEXT NOT NULL,
    "cooperadoId" TEXT NOT NULL,
    "mesReferencia" TEXT NOT NULL,
    "kwhMesRecente" DECIMAL(10,5) NOT NULL,
    "valorMesRecente" DECIMAL(10,5) NOT NULL,
    "kwhMedio12m" DECIMAL(10,5) NOT NULL,
    "valorMedio12m" DECIMAL(10,5) NOT NULL,
    "outlierDetectado" BOOLEAN NOT NULL DEFAULT false,
    "tusdUtilizada" DECIMAL(10,5) NOT NULL,
    "teUtilizada" DECIMAL(10,5) NOT NULL,
    "tarifaUnitSemTrib" DECIMAL(10,5) NOT NULL,
    "kwhApuradoBase" DECIMAL(10,5) NOT NULL,
    "baseUtilizada" TEXT NOT NULL,
    "descontoPercentual" DECIMAL(10,5) NOT NULL,
    "descontoAbsoluto" DECIMAL(10,5) NOT NULL,
    "kwhContrato" DECIMAL(10,5) NOT NULL,
    "valorCooperado" DECIMAL(10,5) NOT NULL,
    "economiaAbsoluta" DECIMAL(10,5) NOT NULL,
    "economiaPercentual" DECIMAL(10,5) NOT NULL,
    "economiaMensal" DECIMAL(10,5) NOT NULL,
    "economiaAnual" DECIMAL(10,5) NOT NULL,
    "mesesEquivalentes" DECIMAL(10,5) NOT NULL,
    "mediaCooperativaKwh" DECIMAL(10,5) NOT NULL,
    "resultadoVsMedia" DECIMAL(10,5) NOT NULL,
    "opcaoEscolhida" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "planoId" TEXT,
    "validaAte" TIMESTAMP(3) NOT NULL,
    "cooperativaId" TEXT,
    "tokenAprovacao" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "aprovadoPor" TEXT,
    "modoAprovacao" TEXT,
    "termoAdesaoAssinadoEm" TIMESTAMP(3),
    "termoAdesaoAssinadoPor" TEXT,
    "procuracaoAssinadaEm" TIMESTAMP(3),
    "procuracaoAssinadaPor" TEXT,
    "tokenAssinatura" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "propostas_cooperado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelos_cobranca_config" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "ModeloCobranca" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "escopo" TEXT NOT NULL DEFAULT 'COOPERATIVA',
    "usinaId" TEXT,
    "descontoBase" DECIMAL(5,2) NOT NULL,
    "descontoMinimo" DECIMAL(5,2),
    "descontoMaximo" DECIMAL(5,2),
    "temPromocao" BOOLEAN NOT NULL DEFAULT false,
    "descontoPromocional" DECIMAL(5,2),
    "promocaoInicio" TIMESTAMP(3),
    "promocaoFim" TIMESTAMP(3),
    "temProgressivo" BOOLEAN NOT NULL DEFAULT false,
    "descontoProgressivo" DECIMAL(5,2),
    "progressivoAteCap" DECIMAL(5,2),
    "baseCalculo" TEXT NOT NULL DEFAULT 'TUSD_TE',
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modelos_cobranca_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_cobranca" (
    "id" TEXT NOT NULL,
    "cooperativaId" TEXT NOT NULL,
    "usinaId" TEXT,
    "descontoPadrao" DECIMAL(5,2) NOT NULL,
    "descontoMin" DECIMAL(5,2) NOT NULL,
    "descontoMax" DECIMAL(5,2) NOT NULL,
    "baseCalculo" "BaseCalculo" NOT NULL DEFAULT 'TUSD_TE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geracoes_mensais" (
    "id" TEXT NOT NULL,
    "usinaId" TEXT NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "kwhGerado" DOUBLE PRECISION NOT NULL,
    "fonte" TEXT,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geracoes_mensais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lista_espera" (
    "id" TEXT NOT NULL,
    "cooperadoId" TEXT NOT NULL,
    "contratoId" TEXT,
    "kwhNecessario" DECIMAL(10,5) NOT NULL,
    "posicao" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AGUARDANDO',
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lista_espera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prestadores" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "documento" TEXT,
    "cooperadoId" TEXT,
    "cooperativaId" TEXT,
    "especialidade" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prestadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usinas_monitoramento_config" (
    "id" TEXT NOT NULL,
    "usinaId" TEXT NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,
    "intervaloMinutos" INTEGER NOT NULL DEFAULT 30,
    "reCheckMinutos" INTEGER NOT NULL DEFAULT 10,
    "potenciaMinimaPct" INTEGER NOT NULL DEFAULT 20,
    "sungrowUsuario" TEXT,
    "sungrowSenha" TEXT,
    "sungrowAppKey" TEXT,
    "sungrowPlantId" TEXT,
    "prestadorPadraoId" TEXT,
    "prioridadeAlerta" TEXT NOT NULL DEFAULT 'ALTA',
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usinas_monitoramento_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usinas_leituras" (
    "id" TEXT NOT NULL,
    "usinaId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusOnline" BOOLEAN NOT NULL,
    "potenciaAtualKw" DECIMAL(10,3),
    "energiaHojeKwh" DECIMAL(15,3),
    "energiaMesKwh" DECIMAL(15,3),
    "energiaTotalKwh" DECIMAL(15,3),
    "rawData" JSONB,
    "erro" TEXT,

    CONSTRAINT "usinas_leituras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usinas_alertas" (
    "id" TEXT NOT NULL,
    "usinaId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'SUSPEITO',
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "primeiraLeitura" TIMESTAMP(3) NOT NULL,
    "confirmadoEm" TIMESTAMP(3),
    "resolvidoEm" TIMESTAMP(3),
    "ocorrenciaId" TEXT,
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usinas_alertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_contas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plano_contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos_caixa" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "competencia" TEXT NOT NULL,
    "dataVencimento" TIMESTAMP(3),
    "dataPagamento" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PREVISTO',
    "naturezaAto" TEXT NOT NULL DEFAULT 'COOPERADO_PROPRIO',
    "planoContasId" TEXT,
    "cooperadoId" TEXT,
    "contratoUsoId" TEXT,
    "convenioId" TEXT,
    "observacoes" TEXT,
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lancamentos_caixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos_uso" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "cooperadoId" TEXT NOT NULL,
    "tipoAtivo" TEXT NOT NULL,
    "descricaoAtivo" TEXT NOT NULL,
    "usinaId" TEXT,
    "tipoContrato" TEXT NOT NULL,
    "valorFixoMensal" DECIMAL(15,2),
    "valorPorUnidade" DECIMAL(15,4),
    "percentualRepasse" DECIMAL(8,4),
    "unidadeMedida" TEXT,
    "diaVencimento" INTEGER NOT NULL DEFAULT 10,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT,
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_uso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos_convenio" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "empresaNome" TEXT NOT NULL,
    "empresaCnpj" TEXT NOT NULL,
    "empresaEmail" TEXT,
    "empresaTelefone" TEXT,
    "tipoDesconto" TEXT NOT NULL,
    "diaEnvioRelatorio" INTEGER NOT NULL DEFAULT 5,
    "diaDesconto" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_convenio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convenio_cooperados" (
    "id" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "cooperadoId" TEXT NOT NULL,
    "matricula" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convenio_cooperados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formas_pagamento_cooperado" (
    "id" TEXT NOT NULL,
    "cooperadoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "recorrente" BOOLEAN NOT NULL DEFAULT true,
    "convenioId" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "banco" TEXT,
    "dadosGateway" JSONB,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formas_pagamento_cooperado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_bancarias" (
    "id" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL DEFAULT 'SANDBOX',
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "convenio" TEXT,
    "carteira" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "digitoConta" TEXT,
    "certificadoPfx" TEXT,
    "certificadoSenha" TEXT,
    "webhookSecret" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobrancas_bancarias" (
    "id" TEXT NOT NULL,
    "cobrancaId" TEXT,
    "cooperadoId" TEXT NOT NULL,
    "configuracaoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT NOT NULL,
    "nossoNumero" TEXT,
    "codigoBarras" TEXT,
    "linhaDigitavel" TEXT,
    "pixCopiaECola" TEXT,
    "qrCodeBase64" TEXT,
    "urlBoleto" TEXT,
    "txId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "dataPagamento" TIMESTAMP(3),
    "valorPago" DECIMAL(15,2),
    "retornoBanco" JSONB,
    "webhookRecebidoEm" TIMESTAMP(3),
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cobrancas_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asaas_configs" (
    "id" TEXT NOT NULL,
    "cooperativaId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL DEFAULT 'SANDBOX',
    "webhookToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asaas_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asaas_customers" (
    "id" TEXT NOT NULL,
    "cooperadoId" TEXT NOT NULL,
    "asaasId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asaas_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asaas_cobrancas" (
    "id" TEXT NOT NULL,
    "cobrancaId" TEXT,
    "cooperadoId" TEXT NOT NULL,
    "asaasId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "linkPagamento" TEXT,
    "boletoUrl" TEXT,
    "pixQrCode" TEXT,
    "pixCopiaECola" TEXT,
    "nossoNumero" TEXT,
    "linhaDigitavel" TEXT,
    "formaPagamento" TEXT NOT NULL,
    "ultimoWebhookEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asaas_cobrancas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos_saas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "taxaSetup" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "mensalidadeBase" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "limiteMembros" INTEGER,
    "percentualReceita" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planos_saas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faturas_saas" (
    "id" TEXT NOT NULL,
    "cooperativaId" TEXT NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "valorBase" DECIMAL(10,2) NOT NULL,
    "valorReceita" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "dataPagamento" TIMESTAMP(3),
    "asaasCobrancaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faturas_saas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelos_documento" (
    "id" TEXT NOT NULL,
    "cooperativaId" TEXT,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "variaveis" TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isPadrao" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modelos_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_indicacoes" (
    "id" TEXT NOT NULL,
    "cooperativaId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "maxNiveis" INTEGER NOT NULL DEFAULT 2,
    "modalidade" TEXT NOT NULL DEFAULT 'PERCENTUAL_PRIMEIRA_FATURA',
    "niveisConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_indicacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicacoes" (
    "id" TEXT NOT NULL,
    "cooperativaId" TEXT NOT NULL,
    "cooperadoIndicadorId" TEXT NOT NULL,
    "cooperadoIndicadoId" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "primeiraFaturaPagaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficios_indicacao" (
    "id" TEXT NOT NULL,
    "indicacaoId" TEXT NOT NULL,
    "cooperadoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valorCalculado" DECIMAL(10,2) NOT NULL,
    "valorAplicado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "saldoRestante" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "mesReferencia" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "cobrancaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficios_indicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversas_whatsapp" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'INICIAL',
    "dadosTemp" JSONB,
    "cooperativaId" TEXT,
    "cooperadoId" TEXT,
    "mlmConviteEnviadoEm" TIMESTAMP(3),
    "contadorFallback" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversas_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_whatsapp" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "direcao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'texto',
    "conteudo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ENVIADA',
    "enviadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregueEm" TIMESTAMP(3),
    "lidaEm" TIMESTAMP(3),
    "respondidaEm" TIMESTAMP(3),
    "disparoId" TEXT,
    "tipoDisparo" TEXT,
    "cooperadoId" TEXT,
    "cooperativaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mensagens_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelos_mensagem" (
    "id" TEXT NOT NULL,
    "cooperativaId" TEXT,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "usosCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modelos_mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fluxo_etapas" (
    "id" TEXT NOT NULL,
    "cooperativaId" TEXT,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "estado" TEXT NOT NULL,
    "modeloMensagemId" TEXT,
    "gatilhos" JSONB NOT NULL,
    "timeoutHoras" INTEGER,
    "modeloFollowupId" TEXT,
    "acaoAutomatica" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fluxo_etapas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_notificacao_cobranca" (
    "id" TEXT NOT NULL,
    "cooperativaId" TEXT,
    "tipo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "diasReferencia" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_notificacao_cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listas_contatos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "cooperativaId" TEXT,
    "telefones" TEXT[],
    "cooperadoIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listas_contatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "administradoras" (
    "id" TEXT NOT NULL,
    "cooperativaId" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnpj" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "responsavelNome" TEXT NOT NULL,
    "responsavelCpf" TEXT,
    "responsavelEmail" TEXT,
    "responsavelTelefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "administradoras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condominios" (
    "id" TEXT NOT NULL,
    "cooperativaId" TEXT,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "endereco" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "cep" TEXT,
    "administradoraId" TEXT,
    "sindicoNome" TEXT,
    "sindicoCpf" TEXT,
    "sindicoEmail" TEXT,
    "sindicoTelefone" TEXT,
    "modeloRateio" TEXT NOT NULL DEFAULT 'PROPORCIONAL_CONSUMO',
    "excedentePolitica" TEXT NOT NULL DEFAULT 'CREDITO_PROXIMO_MES',
    "excedentePixChave" TEXT,
    "excedentePixTipo" TEXT,
    "aliquotaIR" DOUBLE PRECISION,
    "aliquotaPIS" DOUBLE PRECISION,
    "aliquotaCOFINS" DOUBLE PRECISION,
    "taxaAdministrativa" DOUBLE PRECISION,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "condominios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades_condominio" (
    "id" TEXT NOT NULL,
    "condominioId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "cooperadoId" TEXT,
    "fracaoIdeal" DOUBLE PRECISION,
    "percentualFixo" DOUBLE PRECISION,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "unidades_condominio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_clube_vantagens" (
    "id" TEXT NOT NULL,
    "cooperativaId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "criterio" TEXT NOT NULL DEFAULT 'KWH_INDICADO_ACUMULADO',
    "niveisConfig" JSONB NOT NULL DEFAULT '[]',
    "bonusAniversario" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "config_clube_vantagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progressoes_clube" (
    "id" TEXT NOT NULL,
    "cooperadoId" TEXT NOT NULL,
    "nivelAtual" TEXT NOT NULL DEFAULT 'BRONZE',
    "kwhIndicadoAcumulado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "indicadosAtivos" INTEGER NOT NULL DEFAULT 0,
    "receitaIndicados" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "beneficioPercentualAtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "beneficioReaisKwhAtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kwhIndicadoMes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mesReferenciaKwh" TEXT,
    "kwhIndicadoAno" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "anoReferenciaKwh" TEXT,
    "dataUltimaPromocao" TIMESTAMP(3),
    "dataUltimaAvaliacao" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progressoes_clube_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_progressao" (
    "id" TEXT NOT NULL,
    "progressaoId" TEXT NOT NULL,
    "nivelAnterior" TEXT NOT NULL,
    "nivelNovo" TEXT NOT NULL,
    "kwhAcumulado" DOUBLE PRECISION NOT NULL,
    "indicadosAtivos" INTEGER NOT NULL,
    "receitaAcumulada" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_progressao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observacoes_ativas" (
    "id" TEXT NOT NULL,
    "observadorId" TEXT NOT NULL,
    "observadoId" TEXT,
    "observadoTelefone" TEXT,
    "observadorTelefone" TEXT NOT NULL,
    "escopo" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "cooperativaId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observacoes_ativas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_observacao" (
    "id" TEXT NOT NULL,
    "observacaoId" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "detalhe" TEXT,
    "cooperativaId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_observacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transferencias_pix" (
    "id" TEXT NOT NULL,
    "cooperativaId" TEXT,
    "cooperadoId" TEXT,
    "condominioId" TEXT,
    "valorBruto" DECIMAL(10,2) NOT NULL,
    "aliquotaIR" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aliquotaPIS" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aliquotaCOFINS" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorImpostos" DECIMAL(10,2) NOT NULL,
    "valorLiquido" DECIMAL(10,2) NOT NULL,
    "pixChave" TEXT NOT NULL,
    "pixTipo" TEXT NOT NULL DEFAULT 'ALEATORIA',
    "mesReferencia" TEXT NOT NULL,
    "kwhExcedente" DOUBLE PRECISION NOT NULL,
    "tarifaKwh" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SIMULADO',
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transferencias_pix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migracoes_usina" (
    "id" TEXT NOT NULL,
    "cooperadoId" TEXT NOT NULL,
    "usinaOrigemId" TEXT,
    "usinaDestinoId" TEXT NOT NULL,
    "contratoAntigoId" TEXT NOT NULL,
    "contratoNovoId" TEXT NOT NULL,
    "kwhAnterior" DOUBLE PRECISION NOT NULL,
    "percentualAnterior" DOUBLE PRECISION NOT NULL,
    "kwhNovo" DOUBLE PRECISION NOT NULL,
    "percentualNovo" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'MUDANCA_USINA',
    "realizadoPorId" TEXT NOT NULL,
    "cooperativaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migracoes_usina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tipo" TEXT,
    "erro" TEXT,
    "cooperadoId" TEXT,
    "valorExtraido" DOUBLE PRECISION,
    "nomeRemetente" TEXT,
    "dataEmail" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads_expansao" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "nomeCompleto" TEXT,
    "distribuidora" TEXT NOT NULL,
    "cidade" TEXT,
    "estado" TEXT,
    "numeroUC" TEXT,
    "valorFatura" DECIMAL(10,2),
    "economiaEstimada" DECIMAL(10,2),
    "intencaoConfirmada" BOOLEAN NOT NULL DEFAULT false,
    "cooperativaId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AGUARDANDO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notificadoEm" TIMESTAMP(3),

    CONSTRAINT "leads_expansao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nps_respostas" (
    "id" TEXT NOT NULL,
    "cooperadoId" TEXT,
    "telefone" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nps_respostas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cooperativas_cnpj_key" ON "cooperativas"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_cpf_key" ON "usuarios"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_telefone_key" ON "usuarios"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_supabaseId_key" ON "usuarios"("supabaseId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_resetToken_key" ON "usuarios"("resetToken");

-- CreateIndex
CREATE UNIQUE INDEX "cooperados_cpf_key" ON "cooperados"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "cooperados_email_key" ON "cooperados"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cooperados_codigoIndicacao_key" ON "cooperados"("codigoIndicacao");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_cooperados_cooperadoId_tipo_key" ON "documentos_cooperados"("cooperadoId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "ucs_numero_key" ON "ucs"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_numero_key" ON "contratos"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "config_tenant_chave_key" ON "config_tenant"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "propostas_cooperado_tokenAprovacao_key" ON "propostas_cooperado"("tokenAprovacao");

-- CreateIndex
CREATE UNIQUE INDEX "propostas_cooperado_tokenAssinatura_key" ON "propostas_cooperado"("tokenAssinatura");

-- CreateIndex
CREATE UNIQUE INDEX "modelos_cobranca_config_nome_key" ON "modelos_cobranca_config"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_cobranca_cooperativaId_usinaId_key" ON "configuracoes_cobranca"("cooperativaId", "usinaId");

-- CreateIndex
CREATE UNIQUE INDEX "geracoes_mensais_usinaId_competencia_key" ON "geracoes_mensais"("usinaId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "lista_espera_contratoId_key" ON "lista_espera"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "usinas_monitoramento_config_usinaId_key" ON "usinas_monitoramento_config"("usinaId");

-- CreateIndex
CREATE INDEX "usinas_leituras_usinaId_timestamp_idx" ON "usinas_leituras"("usinaId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "plano_contas_codigo_key" ON "plano_contas"("codigo");

-- CreateIndex
CREATE INDEX "lancamentos_caixa_competencia_idx" ON "lancamentos_caixa"("competencia");

-- CreateIndex
CREATE INDEX "lancamentos_caixa_cooperativaId_competencia_idx" ON "lancamentos_caixa"("cooperativaId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_uso_numero_key" ON "contratos_uso"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_convenio_numero_key" ON "contratos_convenio"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "convenio_cooperados_convenioId_cooperadoId_key" ON "convenio_cooperados"("convenioId", "cooperadoId");

-- CreateIndex
CREATE UNIQUE INDEX "formas_pagamento_cooperado_cooperadoId_key" ON "formas_pagamento_cooperado"("cooperadoId");

-- CreateIndex
CREATE INDEX "cobrancas_bancarias_status_idx" ON "cobrancas_bancarias"("status");

-- CreateIndex
CREATE INDEX "cobrancas_bancarias_cooperadoId_idx" ON "cobrancas_bancarias"("cooperadoId");

-- CreateIndex
CREATE UNIQUE INDEX "asaas_configs_cooperativaId_key" ON "asaas_configs"("cooperativaId");

-- CreateIndex
CREATE UNIQUE INDEX "asaas_customers_cooperadoId_key" ON "asaas_customers"("cooperadoId");

-- CreateIndex
CREATE INDEX "asaas_cobrancas_cooperadoId_idx" ON "asaas_cobrancas"("cooperadoId");

-- CreateIndex
CREATE INDEX "asaas_cobrancas_status_idx" ON "asaas_cobrancas"("status");

-- CreateIndex
CREATE UNIQUE INDEX "faturas_saas_cooperativaId_competencia_key" ON "faturas_saas"("cooperativaId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "config_indicacoes_cooperativaId_key" ON "config_indicacoes"("cooperativaId");

-- CreateIndex
CREATE UNIQUE INDEX "conversas_whatsapp_telefone_key" ON "conversas_whatsapp"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_notificacao_cobranca_cooperativaId_tipo_key" ON "configuracoes_notificacao_cobranca"("cooperativaId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "config_clube_vantagens_cooperativaId_key" ON "config_clube_vantagens"("cooperativaId");

-- CreateIndex
CREATE UNIQUE INDEX "progressoes_clube_cooperadoId_key" ON "progressoes_clube"("cooperadoId");

-- AddForeignKey
ALTER TABLE "cooperativas" ADD CONSTRAINT "cooperativas_planoSaasId_fkey" FOREIGN KEY ("planoSaasId") REFERENCES "planos_saas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooperados" ADD CONSTRAINT "cooperados_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_cooperados" ADD CONSTRAINT "documentos_cooperados_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ucs" ADD CONSTRAINT "ucs_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usinas" ADD CONSTRAINT "usinas_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usinas" ADD CONSTRAINT "usinas_proprietarioCooperadoId_fkey" FOREIGN KEY ("proprietarioCooperadoId") REFERENCES "cooperados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_ucId_fkey" FOREIGN KEY ("ucId") REFERENCES "ucs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_usinaId_fkey" FOREIGN KEY ("usinaId") REFERENCES "usinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "planos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "propostas_cooperado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_geracaoMensalId_fkey" FOREIGN KEY ("geracaoMensalId") REFERENCES "geracoes_mensais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencias" ADD CONSTRAINT "ocorrencias_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencias" ADD CONSTRAINT "ocorrencias_ucId_fkey" FOREIGN KEY ("ucId") REFERENCES "ucs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocorrencias" ADD CONSTRAINT "ocorrencias_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "prestadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturas_processadas" ADD CONSTRAINT "faturas_processadas_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturas_processadas" ADD CONSTRAINT "faturas_processadas_ucId_fkey" FOREIGN KEY ("ucId") REFERENCES "ucs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_reajustes" ADD CONSTRAINT "historico_reajustes_tarifaId_fkey" FOREIGN KEY ("tarifaId") REFERENCES "tarifas_concessionaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propostas_cooperado" ADD CONSTRAINT "propostas_cooperado_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propostas_cooperado" ADD CONSTRAINT "propostas_cooperado_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "planos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracoes_cobranca" ADD CONSTRAINT "configuracoes_cobranca_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracoes_cobranca" ADD CONSTRAINT "configuracoes_cobranca_usinaId_fkey" FOREIGN KEY ("usinaId") REFERENCES "usinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geracoes_mensais" ADD CONSTRAINT "geracoes_mensais_usinaId_fkey" FOREIGN KEY ("usinaId") REFERENCES "usinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_espera" ADD CONSTRAINT "lista_espera_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_espera" ADD CONSTRAINT "lista_espera_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestadores" ADD CONSTRAINT "prestadores_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usinas_monitoramento_config" ADD CONSTRAINT "usinas_monitoramento_config_usinaId_fkey" FOREIGN KEY ("usinaId") REFERENCES "usinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usinas_monitoramento_config" ADD CONSTRAINT "usinas_monitoramento_config_prestadorPadraoId_fkey" FOREIGN KEY ("prestadorPadraoId") REFERENCES "prestadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usinas_leituras" ADD CONSTRAINT "usinas_leituras_usinaId_fkey" FOREIGN KEY ("usinaId") REFERENCES "usinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usinas_alertas" ADD CONSTRAINT "usinas_alertas_usinaId_fkey" FOREIGN KEY ("usinaId") REFERENCES "usinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_caixa" ADD CONSTRAINT "lancamentos_caixa_planoContasId_fkey" FOREIGN KEY ("planoContasId") REFERENCES "plano_contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_caixa" ADD CONSTRAINT "lancamentos_caixa_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_caixa" ADD CONSTRAINT "lancamentos_caixa_contratoUsoId_fkey" FOREIGN KEY ("contratoUsoId") REFERENCES "contratos_uso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_caixa" ADD CONSTRAINT "lancamentos_caixa_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "contratos_convenio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_uso" ADD CONSTRAINT "contratos_uso_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_uso" ADD CONSTRAINT "contratos_uso_usinaId_fkey" FOREIGN KEY ("usinaId") REFERENCES "usinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convenio_cooperados" ADD CONSTRAINT "convenio_cooperados_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "contratos_convenio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convenio_cooperados" ADD CONSTRAINT "convenio_cooperados_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formas_pagamento_cooperado" ADD CONSTRAINT "formas_pagamento_cooperado_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas_bancarias" ADD CONSTRAINT "cobrancas_bancarias_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "cobrancas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas_bancarias" ADD CONSTRAINT "cobrancas_bancarias_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas_bancarias" ADD CONSTRAINT "cobrancas_bancarias_configuracaoId_fkey" FOREIGN KEY ("configuracaoId") REFERENCES "configuracoes_bancarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asaas_configs" ADD CONSTRAINT "asaas_configs_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asaas_customers" ADD CONSTRAINT "asaas_customers_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asaas_cobrancas" ADD CONSTRAINT "asaas_cobrancas_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "cobrancas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asaas_cobrancas" ADD CONSTRAINT "asaas_cobrancas_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturas_saas" ADD CONSTRAINT "faturas_saas_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelos_documento" ADD CONSTRAINT "modelos_documento_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_indicacoes" ADD CONSTRAINT "config_indicacoes_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicacoes" ADD CONSTRAINT "indicacoes_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicacoes" ADD CONSTRAINT "indicacoes_cooperadoIndicadorId_fkey" FOREIGN KEY ("cooperadoIndicadorId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicacoes" ADD CONSTRAINT "indicacoes_cooperadoIndicadoId_fkey" FOREIGN KEY ("cooperadoIndicadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficios_indicacao" ADD CONSTRAINT "beneficios_indicacao_indicacaoId_fkey" FOREIGN KEY ("indicacaoId") REFERENCES "indicacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficios_indicacao" ADD CONSTRAINT "beneficios_indicacao_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficios_indicacao" ADD CONSTRAINT "beneficios_indicacao_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "cobrancas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracoes_notificacao_cobranca" ADD CONSTRAINT "configuracoes_notificacao_cobranca_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "administradoras" ADD CONSTRAINT "administradoras_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condominios" ADD CONSTRAINT "condominios_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condominios" ADD CONSTRAINT "condominios_administradoraId_fkey" FOREIGN KEY ("administradoraId") REFERENCES "administradoras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_condominio" ADD CONSTRAINT "unidades_condominio_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "condominios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_condominio" ADD CONSTRAINT "unidades_condominio_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_clube_vantagens" ADD CONSTRAINT "config_clube_vantagens_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progressoes_clube" ADD CONSTRAINT "progressoes_clube_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_progressao" ADD CONSTRAINT "historico_progressao_progressaoId_fkey" FOREIGN KEY ("progressaoId") REFERENCES "progressoes_clube"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observacoes_ativas" ADD CONSTRAINT "observacoes_ativas_observadorId_fkey" FOREIGN KEY ("observadorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_observacao" ADD CONSTRAINT "logs_observacao_observacaoId_fkey" FOREIGN KEY ("observacaoId") REFERENCES "observacoes_ativas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_pix" ADD CONSTRAINT "transferencias_pix_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_pix" ADD CONSTRAINT "transferencias_pix_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_pix" ADD CONSTRAINT "transferencias_pix_condominioId_fkey" FOREIGN KEY ("condominioId") REFERENCES "condominios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migracoes_usina" ADD CONSTRAINT "migracoes_usina_cooperadoId_fkey" FOREIGN KEY ("cooperadoId") REFERENCES "cooperados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migracoes_usina" ADD CONSTRAINT "migracoes_usina_cooperativaId_fkey" FOREIGN KEY ("cooperativaId") REFERENCES "cooperativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

