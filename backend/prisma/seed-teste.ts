import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

// ── Credenciais de login ──
const LOGIN_CREDENTIALS = [
  { identificador: 'teste@cooperebr.com', senha: 'Coopere@123' },
  { identificador: 'admin@cooperebr.com', senha: 'admin123' },
  { identificador: 'admin@cooperebr.com', senha: 'Coopere@123' },
];

// ── Cooperativas a criar ──
const COOPERATIVAS = [
  {
    nome: 'CoopereSul - Cooperativa Solar do Sul ES',
    cnpj: '12345678000190',
    email: 'contato@cooperesul.com.br',
    telefone: '2733001000',
  },
  {
    nome: 'CoopereVerde - Cooperativa Energia Verde ES',
    cnpj: '98765432000155',
    email: 'contato@coopereverde.com.br',
    telefone: '2733002000',
  },
];

// ── Usinas a criar ──
const USINAS = [
  {
    nome: 'Usina Solar Sul - Cariacica',
    potenciaKwp: 350,
    cidade: 'Cariacica',
    estado: 'ES',
    statusHomologacao: 'EM_PRODUCAO',
    cooperativaIndex: 0, // CoopereSul
  },
  {
    nome: 'Usina Verde - Serra',
    potenciaKwp: 200,
    cidade: 'Serra',
    estado: 'ES',
    statusHomologacao: 'EM_PRODUCAO',
    cooperativaIndex: 1, // CoopereVerde
  },
];

// ── Lista de cooperados ──
interface CooperadoInput {
  nome: string;
  cpfCnpj: string;
  email: string;
  telefone: string;
  endereco: string;
  complemento?: string;
  cep: string;
  cidade: string;
  estado: string;
}

