/**
 * Busca fatura do Luciano parseando os XMLs das faturas EDP.
 * XML é ~20KB e tem UC em texto claro (NF-e de energia).
 */
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ALVOS = ['0400702214', '160085263', '89089324704', 'LUCIANO COSTA BRAGATTO', 'JOAQUIM LIRIO'];

async function main() {
  const client = new ImapFlow({
    host: process.env.EMAIL_IMAP_HOST || 'imap.gmail.com',
    port: Number(process.env.EMAIL_IMAP_PORT || 993),
    secure: true,
    auth: { user: process.env.EMAIL_IMAP_USER, pass: process.env.EMAIL_IMAP_PASS },
    tls: { rejectUnauthorized: false },
    logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock('INBOX', { readonly: true });
  try {
    const desde = new Date();
    desde.setMonth(desde.getMonth() - 3);
    const uids = await client.search({ from: 'edpcontaporemail', since: desde });
    console.log(`Total: ${uids.length} faturas (últimos 3 meses)`);

    const matches = [];
    let processados = 0;

    for (const uid of uids) {
      processados++;
      try {
        const msgs = client.fetch(uid, { source: true, uid: true, envelope: true }, { uid: true });
        for await (const msg of msgs) {
          const parsed = await simpleParser(msg.source);
          const xmls = (parsed.attachments || []).filter(a => (a.filename || '').toLowerCase().endsWith('.xml'));
          for (const xml of xmls) {
            const conteudo = xml.content.toString('utf-8');
            const hits = ALVOS.filter(a => conteudo.includes(a));
            if (hits.length > 0) {
              const pdfs = (parsed.attachments || []).filter(a => (a.filename || '').toLowerCase().endsWith('.pdf'));
              matches.push({
                uid,
                date: msg.envelope.date?.toISOString(),
                subject: msg.envelope.subject,
                xmlFile: xml.filename,
                pdfFile: pdfs[0]?.filename,
                pdfSize: pdfs[0]?.content.length,
                hits,
                xmlContent: conteudo,
                pdfContent: pdfs[0]?.content,
              });
            }
          }
        }
      } catch (err) {
        console.log(`  UID=${uid} erro: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 300));
      if (processados % 20 === 0) console.log(`  ... ${processados}/${uids.length} (matches até agora: ${matches.length})`);
    }

    console.log(`\n\n=== MATCHES ===`);
    for (const m of matches) {
      console.log(`\nUID=${m.uid} ${m.date?.slice(0, 10)}`);
      console.log(`  subject=${m.subject}`);
      console.log(`  xml=${m.xmlFile}  pdf=${m.pdfFile} (${Math.round((m.pdfSize || 0) / 1024)}KB)`);
      console.log(`  hits=${m.hits.join(', ')}`);
    }

    // Salvar a mais recente COM CPF/UC do Luciano (não só endereço)
    const fortes = matches.filter(m => m.hits.some(h => h === '89089324704' || h === '0400702214' || h === '160085263'));
    console.log(`\nMatches FORTES (CPF/UC Luciano): ${fortes.length}`);
    if (fortes.length > 0) {
      const maisRecente = fortes.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
      console.log(`PICK FORTE: UID=${maisRecente.uid} date=${maisRecente.date}`);
      const outDir = path.join(__dirname, '..', 'tmp-diagnostico');
      fs.mkdirSync(outDir, { recursive: true });
      if (maisRecente.pdfContent) {
        const out = path.join(outDir, `luciano-edp-uid${maisRecente.uid}.pdf`);
        fs.writeFileSync(out, maisRecente.pdfContent);
        console.log(`\nSalvo PDF: ${out}`);
      }
      const xmlOut = path.join(outDir, `luciano-edp-uid${maisRecente.uid}.xml`);
      fs.writeFileSync(xmlOut, maisRecente.xmlContent);
      console.log(`Salvo XML: ${xmlOut}`);
    }
  } finally {
    lock.release();
  }
  await client.logout();
}
main().catch(e => { console.error(e); process.exit(1); });
