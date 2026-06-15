/**
 * Diagnóstico — mostra arquivoUrl completo da fatura do Luciano e testa
 * 3 estratégias de download:
 *   1. Fetch direto (anônimo)
 *   2. Fetch com Authorization Bearer SERVICE_KEY
 *   3. Supabase SDK com SERVICE_KEY
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function tentarFetch(label: string, url: string, headers?: Record<string, string>): Promise<void> {
  try {
    const r = await fetch(url, { headers });
    console.log(`  ${label}: HTTP ${r.status} ${r.statusText} | content-length=${r.headers.get('content-length') ?? '-'}`);
    if (!r.ok) {
      const body = await r.text();
      console.log(`    body: ${body.slice(0, 200)}`);
    }
  } catch (err) {
    console.log(`  ${label}: ERRO ${(err as Error).message.slice(0, 100)}`);
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  const cooperado = await prisma.cooperado.findFirst({
    where: { email: 'lucbragatto@gmail.com' },
    select: {
      id: true,
      nomeCompleto: true,
      faturasProcessadas: {
        select: { id: true, arquivoUrl: true, mesReferencia: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!cooperado || cooperado.faturasProcessadas.length === 0) {
    console.log('Sem fatura.');
    await prisma.$disconnect();
    return;
  }

  const f = cooperado.faturasProcessadas[0];
  console.log(`Cooperado: ${cooperado.nomeCompleto}`);
  console.log(`Fatura: ${f.id} (${f.mesReferencia ?? '-'})\n`);
  console.log(`arquivoUrl COMPLETO:`);
  console.log(`  ${f.arquivoUrl}\n`);

  if (!f.arquivoUrl) {
    await prisma.$disconnect();
    return;
  }

  const url = f.arquivoUrl;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  console.log('Testando 3 estratégias:');
  await tentarFetch('1. Anônimo (sem header)', url);
  if (anonKey) {
    await tentarFetch('2. Authorization Bearer ANON_KEY', url, { Authorization: `Bearer ${anonKey}` });
  }
  if (serviceKey) {
    await tentarFetch('3. Authorization Bearer SERVICE_KEY', url, { Authorization: `Bearer ${serviceKey}` });
  }

  // Tenta também converter pra signed URL se for /public/
  const matchPublic = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (matchPublic) {
    const [, bucket, pathRaw] = matchPublic;
    const path = decodeURIComponent(pathRaw);
    console.log(`\nDetectei formato /object/public/: bucket="${bucket}" path="${path}"`);
    console.log('Vou criar signed URL via Supabase SDK SERVICE_KEY...');
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL!, serviceKey!);
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      if (error) {
        console.log(`  ERRO criando signed URL: ${error.message}`);
      } else {
        console.log(`  Signed URL gerada (TTL 1h): ${data.signedUrl.slice(0, 100)}...`);
        await tentarFetch('4. Signed URL', data.signedUrl);
      }
    } catch (err) {
      console.log(`  Erro SDK: ${(err as Error).message.slice(0, 100)}`);
    }
  }

  await prisma.$disconnect();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
