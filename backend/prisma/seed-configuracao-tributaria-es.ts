import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed: ConfiguracaoTributariaConcessionaria — Espirito Santo (MVP Concierge C1)
 *
 * Atende clientes ES (CoopereBR, Sinergia, outros). Uma config por
 * concessionaria com mesma lei estadual (Lei GERAR cobre ES inteiro).
 *
 * Fontes:
 * - ICMS ES energia: 17% padrao (Lei 7.000/2001 e atualizacoes).
 * - PIS Lucro Presumido cumulativo: 0,65% (Lei 9.718/98).
 * - COFINS Lucro Presumido cumulativo: 3,00% (Lei 9.718/98).
 * - Lei estadual GD: ES Lei 11.253/2021 (Programa GERAR), isencao parcial
 *   de ICMS no SCEE. Paragrafo 3 art. 5-D exclui demanda, disponibilidade
 *   e encargos da isencao (catalogado como Tese 4 retaguarda no dossie
 *   CoopereBR x EDP — docs/historico/.../CONTEXTO-JURIDICO.md:64-69).
 *
 * Atencao: alicotas e Lei vigentes em 10/06/2026. Reajustes/mudancas
 * legislativas exigem novo registro com vigenciaInicio atualizada
 * (versionamento, nao update destrutivo).
 */

interface ConfigES {
  distribuidora: 'EDP_ES' | 'ELFSM';
  id: string;
}

const CONFIGS_ES: ConfigES[] = [
  { distribuidora: 'EDP_ES', id: 'cfg-trib-edp-es-2025-01' },
  { distribuidora: 'ELFSM', id: 'cfg-trib-elfsm-2025-01' },
];

const PARAMETROS_ES_COMUNS = {
  uf: 'ES',
  leiEstadualIsencaoGd: 'Lei 11.253/2021-ES (Programa GERAR) - isencao parcial ICMS no SCEE',
  rubricasExcluidasIsencao: [
    'DEMANDA',
    'DISPONIBILIDADE',
    'ENCARGOS',
  ] as string[],
  aliquotaIcms: 0.17,
  aliquotaPis: 0.0065,
  aliquotaCofins: 0.03,
  vigenciaInicio: new Date('2025-01-01T00:00:00-03:00'),
  vigenciaFim: null,
  observacoes:
    'Inconstitucionalidade material do paragrafo 3 art. 5-D arguida no dossie ' +
    'CoopereBR x EDP (Tese 4 retaguarda). Rubricas excluidas seguem com ICMS.',
};

async function main(): Promise<void> {
  console.log('=== Seed: ConfiguracaoTributariaConcessionaria ES ===');
  console.log(`Lei: ${PARAMETROS_ES_COMUNS.leiEstadualIsencaoGd}`);
  console.log(`Rubricas excluidas: ${PARAMETROS_ES_COMUNS.rubricasExcluidasIsencao.join(', ')}`);
  console.log('');

  for (const cfg of CONFIGS_ES) {
    const dados = {
      ...PARAMETROS_ES_COMUNS,
      distribuidora: cfg.distribuidora,
      rubricasExcluidasIsencao:
        PARAMETROS_ES_COMUNS.rubricasExcluidasIsencao as unknown as object,
    };

    await prisma.configuracaoTributariaConcessionaria.upsert({
      where: { id: cfg.id },
      update: dados,
      create: {
        id: cfg.id,
        ...dados,
      },
    });

    console.log(`  upsert ${cfg.distribuidora} (id=${cfg.id})`);
  }

  console.log('');
  console.log(`OK ${CONFIGS_ES.length} configuracoes ES criadas/atualizadas.`);
  console.log('Proximo: rodar seed quando schema for aplicado via prisma db push.');
}

main()
  .catch((e: unknown) => {
    const message = e instanceof Error ? e.message : 'erro desconhecido';
    console.error(`Falha no seed: ${message}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
