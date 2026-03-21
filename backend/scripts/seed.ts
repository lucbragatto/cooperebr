import { PrismaClient, ModeloCobranca, PerfilUsuario } from '@prisma/client';

const prisma = new PrismaClient();

// ===========================================================================
// DADOS REAIS - Extraidos de Relatorio.xlsx e demonstrativo-mmgd-100004112853.pdf
// ===========================================================================

interface CooperadoData {
  cpf: string; nome: string; email: string; telefone: string;
  endereco: string; complemento: string; cep: string; bairro: string;
  cidade: string; estado: string; ucNumero: string; codIdentificacao: string;
  numeroInstalacao: string; grupoSubgrupo: string; classeSubclasse: string;
  tipoFornecimento: string; modalidadeTarifaria: string; tensaoNominal: string;
  numeroMedidor: string; plano: string; valorPlano: string; ativo: boolean;
}

const COOPERADOS_DATA: CooperadoData[] = [
  { cpf: '98572652787', nome: 'ADRIANA MARIA ALMENARA ZAMBON', email: 'Adri.zambon@hotmail.com', telefone: '(27)99274-1005', endereco: 'RUA JOAQUIM LIRIO 366', complemento: 'AP 1601 ED JAZZ RESIDENCE', cep: '29055460', bairro: 'PRAIA DO CANTO', cidade: 'VITORIA', estado: 'ES', ucNumero: '0450023484', codIdentificacao: '0450023484', numeroInstalacao: '160022301', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: 'ECU89939', plano: 'PLANO OURO', valorPlano: '446.72', ativo: true },
  { cpf: '27268077000101', nome: 'AESMP - Associação Espírito Santense do Ministério Público', email: 'secretaria@aesmp.org.br', telefone: '(27)99903-7503', endereco: 'RUA PRFA EMILIA FRANKLIN MOLULO 154', complemento: '', cep: '29050730', bairro: 'BENTO FERREIRA', cidade: 'VITORIA', estado: 'ES', ucNumero: '401729309', codIdentificacao: '401729309', numeroInstalacao: '1161793', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '12919968', plano: 'PLANO OURO', valorPlano: '1553.6', ativo: true },
  { cpf: '79022596753', nome: 'AGOSTINHO SOBRAL SAMPAIO', email: 'agsobral@gmail.com', telefone: '(27)98114-3072', endereco: 'AL HELIO DA COSTA FERRAZ 145', complemento: 'AP 1601 ED CARRARA DE D ITALIA', cep: '29055090', bairro: '29055-090 SANTA HELENA', cidade: 'VITORIA', estado: 'ES', ucNumero: '0160005888', codIdentificacao: '', numeroInstalacao: '0160005888', grupoSubgrupo: 'B1-RESIDENCIAL', classeSubclasse: 'B', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '407.54', ativo: true },
  { cpf: '11041033702', nome: 'ALAOR DE QUEIROZ ARAUJO NETO', email: 'alaorqueirozneto@gmail.com', telefone: '(27)99729-7495', endereco: 'RUA CONSTANTE SODRE 1001', complemento: 'AP 802 ED ISLA BONITA', cep: '29057545', bairro: 'BARRO VERMELHO', cidade: 'VITORIA', estado: 'ES', ucNumero: '0450266296', codIdentificacao: '0450266296', numeroInstalacao: '1814671', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'BIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '15422363', plano: 'PLANO OURO', valorPlano: '245.88', ativo: true },
  { cpf: '19027605734', nome: 'ALICE ESPINDULA WANDERLEY', email: 'alicewanderley@hotmail.com', telefone: '(27)99971-7430', endereco: 'RUA JOAQUIM LIRIO 366', complemento: 'AP 1501 ED JAZZ', cep: '29055460', bairro: '', cidade: '', estado: 'ES', ucNumero: '0160060615', codIdentificacao: '', numeroInstalacao: '0160060615', grupoSubgrupo: 'B1-RESIDENCIAL', classeSubclasse: 'B', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO PRATA', valorPlano: '88.0', ativo: true },
  { cpf: '31726470725', nome: 'ANA MARIA MAI', email: 'maianamai55@gmail.com', telefone: '(27)99961-5422', endereco: 'RUA VINICIUS TORRES 296', complemento: 'AP 701 ED PARK LANE', cep: '29101105', bairro: 'PRAIA DA COSTA', cidade: 'VILA VELHA', estado: 'ES', ucNumero: '401041919', codIdentificacao: '401041919', numeroInstalacao: '659823', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '13716585', plano: 'PLANO OURO', valorPlano: '365.73', ativo: true },
  { cpf: '00075810760', nome: 'ANDERSON FERREIRA SALLES', email: 'anderson@sallescontabilidade.com.br', telefone: '(27)99960-9181', endereco: 'RUA JOAQUIM LIRIO 366', complemento: 'AP 1001 ED JAZZ RESIDENCE', cep: '29055460', bairro: 'PRAIA DO CANTO', cidade: 'VITORIA', estado: 'ES', ucNumero: '0401361132', codIdentificacao: '0401361132', numeroInstalacao: '160004452', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: 'ECY90157', plano: 'PLANO OURO', valorPlano: '373.47', ativo: true },
  { cpf: '07761647755', nome: 'ANDRE VERVLOET COMERIO', email: 'andrevervloet@comerio.com.br', telefone: '(27)99311-8021', endereco: 'RUA AURORA DE AGUIAR FERREIRA 154', complemento: 'AP 303 ED BERGAMO', cep: '29090310', bairro: 'JARDIM CAMBURI', cidade: 'VITORIA', estado: 'ES', ucNumero: '450187562', codIdentificacao: '450187562', numeroInstalacao: '1680471', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'BIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '15770047', plano: 'PLANO OURO', valorPlano: '479.76', ativo: true },
  { cpf: '66172012720', nome: 'ANTONIO CARLOS GOMES', email: 'fergomg@gmail.com', telefone: '(27)98811-3578', endereco: 'RUA CONSTANTE SODRE 1001', complemento: 'AP 1902 ED ISLA BONITA', cep: '29057545', bairro: 'BARRO VERMELHO', cidade: 'VITORIA', estado: 'ES', ucNumero: '0400776260', codIdentificacao: '0400776260', numeroInstalacao: '0001886303', grupoSubgrupo: 'B1-RESIDENCIAL', classeSubclasse: 'B', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '523.81', ativo: true },
  { cpf: '11680993747', nome: 'ARTHUR DUBBERSTEIN GASPERAZZO', email: 'financeirogasperazo@gmail.com', telefone: '(27)99697-4411', endereco: 'RUA DONA MARIA ROSA 425', complemento: '', cep: '29045270', bairro: 'SANTA LUIZA', cidade: 'VITORIA', estado: 'ES', ucNumero: '450568495', codIdentificacao: '450568495', numeroInstalacao: '161025298', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '16296608', plano: 'PLANO OURO', valorPlano: '1183.42', ativo: true },
  { cpf: '02497358000105', nome: 'ASSEJUFES - Associacao dos Servidores da Justica Federal', email: 'assejufes@assejufes.org.br', telefone: '(27)99892-4545', endereco: 'RUA AMERICO LOSS S/N RETIRO DO CONGO / VILA VELHA - ES CEP: 29130-368 - Inst.1154733', complemento: 'JUSTIÇA FEDERAL   25 TERREO', cep: '29130368', bairro: 'RETIRO DO CONGO', cidade: 'VILA VELHA', estado: 'ES', ucNumero: '0400419619', codIdentificacao: '0400419619', numeroInstalacao: '1154733', grupoSubgrupo: 'B - B3', classeSubclasse: 'COMERCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '15460372', plano: 'PLANO OURO', valorPlano: '1348.75', ativo: true },
  { cpf: '13499059762', nome: 'BRENO FARDIN STORARI', email: 'bs@almadaes.com.br', telefone: '(27)99735-6607', endereco: 'RUA CONSTANTE SODRE 476', complemento: 'AP 1106 ED STUDIO VITORIA', cep: '29056310', bairro: '29056-310 SANTA LUCIA', cidade: 'VITORIA', estado: 'ES', ucNumero: '0001504249', codIdentificacao: '', numeroInstalacao: '0001504249', grupoSubgrupo: 'B1-RESIDENCIAL', classeSubclasse: 'B', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '470.11', ativo: true },
  { cpf: '07263192799', nome: 'CELIO DE CARVALHO CAVALCANTI NETO', email: 'celio@cavalcantineto.com.br', telefone: '(27)99989-1823', endereco: 'RUA PROCURADOR ANTÔNIO BENEDICTO AMANCIO PEREIRA 275', complemento: '240 229050-265 ENSEADA DO SUA / VITORIA - E', cep: '29050265', bairro: 'Enseada do Suá', cidade: 'Vitória', estado: 'ES', ucNumero: '0160315053', codIdentificacao: '', numeroInstalacao: '0160315053', grupoSubgrupo: '', classeSubclasse: '', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '905.74', ativo: true },
  { cpf: '10286244764', nome: 'CESAR NASSER FONSECA', email: 'cnfonseca@mpes.mp.br', telefone: '(27)99933-5544', endereco: 'AV ANTONIO GIL VELOSO 1040', complemento: 'AP 701 ED AMAZONIA', cep: '29101014', bairro: 'PRAIA DA COSTA', cidade: 'VILA VELHA', estado: 'ES', ucNumero: '450577503', codIdentificacao: '450577503', numeroInstalacao: '914621', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '15717966', plano: 'PLANO OURO', valorPlano: '507.09', ativo: true },
  { cpf: '01771095725', nome: 'CLAUDIO MOACYR MANHAES VENANCIO', email: 'contasapagar@cdcacabamentos.com.br', telefone: '(11)95382-2691', endereco: 'RUA CELSO CALMON 300', complemento: '300 AP 1401', cep: '29055590', bairro: 'PRAIA DO CANTO', cidade: 'VITORIA', estado: 'ES', ucNumero: '450925762', codIdentificacao: '450925762', numeroInstalacao: '160938300', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '13563937', plano: 'PLANO OURO', valorPlano: '607.88', ativo: true },
  { cpf: '73439681653', nome: 'CLAUDIO RODRIGUES COSTA', email: 'claudiocosta94@gmail.com', telefone: '(27)99692-3012', endereco: 'Rua Linhares, Terra Vermelha', complemento: 'RUA LINHARES 33 SITIO', cep: '29127206', bairro: 'Terra Vermelha', cidade: 'Vila Velha', estado: 'Es', ucNumero: '0001300248', codIdentificacao: '', numeroInstalacao: '0001300248', grupoSubgrupo: '', classeSubclasse: '', tipoFornecimento: '', modalidadeTarifaria: '', tensaoNominal: '', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '453.7', ativo: true },
  { cpf: '10447823000113', nome: 'COMERCIO DE MEIAS CARIOCA LTDA', email: 'fgcs82@yahoo.com.br', telefone: '(27)99980-1342', endereco: 'RUA CHAPOT PRESVOT 230', complemento: 'LJ 01', cep: '29055410', bairro: '29055-410 PRAIA DO CANTO', cidade: 'VITORIA', estado: 'ES', ucNumero: '0001247613', codIdentificacao: '', numeroInstalacao: '0001247613', grupoSubgrupo: 'B3-COMERCIAL', classeSubclasse: 'B', tipoFornecimento: 'BIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '415.31', ativo: true },
  { cpf: '36044568000151', nome: 'CONDOMINIO DO EDIFICIO CHURCHILL S', email: 'comdominioedchurchil@gmail.com', telefone: '(27)99601-7680', endereco: 'AVENIDA REPÚBLICA 266', complemento: 'CONDOMINIO , ED CHURCHIL PARQUE MOSCOSO', cep: '29018310', bairro: 'Parque Moscoso', cidade: 'Vitória', estado: 'ES', ucNumero: '16052024', codIdentificacao: '', numeroInstalacao: '16052024', grupoSubgrupo: 'B3-COMERCIAL', classeSubclasse: 'B', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '1279.67', ativo: true },
  { cpf: '13386498000114', nome: 'CONDOMINIO DO EDIFICIO COSTA DO ATLANTICO', email: 'costadoatlantico55@gmail.com', telefone: '(27)99920-2110', endereco: 'RUA JOAO JOAQUIM DA MOTA 55', complemento: 'CONDO ED RESID COSTA DO ATLANTICO', cep: '29101200', bairro: 'PRAIA DA COSTA', cidade: 'VILA VELHA', estado: 'ES', ucNumero: '0450153793', codIdentificacao: '0450153793', numeroInstalacao: '160133220', grupoSubgrupo: 'B - B3', classeSubclasse: 'COMERCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '12919731', plano: 'PLANO OURO', valorPlano: '1794.83', ativo: true },
  { cpf: '10396001000150', nome: 'CONDOMINIO DO EDIFICIO ISLA BONITA', email: 'islabonita638@gmail.com', telefone: '(27)98811-3578', endereco: 'RUA CONSTANTE SODRE 1001', complemento: 'CONDOMINIO , ED ISLA BONITA', cep: '29057545', bairro: 'BARRO VERMELHO', cidade: 'VITORIA', estado: 'ES', ucNumero: '402516347', codIdentificacao: '402516347', numeroInstalacao: '1750176', grupoSubgrupo: 'B - B3', classeSubclasse: 'COMERCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: 'ECU48226', plano: 'PLANO OURO', valorPlano: '2018.61', ativo: true },
  { cpf: '31751472000100', nome: 'CONDOMINIO DO EDIFICIO JUAN LES PINS', email: 'condominio.juanlp@gmail.com', telefone: '(27)99746-6831', endereco: 'RUA JOAQUIM LÍRIO 340', complemento: 'CONDOMINIO CO PRAIA DO CANTO', cep: '29055460', bairro: 'Praia do Canto', cidade: 'Vitória', estado: 'ES', ucNumero: '0000506334', codIdentificacao: '', numeroInstalacao: '0000506334', grupoSubgrupo: 'B3-COMERCIAL', classeSubclasse: 'B', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '2096.71', ativo: true },
  { cpf: '41604843000184', nome: 'COOPERE-BR', email: 'leonardo@gmail.com', telefone: '(11)95382-2691', endereco: '', complemento: '', cep: '', bairro: '', cidade: '', estado: 'ES', ucNumero: '161073905', codIdentificacao: '', numeroInstalacao: '161073905', grupoSubgrupo: '', classeSubclasse: '', tipoFornecimento: '', modalidadeTarifaria: '', tensaoNominal: '', numeroMedidor: '', plano: '', valorPlano: '0.0', ativo: true },
  { cpf: '07762770739', nome: 'DEBORA GUERRA MAIA COELHO DIAS', email: 'wiler@murtaecoelho.adv.br', telefone: '(27)98111-4434', endereco: 'RUA JOAQUIM LÍRIO 340', complemento: '1102 JUAN LES P INS29055-460 PRAIA DO CANTO / VITORIA -', cep: '29055460', bairro: 'Praia do Canto', cidade: 'Vitória', estado: 'ES', ucNumero: '0000506343', codIdentificacao: '', numeroInstalacao: '0000506343', grupoSubgrupo: '', classeSubclasse: '', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '632.9', ativo: true },
  { cpf: '46416512000134', nome: 'EXFISHES TERMINAL PESQUEIRO SPE LTDA', email: 'exfishesadm@gmail.com', telefone: '(27)99704-7671', endereco: 'RUA OSCAR PAULO DA SILVA 263', complemento: '', cep: '29052000', bairro: 'JESUS DE NAZARETH', cidade: 'VITORIA', estado: 'ES', ucNumero: '451084363', codIdentificacao: '451084363', numeroInstalacao: '1731543', grupoSubgrupo: 'B - B3', classeSubclasse: 'COMERCIAL - SERV. DE', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '380 / 220 V', numeroMedidor: '14566527', plano: 'PLANO OURO', valorPlano: '51000.0', ativo: true },
  { cpf: '10468047000138', nome: 'FCF PARTICIPACOES E INVESTIMENTOS LTDA', email: 'anatiara@macroinvestimentos.com', telefone: '(27)99865-5302', endereco: '41 SL701  ED PALACIO DA ENSEADA', complemento: '41 SL701  ED PALACIO DA ENSEADA', cep: '', bairro: '', cidade: '', estado: 'ES', ucNumero: '801541', codIdentificacao: '', numeroInstalacao: '801541', grupoSubgrupo: '', classeSubclasse: '', tipoFornecimento: '', modalidadeTarifaria: '', tensaoNominal: '', numeroMedidor: '', plano: 'CONSUMO DE CRÉDITOS DE KWH', valorPlano: '0.0', ativo: true },
  { cpf: '44545723000141', nome: 'GRAO DA TERRA CAFETERIA LTDA', email: 'Merylin@comerio.com.br', telefone: '(27)99311-8021', endereco: 'AVENIDA NOSSA SENHORA DA PENHA 595', complemento: 'BOX3 , E D TIFFANY CENTER 1E29055-131 SANTA LUCI', cep: '29055131', bairro: 'Praia do Canto', cidade: 'Espírito Santo', estado: 'ES', ucNumero: '0001018125', codIdentificacao: '', numeroInstalacao: '0001018125', grupoSubgrupo: 'B3-COMERCIAL', classeSubclasse: 'B', tipoFornecimento: 'BIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '688.41', ativo: true },
  { cpf: '12211493777', nome: 'HILARIO FAVARATO NETO', email: 'hilariofavarato@hotmail.com', telefone: '(27)99988-0299', endereco: 'RUA CONSTANTE SODRE 1001', complemento: 'AP 602 ED ISLA BONITA', cep: '29057545', bairro: 'BARRO VERMELHO', cidade: 'VITORIA', estado: 'ES', ucNumero: '0401708917', codIdentificacao: '0401708917', numeroInstalacao: '1817495', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'BIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '16229897', plano: 'PLANO OURO', valorPlano: '431.25', ativo: true },
  { cpf: '00471823000103', nome: 'HIMALAIA CONSTRUTORA LTDA ME ME', email: 'administracao@himalaiaar.com.br', telefone: '(27)99704-7671', endereco: '', complemento: '242', cep: '', bairro: '', cidade: '', estado: 'ES', ucNumero: '0000979099', codIdentificacao: '', numeroInstalacao: '0000979099', grupoSubgrupo: '', classeSubclasse: '', tipoFornecimento: '', modalidadeTarifaria: '', tensaoNominal: '', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '2690.04', ativo: true },
  { cpf: '11979176752', nome: 'IGOR ARANTES SCHIRMER', email: 'igor_aschirmer@hotmail.com', telefone: '(27)99909-4669', endereco: 'AV SATURNINO DE BRITO 419', complemento: 'AP 701', cep: '29055215', bairro: 'PRAIA DO CANTO', cidade: 'VITORIA', estado: 'ES', ucNumero: '450823195', codIdentificacao: '450823195', numeroInstalacao: '3147', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '15348308', plano: 'PLANO OURO', valorPlano: '239.17', ativo: true },
  { cpf: '07640326745', nome: 'ISABELA DE DEUS CORDEIRO', email: 'isabeladedeus@hotmail.com', telefone: '(27)99988-0124', endereco: 'RUA JOAQUIM LIRIO 366', complemento: 'AP 1901 ED JAZZ RESIDENCE', cep: '29055460', bairro: 'PRAIA DO CANTO', cidade: 'VITORIA', estado: 'ES', ucNumero: '0402724839', codIdentificacao: '0402724839', numeroInstalacao: '160008012', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '15057571', plano: 'PLANO OURO', valorPlano: '166.89', ativo: true },
  { cpf: '75467887734', nome: 'JACQUELINE MARIA BELIZARIO', email: 'belizariocouto@gmail.com', telefone: '(27)99984-2718', endereco: 'PCA NESTOR GOMES 208AP', complemento: '202 ED MARIA FER NANDA29900-300 CENTRO / LINHARES - ES', cep: '29050310', bairro: '', cidade: '', estado: 'ES', ucNumero: '0000602145', codIdentificacao: '', numeroInstalacao: '0000602145', grupoSubgrupo: '', classeSubclasse: '', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '259.83', ativo: true },
  { cpf: '08457470701', nome: 'JESUINO PEREIRA DO NASCIMENTO JUNIOR', email: 'bruno.fachetti.n@gmail.com', telefone: '(27)99849-9319', endereco: 'RUA ARQUITETO DÉCIO THEVENARD 185', complemento: 'JARDIM CAMBURI', cep: '29090585', bairro: 'Jardim Camburi', cidade: 'Vitória', estado: 'ES', ucNumero: '0000771954', codIdentificacao: '', numeroInstalacao: '0000771954', grupoSubgrupo: 'B3-COMERCIAL', classeSubclasse: 'B', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '6264.72', ativo: true },
  { cpf: '02775254705', nome: 'JORGE CRISPINIANO VIEIRA DA SILVA', email: 'jorgecrispiniano1973@gmail.com', telefone: '(27)99949-8516', endereco: 'AV DR HERWAN MODENESE WANDERLEY 55', complemento: 'BL A3 AP 904 ED BARRA DO PORTO', cep: '29092095', bairro: 'JARDIM CAMBURI', cidade: 'VITORIA', estado: 'ES', ucNumero: '0450298332', codIdentificacao: '0450298332', numeroInstalacao: '1111708', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'MONOFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '127 V', numeroMedidor: '15862586', plano: 'PLANO OURO', valorPlano: '147.78', ativo: true },
  { cpf: '03476152790', nome: 'LAUANDA ABDALA BRANDAO DA COSTA', email: 'lauabdala@gmail.com', telefone: '(27)99824-3321', endereco: 'RUA THEREZA ZANONI CASER 75', complemento: 'CX 02 PONTAL DE CAMBURI / VITORIA - ES', cep: '29062190', bairro: '', cidade: '', estado: 'ES', ucNumero: '0450326124', codIdentificacao: '0450326124', numeroInstalacao: '0000989144', grupoSubgrupo: 'B1-RESIDENCIAL', classeSubclasse: 'B', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '2850.58', ativo: true },
  { cpf: '95966471568', nome: 'LEONARDO AUGUSTO DE ANDRADE CEZAR DOS SANTOS', email: 'jtslaacs@gmail.com', telefone: '(27)98155-6798', endereco: 'AV NS DOS NAVEGANTES 581', complemento: 'BL 01 - AP 1401 ED GRAND PARC', cep: '29050335', bairro: 'ENSEADA DO SUA', cidade: 'VITORIA', estado: 'ES', ucNumero: '0450859617', codIdentificacao: '0450859617', numeroInstalacao: '160142276', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '15868977', plano: 'PLANO OURO', valorPlano: '401.13', ativo: true },
  { cpf: '05525961750', nome: 'LEONARDO CAPUCHO PISSINATI', email: 'leocapucho13@gmail.com', telefone: '(27)99920-2110', endereco: 'RUA JOAO JOAQUIM DA MOTA 55', complemento: 'AP 102 ED RESID COSTA DO ATLANTICO', cep: '29101200', bairro: 'PRAIA DA COSTA', cidade: 'VILA VELHA', estado: 'ES', ucNumero: '0450200379', codIdentificacao: '0450200379', numeroInstalacao: '0160133222', grupoSubgrupo: 'B1-RESIDENCIAL', classeSubclasse: 'B', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '204.0', ativo: true },
  { cpf: '01691220779', nome: 'LETICIA ROSA DA SILVA', email: 'leticiarsmp@gmail.com', telefone: '(27)99927-0363', endereco: 'AV HUGO MUSSO 1554', complemento: 'AP 604 ED AMAZONIA PLACE RIO NEGRO', cep: '29101934', bairro: '29101-934 PRAIA DE ITAPOA', cidade: 'VILA VELHA', estado: 'ES', ucNumero: '0000927240', codIdentificacao: '', numeroInstalacao: '0000927240', grupoSubgrupo: 'B1-RESIDENCIAL', classeSubclasse: 'B', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '668.68', ativo: true },
  { cpf: '03972327722', nome: 'LIBORIO MULE JUNIOR', email: 'liborio@grupolmule.com.br', telefone: '(27)99909-9578', endereco: 'AV SATURNINO DE BRITO 583', complemento: 'ED JEQUITIBÁ AP 301', cep: '29055215', bairro: 'PRAIA DO CANTO', cidade: 'VITORIA', estado: 'ES', ucNumero: '450333183', codIdentificacao: '450333183', numeroInstalacao: '160112369', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '15596273', plano: 'PLANO OURO', valorPlano: '1240.4', ativo: true },
  { cpf: '10432346759', nome: 'LIVIA DE MORAES CARAO', email: 'liviamcarao@gmail.com', telefone: '(27)99982-5189', endereco: 'RUA ELESBAO LINHARES 420', complemento: 'AP 701 CASBAH PRAIA DO CANTO / VITORIA - ES', cep: '29055340', bairro: '', cidade: '', estado: 'ES', ucNumero: '0402269326', codIdentificacao: '0402269326', numeroInstalacao: '0000506114', grupoSubgrupo: 'B1-RESIDENCIAL', classeSubclasse: 'B', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '546.06', ativo: true },
  { cpf: '89089324704', nome: 'LUCIANO COSTA BRAGATTO', email: 'lucbragatto@gmail.com', telefone: '(27)98134-1348', endereco: 'RUA JOAQUIM LIRIO 366 AP 501 ED JAZZ RESIDENCE PRAIA DO CANTO / VITORIA - ES CEP: 29055-460', complemento: 'AP 104A ED MORADAS DA ENSEADA', cep: '29055460', bairro: 'PRAIA DO CANTO', cidade: 'VITORIA', estado: 'ES', ucNumero: '0400702214', codIdentificacao: '0400702214', numeroInstalacao: '160085263', grupoSubgrupo: 'B1-RESIDENCIAL', classeSubclasse: 'B', tipoFornecimento: 'BIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '0.0', ativo: true },
  { cpf: '98556800734', nome: 'MACARIO RAMOS JUDICE NETO', email: 'doctorjudice0@gmail.com', telefone: '(27)99788-3442', endereco: 'RUA JOAQUIM LIRIO 340', complemento: 'AP 1202 JUAN LES PINS', cep: '29055460', bairro: 'PRAIA DO CANTO', cidade: 'VITORIA', estado: 'ES', ucNumero: '400614422', codIdentificacao: '400614422', numeroInstalacao: '506345', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: 'ECJ88450', plano: 'PLANO OURO', valorPlano: '683.58', ativo: true },
  { cpf: '03484689706', nome: 'MARCELO PAIVA PEDRA', email: 'mpedra@mpes.mp.br', telefone: '(27)98819-4979', endereco: 'RUA CARLOS NICOLETTI MADEIRA 60', complemento: 'BL04 AP 503 ED LUCERNA - RESID VILA ALPINA', cep: '29057520', bairro: 'BARRO VERMELHO', cidade: 'VITORIA', estado: 'ES', ucNumero: '0402437831', codIdentificacao: '0402437831', numeroInstalacao: '160220460', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '525.76', ativo: true },
  { cpf: '18378145115', nome: 'MARIA SALOME DIAS', email: 'teste001@sisgdsolar.com.br', telefone: '(11)95382-2691', endereco: 'Rua João da Cruz,Praia do Canto', complemento: '', cep: '29055620', bairro: 'Praia do Canto', cidade: 'Vitória', estado: 'Es', ucNumero: '789012345', codIdentificacao: '', numeroInstalacao: '789012345', grupoSubgrupo: '', classeSubclasse: '', tipoFornecimento: 'MONOFÁSICO', modalidadeTarifaria: '', tensaoNominal: '', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '65.25', ativo: true },
  { cpf: '14565684934', nome: 'MIGUEL JOSE BOABAID FILHO', email: 'miguel.boabaidneto@gmail.com', telefone: '(27)99793-7856', endereco: 'RUA ROMULO LEAO CASTELO 89', complemento: '', cep: '29052740', bairro: 'ILHA DO BOI', cidade: 'VITORIA', estado: 'ES', ucNumero: '402243140', codIdentificacao: '402243140', numeroInstalacao: '342', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: 'ECM65960', plano: 'PLANO OURO', valorPlano: '561.8', ativo: true },
  { cpf: '27557305000155', nome: 'OAB - Ordem dos Advogados do Brasil Seção Espírito Santo', email: 'carlos.torres@oabes.org.br', telefone: '(11)95382-2691', endereco: 'RUA ALBERTO DE OLIVEIRA SANTOS 59', complemento: 'SL 03', cep: '29010250', bairro: 'CENTRO', cidade: 'VITORIA', estado: 'ES', ucNumero: '402161889', codIdentificacao: '402161889', numeroInstalacao: '0001307969', grupoSubgrupo: 'OUTROS', classeSubclasse: 'COMERCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'VERDE', tensaoNominal: '', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '1471.27', ativo: true },
  { cpf: '05041933000140', nome: 'ODONTO-SCAN', email: 'financeiro1@odontoscan.com.br', telefone: '(27)99225-5216', endereco: 'RUA JOSE VIEIRA GOMES 15', complemento: 'SL 101 ED IZAIAS DE ANGELI', cep: '29146410', bairro: 'CAMPO GRANDE', cidade: 'CARIACICA', estado: 'ES', ucNumero: '450077658', codIdentificacao: '450077658', numeroInstalacao: '1383315', grupoSubgrupo: 'B - B3', classeSubclasse: 'COMERCIAL', tipoFornecimento: 'BIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '16250096', plano: 'PLANO OURO', valorPlano: '818.39', ativo: true },
  { cpf: '08263648700', nome: 'PATRICIA ALMEIDA DE MORAIS AMARAL', email: 'patriciamoraisamaral@hotmail.com', telefone: '(27)99907-9012', endereco: 'RUA JOAQUIM LIRIO 366', complemento: 'AP 701 ED JAZZ RESIDENCE', cep: '29055460', bairro: 'PRAIA DO CANTO', cidade: 'VITORIA', estado: 'ES', ucNumero: '0450710098', codIdentificacao: '0450710098', numeroInstalacao: '160017163', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: 'ECY15516', plano: 'PLANO OURO', valorPlano: '88.0', ativo: true },
  { cpf: '57738300787', nome: 'PAULO SERGIO RAMOS NICOLAO', email: 'psrnicolao@gmail.com', telefone: '(27)99982-9277', endereco: 'RUA CONSTANTE SODRE 1179', complemento: 'BL A2 AP 401 RESID VILLA MONTEMAGGI', cep: '29055420', bairro: 'PRAIA DO CANTO', cidade: 'VITÓRIA', estado: 'ES', ucNumero: '0402252348', codIdentificacao: '0402252348', numeroInstalacao: '1192170', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '17205402', plano: 'PLANO OURO', valorPlano: '360.12', ativo: true },
  { cpf: '03148788745', nome: 'ROBERTA LEITAO EPICHIN COSTA', email: 'rlepichin@gmail.com', telefone: '(27)98875-6040', endereco: 'Rua Constante Sodré, Praia do Canto', complemento: 'RUA CONSTANTE SODRE 1100 AP 601', cep: '29055420', bairro: 'Praia do Canto', cidade: 'Vitória', estado: 'Es', ucNumero: '0160004473', codIdentificacao: '', numeroInstalacao: '0160004473', grupoSubgrupo: '', classeSubclasse: '', tipoFornecimento: '', modalidadeTarifaria: '', tensaoNominal: '', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '945.0', ativo: true },
  { cpf: '09341568757', nome: 'ROBERTA ZAGO RABELO', email: 'robertazr@hotmail.com', telefone: '(27)99960-7077', endereco: 'AV RIO BRANCO 1512', complemento: 'AP 1601 ED LE BARON', cep: '29055642', bairro: 'PRAIA DO CANTO', cidade: 'VITORIA', estado: 'ES', ucNumero: '0402576025', codIdentificacao: '0402576025', numeroInstalacao: '1921337', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '15135988', plano: 'PLANO OURO', valorPlano: '262.38', ativo: true },
  { cpf: '07467220790', nome: 'RODRIGO PANDOLFI SARMENGHI', email: 'rodrigosarmenghi@hotmail.com', telefone: '(27)99972-4409', endereco: 'RUA JOAQUIM LIRIO 366', complemento: 'AP 401 ED JAZZ RESIDENCE', cep: '29055460', bairro: 'PRAIA DO CANTO', cidade: 'VITORIA', estado: 'ES', ucNumero: '0450686933', codIdentificacao: '0450686933', numeroInstalacao: '0160008791', grupoSubgrupo: 'B1-RESIDENCIAL', classeSubclasse: 'B', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '470.73', ativo: true },
  { cpf: '90461223791', nome: 'ROGERIO RODRIGUES DE ALMEIDA', email: 'rogerioralmeida@terra.com.br', telefone: '(27)98812-7511', endereco: 'RUA QUINZE DE NOVEMBRO 3', complemento: 'AP 602 CASTELO DE NAGOYA', cep: '29101045', bairro: 'PRAIA DA COSTA', cidade: 'VILA VELHA', estado: 'ES', ucNumero: '400717946', codIdentificacao: '400717946', numeroInstalacao: '585976', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '15720771', plano: 'PLANO OURO', valorPlano: '456.53', ativo: true },
  { cpf: '01730929770', nome: 'ROMERO BAPTISTA LOPES', email: 'romero@transjoia.com.br', telefone: '(27)99981-7560', endereco: 'RUA EUGENIO NETTO 239', complemento: 'AP 401 PORTOCALLE', cep: '29055275', bairro: 'PRAIA DO CANTO', cidade: 'VITORIA', estado: 'ES', ucNumero: '0401117398', codIdentificacao: '0401117398', numeroInstalacao: '4567', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '17181397', plano: 'PLANO OURO', valorPlano: '631.57', ativo: true },
  { cpf: '28482958000185', nome: 'San Giacomo, San Lorenzo, San Marino', email: 'exataprime@gmail.com', telefone: '(27)99275-8655', endereco: 'Rua Moacir Avidos, Praia do Canto', complemento: '270', cep: '29055350', bairro: 'Praia do Canto', cidade: 'Vitória', estado: 'Es', ucNumero: '0014566575', codIdentificacao: '', numeroInstalacao: '0014566575', grupoSubgrupo: '', classeSubclasse: '', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: '', tensaoNominal: '', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '771.96', ativo: true },
  { cpf: '09318415770', nome: 'SERGIO MAGDALENA BARLANZA', email: 'sergio_barlanza@yahoo.com.br', telefone: '(27)99979-7352', endereco: 'RUA CONSTANTE SODRE 1101', complemento: 'AP 1301 ED ROYAL PALACE', cep: '29057545', bairro: 'BARRO VERMELHO', cidade: 'VITORIA', estado: 'ES', ucNumero: '0401985146', codIdentificacao: '0401985146', numeroInstalacao: '1706527', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: 'ECM64721', plano: 'PLANO OURO', valorPlano: '642.1', ativo: true },
  { cpf: '04058176652', nome: 'THIAGO MONTEIRO DE PAULA SIQUEIRA', email: 'siqueira_thiago@hotmail.com', telefone: '(27)99989-1660', endereco: 'RUA AFFONSO CLAUDIO 287AP', complemento: '701 GENEVE290 55-570 PRAIA DO CANTO / VITORIA - ES', cep: '29050310', bairro: '', cidade: '', estado: 'ES', ucNumero: '0000508582', codIdentificacao: '', numeroInstalacao: '0000508582', grupoSubgrupo: '', classeSubclasse: '', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '559.66', ativo: true },
  { cpf: '05404946660', nome: 'UAINE GROUP', email: 'financeiro@uainegroup.com.br', telefone: '(27)99264-4925', endereco: 'RUA RIO BRANCO 127', complemento: '', cep: '29101130', bairro: 'PRAIA DA COSTA', cidade: 'VILA VELHA', estado: 'ES', ucNumero: '158059', codIdentificacao: '', numeroInstalacao: '158059', grupoSubgrupo: 'B - B3', classeSubclasse: 'COMERCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '0.0', ativo: true },
  { cpf: '09468762742', nome: 'VICTOR BELIZARIO COUTO', email: 'belizariocouto@terra.com.br', telefone: '(27)99984-2718', endereco: 'RUA JOSEPH ZGAIB 258', complemento: 'AP 1502 ED MONTRER', cep: '29101270', bairro: 'PRAIA DA COSTA', cidade: 'VILA VELHA', estado: 'ES', ucNumero: '0401215981', codIdentificacao: '0401215981', numeroInstalacao: '160205357', grupoSubgrupo: 'B - B1', classeSubclasse: 'RESIDENCIAL', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '14763025', plano: 'PLANO OURO', valorPlano: '490.43', ativo: true },
  { cpf: '05718418721', nome: 'VITOR ANGELO VERVLOET COMERIO', email: 'vitor@vitoriacontabil.com', telefone: '(27)99987-7559', endereco: 'RUA PEDRO DANIEL 90', complemento: 'AP 501 ED DEMOISELLE BARRO VERMELHO / VITORIA - ES', cep: '29057600', bairro: '', cidade: '', estado: 'ES', ucNumero: '0450260966', codIdentificacao: '0450260966', numeroInstalacao: '0000509054', grupoSubgrupo: 'B1-RESIDENCIAL', classeSubclasse: 'B', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '320.02', ativo: true },
  { cpf: '03606325720', nome: 'WALTER DIAS RIBEIRO', email: 'walterdribeiro@hotmail.com', telefone: '(27)99966-4882', endereco: 'RUA DR JOAO CARLOS DE SOUZA 67', complemento: '', cep: '29057530', bairro: '29057-530 BARRO VERMELHO', cidade: 'VITORIA', estado: 'ES', ucNumero: '0000906129', codIdentificacao: '', numeroInstalacao: '0000906129', grupoSubgrupo: 'B3-COMERCIAL', classeSubclasse: 'B', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '1785.3', ativo: true },
  { cpf: '09765957700', nome: 'WILSON YOSHIKAZU TERUYA JUNIOR', email: 'wilsonteruya@hotmail.com', telefone: '(27)99939-4649', endereco: 'AV MIRAMAR S/N CS 31', complemento: 'RESID VILLAGE J CAMBURI BL-3-4', cep: '29160752', bairro: 'DE FATIMA', cidade: 'SERRA', estado: 'ES', ucNumero: '0450342873', codIdentificacao: '0450342873', numeroInstalacao: '0001671408', grupoSubgrupo: 'B1-RESIDENCIAL', classeSubclasse: 'B', tipoFornecimento: 'BIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '423.56', ativo: true },
  { cpf: '08501497703', nome: 'WINNFRIED JORDAN NETO', email: 'vinniejordan@hotmail.com', telefone: '(27)99920-2110', endereco: 'RUA EUGÊNIO NETTO 239', complemento: '701 PORTOCALLE2 9055-275 PRAIA DO CANTO / VITORIA - ES', cep: '29055275', bairro: 'Praia do Canto', cidade: 'Vitória', estado: 'ES', ucNumero: '0000004570', codIdentificacao: '', numeroInstalacao: '0000004570', grupoSubgrupo: '', classeSubclasse: '', tipoFornecimento: 'TRIFÁSICO', modalidadeTarifaria: 'CONVENCIONAL', tensaoNominal: '220 / 127 V', numeroMedidor: '', plano: 'PLANO OURO', valorPlano: '409.75', ativo: true },
];

// Percentuais MMGD (fev/2026) - UC receptora EDP -> % alocado
// NOTA: As UCs do MMGD usam formato diferente do Cod.Identificacao/NumInstalacao da planilha.
//       Mapeamento manual necessario para vincular ao cooperado correto.
const MMGD_PERCENTUAIS: Record<string, number> = {
  '000000029305461': 0.36,
  '000000253205429': 0.18,
  '000000377705414': 0.49,
  '000000378005468': 0.31,
  '000037403405496': 1.37,
  '000037403605477': 4.33,
  '000037406505427': 0.48,
  '000037406705408': 0.53,
  '000037409505472': 0.73,
  '000037412005410': 0.57,
  '000037414505431': 0.84,
  '000037586305496': 0.43,
  '000043117005460': 0.35,
  '000043931105417': 0.33,
  '000044364705406': 0.17,
  '000048955305446': 0.27,
  '000058032605400': 4.9,
  '000067660505436': 1.37,
  '000069427805475': 0.5,
  '000072354505474': 0.28,
  '000074057605423': 2.35,
  '000074973205451': 2.28,
  '000075785805468': 2.39,
  '000077609505480': 0.53,
  '000088158105483': 1.08,
  '000088640305454': 1.22,
  '000090996605486': 0.28,
  '000098471605445': 0.39,
  '000100427105409': 0.02,
  '000101429905457': 0.2,
  '000101730205444': 0.18,
  '000103285405494': 0.66,
  '000107841805437': 0.38,
  '000108888105415': 7.11,
  '000110071805406': 0.36,
  '000110190505469': 5.67,
  '000118034405434': 0.36,
  '000118034505420': 0.24,
  '000120430205494': 0.36,
  '000121969005438': 0.5,
  '000123334605481': 39.53,
  '000124385705470': 1.6,
  '000128368605400': 0.19,
  '000128552905434': 0.33,
  '000131206705497': 0.41,
  '000131836505408': 0.2,
  '000131845705485': 2.52,
  '000131845905466': 1.38,
  '000133195705406': 0.73,
  '000134056905472': 0.3,
  '000134059005401': 0.6,
  '000134200505488': 0.31,
  '000134412905400': 0.11,
  '000134490805437': 0.37,
  '000135328005447': 0.07,
  '000135841805467': 0.35,
  '000139673205497': 0.07,
  '000142138005470': 0.9,
  '000144848605445': 0.99,
  '000152939905425': 0.43,
  '000152940005448': 0.44,
  '000154147005416': 0.38,
  '000155657305434': 0.39,
  '000165116605460': 0.69,
  '000227440805425': 0.44,
  '000236140605447': 0.92,
};

// Historico de geracao mensal da usina (kWh)
const GERACAO_HISTORICO = [
  { mes: 'fev/26', kwhGerado: 143701.95 },
  { mes: 'jan/26', kwhGerado: 150655.05 },
  { mes: 'dez/25', kwhGerado: 145355.7 },
  { mes: 'nov/25', kwhGerado: 137445.0 },
  { mes: 'out/25', kwhGerado: 131033.7 },
  { mes: 'set/25', kwhGerado: 128093.7 },
  { mes: 'ago/25', kwhGerado: 140094.15 },
  { mes: 'jul/25', kwhGerado: 131640.6 },
  { mes: 'jun/25', kwhGerado: 126649.95 },
  { mes: 'mai/25', kwhGerado: 118170.15 },
  { mes: 'abr/25', kwhGerado: 131381.25 },
  { mes: 'mar/25', kwhGerado: 168792.75 },
  { mes: 'fev/25', kwhGerado: 160540.8 },
];

const GERACAO_MEDIA_KWH = 139504.2;

// ===========================================================================

async function main() {
  console.log('Iniciando seed com dados reais da CoopereBR...');
  console.log(`  ${COOPERADOS_DATA.length} cooperados | ${Object.keys(MMGD_PERCENTUAIS).length} UCs MMGD | ${GERACAO_HISTORICO.length} meses geracao`);
  console.log('');

  // --- 1. Admin padrao ---
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@cooperebr.com.br' },
    update: {},
    create: {
      nome: 'Administrador CoopereBR',
      email: 'admin@cooperebr.com.br',
      perfil: PerfilUsuario.ADMIN,
    },
  });
  console.log(`[OK] Admin: ${admin.email} (id: ${admin.id})`);

  // --- 2. Planos ---
  const planoOuro = await prisma.plano.upsert({
    where: { id: 'plano-ouro' },
    update: { nome: 'PLANO OURO', descontoBase: 20, modeloCobranca: ModeloCobranca.CREDITOS_COMPENSADOS },
    create: {
      id: 'plano-ouro',
      nome: 'PLANO OURO',
      descricao: 'Plano Ouro - desconto de 20% sobre creditos compensados',
      modeloCobranca: ModeloCobranca.CREDITOS_COMPENSADOS,
      descontoBase: 20,
      publico: true,
      ativo: true,
    },
  });

  const planoPrata = await prisma.plano.upsert({
    where: { id: 'plano-prata' },
    update: { nome: 'PLANO PRATA', descontoBase: 15, modeloCobranca: ModeloCobranca.CREDITOS_COMPENSADOS },
    create: {
      id: 'plano-prata',
      nome: 'PLANO PRATA',
      descricao: 'Plano Prata - desconto de 15% sobre creditos compensados',
      modeloCobranca: ModeloCobranca.CREDITOS_COMPENSADOS,
      descontoBase: 15,
      publico: true,
      ativo: true,
    },
  });

  const planoCreditos = await prisma.plano.upsert({
    where: { id: 'plano-creditos' },
    update: { nome: 'CONSUMO DE CREDITOS DE KWH', descontoBase: 18, modeloCobranca: ModeloCobranca.CREDITOS_COMPENSADOS },
    create: {
      id: 'plano-creditos',
      nome: 'CONSUMO DE CREDITOS DE KWH',
      descricao: 'Plano baseado em consumo de creditos de kWh',
      modeloCobranca: ModeloCobranca.CREDITOS_COMPENSADOS,
      descontoBase: 18,
      publico: true,
      ativo: true,
    },
  });

  const planoMap: Record<string, string> = {
    'PLANO OURO': planoOuro.id,
    'PLANO PRATA': planoPrata.id,
  };

  console.log('[OK] 3 planos criados/atualizados');

  // --- 3. Usina ---
  const usina = await prisma.usina.upsert({
    where: { id: 'usina-linhares' },
    update: {
      nome: 'COOPERE BR - Usina Linhares',
      producaoMensalKwh: GERACAO_MEDIA_KWH,
    },
    create: {
      id: 'usina-linhares',
      nome: 'COOPERE BR - Usina Linhares',
      potenciaKwp: 1000,
      capacidadeKwh: GERACAO_MEDIA_KWH * 12,
      producaoMensalKwh: GERACAO_MEDIA_KWH,
      cidade: 'Linhares',
      estado: 'ES',
      distribuidora: 'EDP ES',
      statusHomologacao: 'EM_PRODUCAO',
      dataHomologacao: new Date('2024-06-01'),
      dataInicioProducao: new Date('2024-07-01'),
      observacoes: 'UC Geradora: 000241001305478 | EST LINHARES X POVOACAO S/N, 29900-001 AREA RURAL, LINHARES-ES | Medidor: 0016842999',
    },
  });
  console.log(`[OK] Usina: ${usina.nome} (${GERACAO_MEDIA_KWH.toFixed(0)} kWh/mes medio)`);

  // --- 4. Cooperados + UCs + Contratos ---
  let countCoop = 0;
  let countUc = 0;
  let countContrato = 0;
  let countSkipped = 0;

  for (const d of COOPERADOS_DATA) {
    const cpfLimpo = d.cpf.replace(/\D/g, '');
    if (!cpfLimpo) {
      console.warn(`  [SKIP] ${d.nome} - CPF vazio`);
      countSkipped++;
      continue;
    }

    // Cooperado
    const cooperado = await prisma.cooperado.upsert({
      where: { cpf: cpfLimpo },
      update: {
        nomeCompleto: d.nome,
        email: d.email,
        telefone: d.telefone || null,
        status: d.ativo ? 'ATIVO' : 'SUSPENSO',
      },
      create: {
        nomeCompleto: d.nome,
        cpf: cpfLimpo,
        email: d.email,
        telefone: d.telefone || null,
        status: d.ativo ? 'ATIVO' : 'SUSPENSO',
        tipoCooperado: 'COM_UC',
        termoAdesaoAceito: true,
        termoAdesaoAceitoEm: new Date(),
      },
    });
    countCoop++;

    // UC
    const ucNumero = d.ucNumero || d.numeroInstalacao || d.codIdentificacao;
    if (!ucNumero) {
      console.warn(`  [SKIP] ${d.nome} - sem numero de UC`);
      continue;
    }

    const enderecoUc = [d.endereco, d.complemento].filter(Boolean).join(', ');
    const cidadeUc = d.cidade || 'Vitoria';
    const estadoUc = d.estado || 'ES';

    const uc = await prisma.uc.upsert({
      where: { numero: ucNumero },
      update: {
        endereco: enderecoUc || 'Endereco nao informado',
        cooperadoId: cooperado.id,
        codigoMedidor: d.numeroMedidor || null,
        distribuidora: 'EDP ES',
      },
      create: {
        numero: ucNumero,
        endereco: enderecoUc || 'Endereco nao informado',
        cidade: cidadeUc,
        estado: estadoUc,
        cep: d.cep || null,
        bairro: d.bairro || null,
        cooperadoId: cooperado.id,
        numeroUC: d.numeroInstalacao || null,
        codigoMedidor: d.numeroMedidor || null,
        distribuidora: 'EDP ES',
        classificacao: d.classeSubclasse || null,
        modalidadeTarifaria: d.modalidadeTarifaria || null,
        tensaoNominal: d.tensaoNominal || null,
        tipoFornecimento: d.tipoFornecimento || null,
      },
    });
    countUc++;

    // Contrato
    const numeroContrato = `CTR-${cpfLimpo.slice(-6)}`;
    const planoNorm = d.plano.toUpperCase();
    const planoId = planoNorm.includes('OURO')
      ? planoOuro.id
      : planoNorm.includes('PRATA')
        ? planoPrata.id
        : planoCreditos.id;
    const descontoPlano = planoNorm.includes('OURO') ? 20 : planoNorm.includes('PRATA') ? 15 : 18;

    await prisma.contrato.upsert({
      where: { numero: numeroContrato },
      update: {
        cooperadoId: cooperado.id,
        ucId: uc.id,
        usinaId: usina.id,
        planoId: planoId,
        percentualDesconto: descontoPlano,
        status: d.ativo ? 'ATIVO' : 'SUSPENSO',
      },
      create: {
        numero: numeroContrato,
        cooperadoId: cooperado.id,
        ucId: uc.id,
        usinaId: usina.id,
        planoId: planoId,
        dataInicio: new Date('2025-01-01'),
        percentualDesconto: descontoPlano,
        percentualUsina: 0,
        status: d.ativo ? 'ATIVO' : 'SUSPENSO',
      },
    });
    countContrato++;
  }

  console.log(`[OK] ${countCoop} cooperados criados/atualizados`);
  console.log(`[OK] ${countUc} UCs criadas/atualizadas`);
  console.log(`[OK] ${countContrato} contratos criados/atualizados`);
  if (countSkipped) console.log(`[WARN] ${countSkipped} cooperados pulados (sem CPF)`);

  // --- 5. Referencia MMGD salva como ConfigTenant ---
  await prisma.configTenant.upsert({
    where: { chave: 'mmgd_percentuais_fev2026' },
    update: { valor: JSON.stringify(MMGD_PERCENTUAIS) },
    create: {
      chave: 'mmgd_percentuais_fev2026',
      valor: JSON.stringify(MMGD_PERCENTUAIS),
      descricao: 'Percentuais MMGD fev/2026 - UC receptora EDP -> % alocado. Usar para mapear percentualUsina dos contratos.',
    },
  });

  await prisma.configTenant.upsert({
    where: { chave: 'geracao_historico' },
    update: { valor: JSON.stringify(GERACAO_HISTORICO) },
    create: {
      chave: 'geracao_historico',
      valor: JSON.stringify(GERACAO_HISTORICO),
      descricao: 'Historico de geracao mensal da usina Linhares (kWh). Fev/25 a Fev/26.',
    },
  });

  console.log('[OK] Dados MMGD salvos em ConfigTenant para referencia');

  // --- 6. Modelos de Cobrança ---
  const modelosCobranca = [
    {
      id: 'modelo-essencial',
      nome: 'ESSENCIAL',
      descricao: 'Fixo pela média, base TUSD+TE com ICMS',
      tipo: ModeloCobranca.FIXO_MENSAL,
      ativo: false,
      descontoBase: 15,
      descontoMinimo: 10,
      descontoMaximo: 25,
      baseCalculo: 'TUSD_TE',
    },
    {
      id: 'modelo-justo',
      nome: 'JUSTO',
      descricao: 'Compensado preço fixo, base TUSD+TE com ICMS',
      tipo: ModeloCobranca.CREDITOS_COMPENSADOS,
      ativo: false,
      descontoBase: 20,
      descontoMinimo: 15,
      descontoMaximo: 30,
      baseCalculo: 'TUSD_TE',
    },
    {
      id: 'modelo-dinamico',
      nome: 'DINÂMICO',
      descricao: 'Compensado preço dinâmico, base configurável',
      tipo: ModeloCobranca.CREDITOS_DINAMICO,
      ativo: false,
      descontoBase: 18,
      descontoMinimo: 12,
      descontoMaximo: 28,
      baseCalculo: 'CONFIGURAVEL',
    },
    {
      id: 'modelo-premium',
      nome: 'PREMIUM',
      descricao: 'Compensado fixo, base total da fatura',
      tipo: ModeloCobranca.CREDITOS_COMPENSADOS,
      ativo: false,
      descontoBase: 25,
      descontoMinimo: 20,
      descontoMaximo: 35,
      baseCalculo: 'TOTAL_FATURA',
    },
  ];

  for (const m of modelosCobranca) {
    await prisma.modeloCobrancaConfig.upsert({
      where: { nome: m.nome },
      update: {
        descricao: m.descricao,
        tipo: m.tipo,
        ativo: m.ativo,
        descontoBase: m.descontoBase,
        descontoMinimo: m.descontoMinimo,
        descontoMaximo: m.descontoMaximo,
        baseCalculo: m.baseCalculo,
      },
      create: m,
    });
  }
  console.log('[OK] 4 modelos de cobrança criados/atualizados');

  // --- Resumo ---
  const totalCooperados = await prisma.cooperado.count();
  const totalUcs = await prisma.uc.count();
  const totalContratos = await prisma.contrato.count();
  const totalUsinas = await prisma.usina.count();

  console.log('');
  console.log('Seed concluido!');
  console.log(`  ${totalCooperados} cooperados | ${totalUcs} UCs | ${totalContratos} contratos | ${totalUsinas} usinas`);
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
