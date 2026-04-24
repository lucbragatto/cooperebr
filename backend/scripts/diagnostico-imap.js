/**
 * Diagnóstico read-only do inbox IMAP.
 * - Conecta em contato@cooperebr.com.br
 * - Lista pastas
 * - Busca emails com indícios de fatura da EDP (últimos 6 meses)
 * - Separa: já processados (pasta "Processados") vs não lidos (INBOX)
 * - Não altera flags nem move nada
 */
const { ImapFlow } = require('imapflow');
require('dotenv').config();

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
  console.log('[IMAP] conectado em', process.env.EMAIL_IMAP_USER);

  // Lista pastas
  const mailboxes = await client.list();
  console.log('\n[PASTAS]');
  for (const m of mailboxes) {
    console.log(' -', m.path);
  }

  const desde = new Date();
  desde.setMonth(desde.getMonth() - 6);

  async function buscarEDP(pasta, rotulo) {
    try {
      const lock = await client.getMailboxLock(pasta, { readonly: true });
      try {
        const uids = await client.search({
          or: [
            { from: 'edp' },
            { from: 'edponline' },
            { from: 'noresponder' },
            { subject: 'EDP' },
            { subject: 'fatura' },
            { subject: 'Conta' },
          ],
          since: desde,
        });
        console.log(`\n[${rotulo}] emails EDP/fatura últimos 6 meses: ${uids.length}`);
        if (uids.length === 0) return [];
        const amostras = [];
        let count = 0;
        for await (const msg of client.fetch(uids, { envelope: true, uid: true, flags: true })) {
          const from = msg.envelope.from?.[0]?.address || '';
          const subject = msg.envelope.subject || '';
          const date = msg.envelope.date?.toISOString() || '';
          const lido = msg.flags?.has('\\Seen') ? 'LIDO' : 'NAO_LIDO';
          amostras.push({ uid: msg.uid, date, from, subject, lido });
          count++;
          if (count >= 30) break;
        }
        for (const s of amostras) {
          console.log(`  - uid=${s.uid} ${s.date.slice(0, 10)} ${s.lido.padEnd(9)} ${s.from} | ${s.subject.slice(0, 80)}`);
        }
        return amostras;
      } finally {
        lock.release();
      }
    } catch (err) {
      console.log(`[${rotulo}] ERRO: ${err.message}`);
      return [];
    }
  }

  const desdeRecente = new Date();
  desdeRecente.setMonth(desdeRecente.getMonth() - 2);

  // Emails mais recentes na INBOX (todos)
  async function recentes(pasta) {
    try {
      const lock = await client.getMailboxLock(pasta, { readonly: true });
      try {
        const uids = await client.search({ since: desdeRecente });
        console.log(`\n[${pasta}] TOTAL ${uids.length} emails últimos 2 meses`);
        const lastUids = uids.slice(-15);
        let naoLidos = 0, edpNaoLidos = 0;
        for await (const msg of client.fetch(lastUids, { envelope: true, uid: true, flags: true })) {
          const from = msg.envelope.from?.[0]?.address || '';
          const subj = msg.envelope.subject || '';
          const date = msg.envelope.date?.toISOString() || '';
          const lido = msg.flags?.has('\\Seen') ? 'LIDO    ' : 'NAO_LIDO';
          if (!msg.flags?.has('\\Seen')) {
            naoLidos++;
            if (from.toLowerCase().includes('edp') || subj.toLowerCase().includes('edp') || subj.toLowerCase().includes('fatura')) edpNaoLidos++;
          }
          console.log(`  ${date.slice(0, 10)} ${lido} ${from.slice(0, 35).padEnd(35)} | ${subj.slice(0, 60)}`);
        }
        // Contagem global não lidos
        const allUnread = await client.search({ seen: false });
        const edpUnread = await client.search({ seen: false, from: 'edp' });
        console.log(`  Total NAO LIDO em ${pasta}: ${allUnread.length} (dos quais EDP: ${edpUnread.length})`);
      } finally {
        lock.release();
      }
    } catch (err) {
      console.log(`[${pasta}] ERRO: ${err.message}`);
    }
  }

  await recentes('INBOX');
  await buscarEDP('INBOX', 'INBOX_EDP_TOTAL');

  await client.logout();
}

main().catch(e => { console.error(e); process.exit(1); });
