/**
 * Lista faturas EDP (remetente edpcontaporemail) recentes na INBOX
 * com nome e tamanho dos anexos PDF. Read-only.
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
    desde.setMonth(desde.getMonth() - 3);
    const uids = await client.search({ from: 'edpcontaporemail', since: desde });
    console.log(`Total faturas de edpcontaporemail últimos 3 meses: ${uids.length}`);
    const lista = [];
    for await (const msg of client.fetch(uids, { envelope: true, uid: true, bodyStructure: true, flags: true })) {
      const attachments = [];
      const walk = (node) => {
        if (!node) return;
        if (node.disposition === 'attachment' && node.dispositionParameters?.filename) {
          attachments.push({ filename: node.dispositionParameters.filename, size: node.size });
        }
        if (node.childNodes) for (const c of node.childNodes) walk(c);
      };
      walk(msg.bodyStructure);
      lista.push({
        uid: msg.uid,
        date: msg.envelope.date,
        lido: msg.flags?.has('\\Seen'),
        subject: msg.envelope.subject,
        attachments,
      });
    }
    lista.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    for (const m of lista.slice(0, 30)) {
      const anex = m.attachments.map(a => `${a.filename}(${Math.round(a.size/1024)}KB)`).join('; ');
      console.log(`UID=${m.uid} ${m.date?.toISOString().slice(0,10)} ${m.lido ? 'LIDO' : 'UNREAD'} | ${anex || 'sem-anexo'}`);
    }
  } finally {
    lock.release();
  }
  await client.logout();
}
main().catch(e => { console.error(e); process.exit(1); });
