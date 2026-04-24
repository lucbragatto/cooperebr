/**
 * Filtra emails EDP da INBOX (90 dias) cujo filename de anexo
 * contém a UC do Luciano (canônica ou legada). Só bodyStructure.
 */
const { ImapFlow } = require('imapflow');
require('dotenv').config();

const ALVOS = ['0400702214', '160085263'];

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
    const dias = Number(process.env.DIAS || 90);
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    const [a, b] = await Promise.all([
      client.search({ from: 'edpcontaporemail', since: desde }),
      client.search({ from: 'edpbr', since: desde }),
    ]);
    const uids = [...new Set([...a, ...b])];
    console.log(`EDP 90d: ${uids.length}`);

    const matches = [];
    for await (const msg of client.fetch(uids, { envelope: true, uid: true, flags: true, bodyStructure: true })) {
      const attachments = [];
      const walk = (node) => {
        if (!node) return;
        const fn = node.dispositionParameters?.filename || node.parameters?.name;
        if (fn) attachments.push({ filename: fn, size: node.size });
        if (node.childNodes) for (const c of node.childNodes) walk(c);
      };
      walk(msg.bodyStructure);
      const matchedAttach = attachments.filter(a => ALVOS.some(v => (a.filename || '').includes(v)));
      if (matchedAttach.length > 0) {
        matches.push({
          uid: msg.uid,
          date: msg.envelope.date?.toISOString().slice(0, 10),
          seen: msg.flags?.has('\\Seen') ? 'LIDO' : 'UNREAD',
          from: msg.envelope.from?.[0]?.address,
          filenames: matchedAttach.map(a => a.filename),
        });
      }
    }
    matches.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    console.log(`\n| UID  | Date       | Seen   | Filename                                           |`);
    console.log(`|------|------------|--------|---------------------------------------------------|`);
    for (const m of matches) {
      const files = m.filenames.join('; ');
      console.log(`| ${String(m.uid).padEnd(4)} | ${m.date} | ${m.seen.padEnd(6)} | ${files} |`);
    }
    console.log(`\nTotal faturas do Luciano (90d): ${matches.length}`);
  } finally {
    lock.release();
  }
  await client.logout();
}
main().catch(e => { console.error(e); process.exit(1); });
