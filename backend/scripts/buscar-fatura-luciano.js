/**
 * Busca fatura EDP do Luciano nas 30 não-lidas do INBOX.
 * Estratégia:
 *  1. Lista todos NÃO LIDOS com from contendo 'edp'
 *  2. Para cada: baixa envelope + body (texto + HTML + attachments metadata)
 *  3. Procura por UC canônica (0400702214), UC legada (160085263),
 *     CPF (89089324704), nome "LUCIANO", endereço "JOAQUIM LIRIO" / "JAZZ RESIDENCE"
 *  4. Se encontra: reporta UID, data, anexos
 *  5. NÃO altera flags, NÃO move nada
 */
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ALVOS = {
  ucCanonica: '0400702214',
  ucLegada: '160085263',
  cpf: '89089324704',
  nome: 'LUCIANO',
  enderecoA: 'JOAQUIM LIRIO',
  enderecoB: 'JAZZ RESIDENCE',
};

async function main() {
  const client = new ImapFlow({
    host: process.env.EMAIL_IMAP_HOST || 'imap.gmail.com',
    port: Number(process.env.EMAIL_IMAP_PORT || 993),
    secure: true,
    auth: {
      user: process.env.EMAIL_IMAP_USER,
      pass: process.env.EMAIL_IMAP_PASS,
    },
    tls: { rejectUnauthorized: false },
    logger: false,
  });

  await client.connect();
  console.log('[IMAP] conectado');

  // Buscar em múltiplas pastas
  const PASTAS = process.env.PASTA ? [process.env.PASTA] : ['INBOX'];
  const APENAS_NAO_LIDOS = process.env.UNSEEN_ONLY === 'true';
  const pasta = PASTAS[0];

  const lock = await client.getMailboxLock(pasta, { readonly: true });
  try {
    const criteria = APENAS_NAO_LIDOS ? { seen: false, from: 'edp' } : { from: 'edp' };
    const uidsEdp = await client.search(criteria);
    console.log(`[IMAP] ${uidsEdp.length} emails EDP em ${pasta} (unseen=${APENAS_NAO_LIDOS})`);

    const matches = [];
    const envelopes = [];
    // Fase 1: só envelope (leve) pra pegar datas e subjects
    for await (const msg of client.fetch(uidsEdp, { envelope: true, uid: true, bodyStructure: true })) {
      const attachments = [];
      const walk = (node) => {
        if (!node) return;
        if (node.disposition === 'attachment' && node.dispositionParameters?.filename) {
          attachments.push({ filename: node.dispositionParameters.filename, size: node.size, type: node.type });
        }
        if (node.childNodes) for (const c of node.childNodes) walk(c);
      };
      walk(msg.bodyStructure);
      envelopes.push({
        uid: msg.uid,
        date: msg.envelope.date?.toISOString(),
        subject: msg.envelope.subject,
        from: msg.envelope.from?.[0]?.address,
        attachments,
      });
    }
    console.log(`[FASE 1] envelopes + bodyStructure coletados: ${envelopes.length}`);

    // Match por nome de anexo (rápido)
    for (const e of envelopes) {
      const encontrados = [];
      for (const a of e.attachments) {
        if (a.filename && (a.filename.includes(ALVOS.ucCanonica) || a.filename.includes(ALVOS.ucLegada))) {
          encontrados.push('anexo:' + a.filename);
        }
      }
      if (encontrados.length > 0) {
        matches.push({ ...e, encontrados, fonte: 'anexo' });
      }
    }
    console.log(`[FASE 1] matches por nome de anexo: ${matches.length}`);

    // Fase 2: só pra UIDs sem match ainda, baixar source UM POR VEZ
    const semMatch = envelopes.filter(e => !matches.find(m => m.uid === e.uid));
    console.log(`[FASE 2] vai parsear body de ${semMatch.length} emails sem match de anexo...`);
    let count = 0;
    for (const e of semMatch) {
      count++;
      try {
        const msgs = client.fetch(e.uid, { source: true, uid: true }, { uid: true });
        for await (const msg of msgs) {
          const parsed = await simpleParser(msg.source);
          const texto = [
            parsed.subject || '',
            parsed.from?.text || '',
            parsed.text || '',
            (parsed.html || '').replace(/<[^>]+>/g, ' '),
          ].join('\n');
          const encontrados = [];
          for (const [chave, valor] of Object.entries(ALVOS)) {
            if (texto.toUpperCase().includes(valor.toUpperCase())) encontrados.push(chave);
          }
          if (encontrados.length > 0) {
            matches.push({ ...e, encontrados, fonte: 'body' });
            console.log(`  match body em UID=${e.uid}: ${encontrados.join(', ')}`);
          }
        }
      } catch (err) {
        console.log(`  UID=${e.uid} erro: ${err.message}`);
      }
      // pausa curta pra não estourar rate limit
      await new Promise(r => setTimeout(r, 400));
      if (count % 5 === 0) console.log(`  ... ${count}/${semMatch.length}`);
    }

    console.log(`\n[SCAN] matches totais: ${matches.length}`);
    for (const m of matches) {
      console.log(`\n  UID=${m.uid} date=${m.date?.slice(0,10)} fonte=${m.fonte}`);
      console.log(`  from=${m.from}`);
      console.log(`  subject=${m.subject}`);
      console.log(`  encontrados=${m.encontrados.join(', ')}`);
      console.log(`  anexos=${JSON.stringify(m.attachments)}`);
    }

    // Salvar mais recente pra análise
    if (matches.length > 0) {
      const maisRecente = matches.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
      console.log(`\n[PICK] mais recente: UID=${maisRecente.uid} date=${maisRecente.date}`);

      const msgs = client.fetch(maisRecente.uid, { source: true, uid: true }, { uid: true });
      for await (const m of msgs) {
        const parsed = await simpleParser(m.source);
        const pdfAnexos = (parsed.attachments || []).filter(a => (a.filename || '').toLowerCase().endsWith('.pdf'));
        const outDir = path.join(__dirname, '..', 'tmp-diagnostico');
        fs.mkdirSync(outDir, { recursive: true });
        for (const a of pdfAnexos) {
          const outPath = path.join(outDir, `fatura-luciano-uid${maisRecente.uid}.pdf`);
          fs.writeFileSync(outPath, a.content);
          console.log(`  salvo: ${outPath} (${a.content.length} bytes)`);
        }
        // Salvar texto também
        const txtPath = path.join(outDir, `fatura-luciano-uid${maisRecente.uid}.txt`);
        fs.writeFileSync(txtPath, parsed.text || parsed.html || '(sem texto)');
        console.log(`  texto salvo: ${txtPath}`);
      }
    }
  } finally {
    lock.release();
  }

  await client.logout();
}

main().catch(e => { console.error(e); process.exit(1); });