const COOPERADOS: CooperadoInput[] = [
  { nome: 'ADRIANA MARIA ALMENARA ZAMBON', cpfCnpj: '98572652787', email: 'Adri.zambon@hotmail.com', telefone: '27992741005', endereco: 'RUA JOAQUIM LIRIO 366', complemento: 'AP 1601 ED JAZZ RESIDENCE', cep: '29055460', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'AESMP - Associacao ES Ministerio Publico', cpfCnpj: '27268077000101', email: 'secretaria@aesmp.org.br', telefone: '27999037503', endereco: 'RUA PRFA EMILIA FRANKLIN MOLULO 154', cep: '29050730', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'AGOSTINHO SOBRAL SAMPAIO', cpfCnpj: '79022596753', email: 'agsobral@gmail.com', telefone: '27981143072', endereco: 'AL HELIO DA COSTA FERRAZ 145', complemento: 'AP 1601 ED CARRARA DE D ITALIA', cep: '29055090', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'ALAOR DE QUEIROZ ARAUJO NETO', cpfCnpj: '11041033702', email: 'alaorqueirozneto@gmail.com', telefone: '27997297495', endereco: 'RUA CONSTANTE SODRE 1001', complemento: 'AP 802 ED ISLA BONITA', cep: '29057545', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'ALBERTO LUIZ MAFRA', cpfCnpj: '67328552715', email: 'albertomafra@uol.com.br', telefone: '27999718855', endereco: 'RUA DES JAIR MOURA MELO 102', complemento: 'AP 1101 ED BOSQUE IMPERIAL', cep: '29057200', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'ANA CLAUDIA DA SILVA ROCHA', cpfCnpj: '06438834785', email: 'ana.claudia.rocha@hotmail.com', telefone: '27999720097', endereco: 'AV NOSSA SENHORA DA PENHA 2166', complemento: 'AP 303', cep: '29045402', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'ANA CLAUDIA PIMENTEL BASTOS', cpfCnpj: '05576929784', email: 'anaclaupbastos@gmail.com', telefone: '27998899558', endereco: 'RUA DES JAIR MOURA MELO 102', complemento: 'AP 602', cep: '29057200', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'ANA PAULA ALVES DIAS VITALI', cpfCnpj: '99741726753', email: 'anapaulad.vitali@gmail.com', telefone: '27999704445', endereco: 'RUA JOSE CUPERTINO DE SOUZA 55', complemento: 'ED JADE RESIDENCE AP 1101', cep: '29060310', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'ANTONIO CESAR DE BARROS FREITAS', cpfCnpj: '28741969749', email: 'antoniofreitas.adv@gmail.com', telefone: '27999640900', endereco: 'RUA HENRIQUE MOSCOSO 53', complemento: 'AP 1001 ED UNIQUE', cep: '29010290', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'BERNARDO FERRAZ LYRIO', cpfCnpj: '33777618755', email: 'bernardolyrio@gmail.com', telefone: '27981196688', endereco: 'AV CESARIO ALVIM 1200', complemento: 'AP 1502', cep: '29055050', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'BLANCHE SPAGNOLO MORSCHEL', cpfCnpj: '72048285700', email: 'blanchemorschel@hotmail.com', telefone: '27999762022', endereco: 'AV CEL BORGES 150', complemento: 'AP 1402 ED SAN REMO', cep: '29065110', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'CARLOS HENRIQUE MOREIRA COSTA', cpfCnpj: '02023513795', email: 'carloshenriquecosta@gmail.com', telefone: '27999702878', endereco: 'AV SATURNINO DE BRITO 1000', cep: '29017040', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'CLAUDIO HENRIQUE POLI', cpfCnpj: '96375419749', email: 'chpoli@gmail.com', telefone: '27988218680', endereco: 'AV SATURNINO DE BRITO 560', complemento: 'AP 1801', cep: '29017040', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'CRISTIANE SIMOES VIEIRA NUNES', cpfCnpj: '07063827751', email: 'crissimoesv@gmail.com', telefone: '27999765985', endereco: 'RUA ENGENHEIRO ROBERTO SALES 1001', complemento: 'AP 1602', cep: '29055070', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'DANIEL PIMENTEL BASTOS', cpfCnpj: '93827978715', email: 'dpbastos@hotmail.com', telefone: '27988085152', endereco: 'RUA DES JAIR MOURA MELO 102', complemento: 'AP 602', cep: '29057200', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'DENISE PAIVA MOREIRA', cpfCnpj: '04773588736', email: 'denisepaiva20@hotmail.com', telefone: '27999226264', endereco: 'AV ROBERTO SILVARES 1020', cep: '29065630', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'ELIANA MEIRELES LOBATO', cpfCnpj: '38895440700', email: 'eliana.lobato@yahoo.com.br', telefone: '27998088120', endereco: 'RUA JOAQUIM LIRIO 366', complemento: 'AP 1301', cep: '29055460', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'FABIANA FRIZERA FRANCA', cpfCnpj: '09296753773', email: 'fabifrizera@gmail.com', telefone: '27999706506', endereco: 'RUA CONSTANTE SODRE 1250', complemento: 'AP 1601', cep: '29057545', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'FLAVIA COSTA AZEREDO', cpfCnpj: '92773416749', email: 'flavia.ca@hotmail.com', telefone: '27999757008', endereco: 'RUA DES JAIR MOURA MELO 102', complemento: 'AP 702', cep: '29057200', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'FRANCISCO SIANO NETO', cpfCnpj: '27022074787', email: 'fsiano@terra.com.br', telefone: '27999219966', endereco: 'AV SATURNINO DE BRITO 420', complemento: 'AP 1201', cep: '29017040', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'GERALDO OCTAVIO ROCHA SANTOS', cpfCnpj: '24625481715', email: 'geraldorocha@terra.com.br', telefone: '27999614522', endereco: 'RUA HENRIQUE MOSCOSO 80', complemento: 'AP 601', cep: '29010290', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'GILSON JOSE BARBOSA', cpfCnpj: '20040965734', email: 'gilsonbarbosa@hotmail.com', telefone: '27998127000', endereco: 'RUA CONSTANTE SODRE 950', cep: '29057545', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'HELOISA DE CAMPOS BASTOS', cpfCnpj: '37918505797', email: 'heloisabastos@gmail.com', telefone: '27999219800', endereco: 'AV DANTE MICHELINE 1701', complemento: 'AP 2301', cep: '29060680', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'IRIS QUEIROZ NETO', cpfCnpj: '74261889753', email: 'irisqneto@gmail.com', telefone: '27988011522', endereco: 'RUA HENRIQUE MOSCOSO 150', complemento: 'AP 802', cep: '29010290', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'JOSE CARLOS RODRIGUES GUIMARAES', cpfCnpj: '11263263715', email: 'josecarlosg@hotmail.com', telefone: '27999411520', endereco: 'AV VITORIA 2020', complemento: 'AP 1501', cep: '29017500', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'JOSE LUIZ COSTA PINTO', cpfCnpj: '33817694768', email: 'jlcpinto@gmail.com', telefone: '27999705500', endereco: 'RUA CONSTANTE SODRE 800', complemento: 'AP 1801', cep: '29057545', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'KATIA CILENE COSTA ZANDONADE', cpfCnpj: '77513879734', email: 'kzandonade@gmail.com', telefone: '27988145800', endereco: 'AV SATURNINO DE BRITO 780', complemento: 'AP 901', cep: '29017040', cidade: 'VITORIA', estado: 'ES' },
  { nome: 'LETICIA OLIVEIRA CAMPOS', cpfCnpj: '12234567890', email: 'leticia.campos@gmail.com', telefone: '27999800100', endereco: 'RUA JOSE TEIXEIRA 200', cep: '29100100', cidade: 'CARIACICA', estado: 'ES' },
  { nome: 'LUCAS FERREIRA MELO', cpfCnpj: '98765432100', email: 'lucas.melo@gmail.com', telefone: '27999800200', endereco: 'AV CENTRAL 500', cep: '29150100', cidade: 'SERRA', estado: 'ES' },
  { nome: 'MARCOS ANTONIO BELO', cpfCnpj: '11122233344', email: 'marcos.belo@gmail.com', telefone: '27999800300', endereco: 'RUA DAS FLORES 100', cep: '29170100', cidade: 'VILA VELHA', estado: 'ES' },
];

