/**
 * Lista emails EDP (todos: lidos + não-lidos) últimos 60 dias.
 * Só metadata: UID, subject, date, flag Seen.
 */
const { ImapFlow } = require('imapflow');
require('dotenv').config();

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
    desde.setDate(desde.getDate() - 60);
    const [uidsA, uidsB, uidsC] = await Promise.all([
      client.search({ from: 'edp', since: desde }),
      client.search({ from: 'edpcontaporemail', since: desde }),
      client.search({ from: 'edpbr', since: desde }),
    ]);
    const uids = [...new Set([...uidsA, ...uidsB, ...uidsC])];
    console.log(`Emails EDP 60d: from:edp=${uidsA.length} from:edpcontaporemail=${uidsB.length} from:edpbr=${uidsC.length} uniq=${uids.length}`);

    const UCL = ['0400702214', '160085263'];
    const lista = [];
    for await (const msg of client.fetch(uids, { envelope: true, uid: true, flags: true })) {
      const subj = msg.envelope.subject || '';
      const from = msg.envelope.from?.[0]?.address || '';
      const matchUc = UCL.find(u => subj.includes(u)) || '';
      lista.push({
        uid: msg.uid,
        date: msg.envelope.date?.toISOString().slice(0, 10),
        seen: msg.flags?.has('\\Seen') ? 'LIDO' : 'UNREAD',
        from,
        subject: subj,
        matchUcLuciano: matchUc,
      });
    }
    lista.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Tabela
    console.log('| UID  | Date       | Seen   | From                                | Subject                                    | Match UC |');
    console.log('|------|------------|--------|-------------------------------------|--------------------------------------------|----------|');
    for (const r of lista) {
      console.log(`| ${String(r.uid).padEnd(4)} | ${r.date} | ${r.seen.padEnd(6)} | ${r.from.slice(0, 35).padEnd(35)} | ${r.subject.slice(0, 42).padEnd(42)} | ${r.matchUcLuciano || '-'} |`);
    }

    const comUc = lista.filter(r => r.matchUcLuciano);
    console.log(`\nEmails com UC Luciano no subject: ${comUc.length}`);
  } finally {
    lock.release();
  }
  await client.logout();
}
main().catch(e => { console.error(e); process.exit(1); });