// ── Helpers ──

async function login(): Promise<string> {
  for (const creds of LOGIN_CREDENTIALS) {
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      if (res.ok) {
        const data = await res.json();
        const token = data.token || data.access_token;
        if (token) {
          console.log(`✓ Login OK com ${creds.identificador}`);
          return token;
        }
      }
    } catch {
      // tenta próxima credencial
    }
  }
  throw new Error('Não foi possível fazer login com nenhuma credencial.');
}

async function apiPost(path: string, body: any, token: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

// ── Main ──

async function main() {
  const resumo = {
    cooperativas: { ok: 0, falha: 0 },
    usinas: { ok: 0, falha: 0 },
    cooperados: { ok: 0, falha: 0 },
    ucs: { ok: 0, falha: 0 },
  };

  // 1. Login
  console.log('\n═══ ETAPA 1: Login ═══');
  const token = await login();

  // 2. Criar cooperativas via Prisma (sem endpoint REST)
  console.log('\n═══ ETAPA 2: Cooperativas ═══');
  const cooperativaIds: string[] = [];

  for (const coop of COOPERATIVAS) {
    try {
      const existing = await prisma.cooperativa.findFirst({ where: { cnpj: coop.cnpj } });
      if (existing) {
        console.log(`  → Cooperativa já existe: ${coop.nome} (${existing.id})`);
        cooperativaIds.push(existing.id);
        resumo.cooperativas.ok++;
        continue;
      }
      const created = await prisma.cooperativa.create({ data: coop });
      console.log(`  ✓ Cooperativa criada: ${created.nome} (${created.id})`);
      cooperativaIds.push(created.id);
      resumo.cooperativas.ok++;
    } catch (err: any) {
      console.error(`  ✗ Erro cooperativa ${coop.nome}: ${err.message}`);
      cooperativaIds.push('');
      resumo.cooperativas.falha++;
    }
  }

  const coopereSulId = cooperativaIds[0];
  const coopereVerdeId = cooperativaIds[1];

  // 3. Criar usinas via API REST
  console.log('\n═══ ETAPA 3: Usinas ═══');
  const usinaIds: string[] = [];

  for (const usina of USINAS) {
    try {
      const existing = await prisma.usina.findFirst({ where: { nome: usina.nome } });
      if (existing) {
        console.log(`  → Usina já existe: ${usina.nome} (${existing.id})`);
        usinaIds.push(existing.id);
        resumo.usinas.ok++;
        continue;
      }
      const coopId = cooperativaIds[usina.cooperativaIndex];
      const payload = {
        nome: usina.nome,
        potenciaKwp: usina.potenciaKwp,
        cidade: usina.cidade,
        estado: usina.estado,
        statusHomologacao: usina.statusHomologacao,
        cooperativaId: coopId || undefined,
      };
      const created = await apiPost('/usinas', payload, token);
      console.log(`  ✓ Usina criada: ${created.nome} (${created.id})`);
      usinaIds.push(created.id);
      resumo.usinas.ok++;
    } catch (err: any) {
      console.error(`  ✗ Erro usina ${usina.nome}: ${err.message}`);
      usinaIds.push('');
      resumo.usinas.falha++;
    }
  }

  // 4. Criar cooperados via API REST + UC via Prisma
  console.log('\n═══ ETAPA 4: Cooperados ═══');
  const LIMITE_COOPERESUL = 27; // primeiros 27 → CoopereSul, restantes → CoopereVerde

  for (let i = 0; i < COOPERADOS.length; i++) {
    const c = COOPERADOS[i];
    const cooperativaId = i < LIMITE_COOPERESUL ? coopereSulId : coopereVerdeId;
    const cooperativaNome = i < LIMITE_COOPERESUL ? 'CoopereSul' : 'CoopereVerde';
    const isPJ = c.cpfCnpj.length > 11;

    try {
      // Verificar se já existe
      let cooperado = await prisma.cooperado.findFirst({ where: { cpf: c.cpfCnpj } });
      if (cooperado) {
        console.log(`  → [${cooperativaNome}] já existe: ${c.nome} (${cooperado.id})`);
      } else {
        cooperado = await prisma.cooperado.create({
          data: {
            nomeCompleto: c.nome,
            cpf: c.cpfCnpj,
            email: c.email,
            telefone: c.telefone,
            tipoPessoa: isPJ ? 'PJ' : 'PF',
            tipoCooperado: 'COM_UC',
            status: 'ATIVO',
            cooperativaId: cooperativaId || undefined,
          },
        });
        console.log(`  ✓ [${cooperativaNome}] ${c.nome} (${cooperado.id})`);
      }
      resumo.cooperados.ok++;

      // Criar UC com dados de endereço (se ainda não existir para este cooperado)
      try {
        const ucExistente = await prisma.uc.findFirst({ where: { cooperadoId: cooperado.id } });
        if (!ucExistente) {
          const enderecoCompleto = c.complemento ? `${c.endereco}, ${c.complemento}` : c.endereco;
          const numeroUC = `UC-${c.cep}-${String(i + 1).padStart(3, '0')}`;
          await prisma.uc.create({
            data: {
              numero: numeroUC,
              endereco: enderecoCompleto,
              cidade: c.cidade,
              estado: c.estado,
              cep: c.cep,
              cooperadoId: cooperado.id,
              cooperativaId: cooperativaId || undefined,
              distribuidora: 'EDP ES',
            },
          });
          console.log(`    ↳ UC criada: ${numeroUC}`);
          resumo.ucs.ok++;
        }
      } catch (ucErr: any) {
        console.error(`    ↳ ✗ Erro UC de ${c.nome}: ${ucErr.message}`);
        resumo.ucs.falha++;
      }
    } catch (err: any) {
      console.error(`  ✗ [${cooperativaNome}] ${c.nome}: ${err.message}`);
      resumo.cooperados.falha++;
    }
  }

  // 5. Resumo
  console.log('\n══════════════════════════════════════');
  console.log('           RESUMO DA EXECUÇÃO         ');
  console.log('══════════════════════════════════════');
  console.log(`  Cooperativas: ${resumo.cooperativas.ok} criadas, ${resumo.cooperativas.falha} falhas`);
  console.log(`  Usinas:       ${resumo.usinas.ok} criadas, ${resumo.usinas.falha} falhas`);
  console.log(`  Cooperados:   ${resumo.cooperados.ok} criados, ${resumo.cooperados.falha} falhas`);
  console.log(`  UCs:          ${resumo.ucs.ok} criadas, ${resumo.ucs.falha} falhas`);
  console.log('══════════════════════════════════════\n');
}

main()
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
