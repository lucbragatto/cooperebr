import express from 'express';
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  makeCacheableSignalKeyStore,
} from 'baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

const PORT = process.env.PORT || 3002;
const BACKEND_WEBHOOK_URL =
  process.env.BACKEND_WEBHOOK_URL || 'http://localhost:3000/whatsapp/webhook-incoming';
const AUTH_DIR = './auth_info';

const logger = pino({ level: 'warn' });

// ─── Estado da conexão ───────────────────────────────────────────────
let sock = null;
let connectionStatus = 'disconnected';
let currentQR = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

// ─── Normalizar telefone para JID ────────────────────────────────────
function toJid(phone) {
  let digits = phone.replace(/\D/g, '');
  if (digits.length <= 11 && !digits.startsWith('55')) {
    digits = '55' + digits;
  }
  return digits + '@s.whatsapp.net';
}

// ─── Iniciar conexão Baileys ─────────────────────────────────────────
async function startBaileys() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    version: [2, 3000, 1034195523],
    browser: ['Chrome', 'Chrome', '145.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      connectionStatus = 'awaiting_qr';
      console.log('\n📱 QR Code gerado — escaneie com o WhatsApp!\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      connectionStatus = 'connected';
      currentQR = null;
      reconnectAttempts = 0;
      console.log('✅ WhatsApp conectado com sucesso!');
    }

    if (connection === 'close') {
      connectionStatus = 'disconnected';
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut =
        statusCode === DisconnectReason.loggedOut ||
        statusCode === 401;

      if (isLoggedOut) {
        console.log('🔒 Sessão encerrada (logout). Escaneie o QR novamente.');
        import('fs').then((fs) => {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          reconnectAttempts = 0;
          startBaileys();
        });
      } else if (reconnectAttempts < MAX_RECONNECT) {
        reconnectAttempts++;
        const delay = Math.min(3000 * reconnectAttempts, 15000);
        console.log(`⚠️  Desconectado (code: ${statusCode}). Tentativa ${reconnectAttempts}/${MAX_RECONNECT} em ${delay / 1000}s...`);
        setTimeout(startBaileys, delay);
      } else {
        console.log(`❌ Máximo de reconexões atingido (code: ${statusCode}). Aguardando chamada manual via /status ou reinicie o serviço.`);
        connectionStatus = 'failed';
      }
    }
  });

  // ─── Mensagens recebidas → encaminhar ao backend ─────────────────
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (!msg.message) continue;

      const telefone = msg.key.remoteJid?.replace('@s.whatsapp.net', '') || '';
      if (!telefone || telefone.includes('@g.us')) continue; // ignorar grupos

      try {
        let tipo = 'texto';
        let corpo = null;
        let mediaBase64 = null;
        let mimeType = null;

        // Normalizar: documentWithCaptionMessage wraps documentMessage
        const rawMsg = msg.message.documentWithCaptionMessage?.message || msg.message;

        const docMsg = rawMsg.documentMessage;
        const imgMsg = rawMsg.imageMessage;

        // Resposta de lista interativa (listResponseMessage)
        const listResponse = rawMsg.listResponseMessage;

        if (listResponse) {
          tipo = 'texto';
          // Enviar o rowId como corpo para o backend identificar a seleção
          corpo = listResponse.singleSelectReply?.selectedRowId || listResponse.title || null;
        } else if (imgMsg) {
          tipo = 'imagem';
          mimeType = imgMsg.mimetype;
          corpo = imgMsg.caption || null;
          const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage });
          mediaBase64 = buffer.toString('base64');
        } else if (docMsg) {
          tipo = 'documento';
          mimeType = docMsg.mimetype;
          corpo = docMsg.caption || null;
          const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage });
          mediaBase64 = buffer.toString('base64');
        } else {
          corpo =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            null;
        }

        const payload = { telefone, tipo, corpo, mediaBase64, mimeType };

        console.log(`📩 Mensagem de ${telefone} (${tipo})`);

        await fetch(BACKEND_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error(`❌ Erro ao encaminhar mensagem de ${telefone}:`, err.message);
      }
    }
  });
}

// ─── Express API ─────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// GET /status
app.get('/status', (_req, res) => {
  res.json({ status: connectionStatus, qrCode: currentQR });
});

// POST /reconnect — força reconexão
app.post('/reconnect', async (_req, res) => {
  try {
    if (sock) {
      sock.end(undefined);
      sock = null;
    }
    reconnectAttempts = 0;
    connectionStatus = 'disconnected';
    currentQR = null;
    await startBaileys();
    res.json({ ok: true, message: 'Reconectando...' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /send-message
app.post('/send-message', async (req, res) => {
  try {
    if (connectionStatus !== 'connected' || !sock) {
      return res.status(503).json({ error: 'WhatsApp não está conectado' });
    }

    const { to, text } = req.body;
    if (!to || !text) {
      return res.status(400).json({ error: 'Campos "to" e "text" são obrigatórios' });
    }

    const jid = toJid(to);
    await sock.sendMessage(jid, { text });
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Erro ao enviar mensagem:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /send-list — envia mensagem interativa com lista de opções
app.post('/send-list', async (req, res) => {
  try {
    if (connectionStatus !== 'connected' || !sock) {
      return res.status(503).json({ error: 'WhatsApp não está conectado' });
    }

    const { to, text, footer, buttonText, sections } = req.body;
    if (!to || !text || !sections?.length) {
      return res.status(400).json({ error: 'Campos "to", "text" e "sections" são obrigatórios' });
    }

    const jid = toJid(to);
    await sock.sendMessage(jid, {
      text,
      footer: footer || '',
      title: '',
      buttonText: buttonText || 'Selecione',
      sections,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Erro ao enviar lista:', err.message);
    // Fallback: se lista interativa falhar, enviar como texto simples
    try {
      const { to, text, sections } = req.body;
      let fallbackText = text + '\n';
      for (const section of (sections || [])) {
        if (section.title) fallbackText += `\n*${section.title}*\n`;
        for (const row of (section.rows || [])) {
          fallbackText += `▸ *${row.title}*`;
          if (row.description) fallbackText += ` — ${row.description}`;
          fallbackText += '\n';
        }
      }
      fallbackText += '\n_Responda com o número da opção desejada._';
      const jid = toJid(to);
      await sock.sendMessage(jid, { text: fallbackText });
      res.json({ ok: true, fallback: true });
    } catch (fallbackErr) {
      res.status(500).json({ error: err.message });
    }
  }
});

// POST /send-buttons — envia mensagem interativa com botões
app.post('/send-buttons', async (req, res) => {
  try {
    if (connectionStatus !== 'connected' || !sock) {
      return res.status(503).json({ error: 'WhatsApp não está conectado' });
    }

    const { to, text, footer, buttons } = req.body;
    if (!to || !text || !buttons?.length) {
      return res.status(400).json({ error: 'Campos "to", "text" e "buttons" são obrigatórios' });
    }

    const jid = toJid(to);

    // Tentar enviar como lista interativa (mais confiável que buttons no Baileys)
    const sections = [{
      title: 'Opções',
      rows: buttons.map((b) => ({
        title: b.texto,
        rowId: b.id,
      })),
    }];

    await sock.sendMessage(jid, {
      text,
      footer: footer || 'CoopereBR',
      title: '',
      buttonText: 'Escolha uma opção',
      sections,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Erro ao enviar botões:', err.message);
    // Fallback: enviar como texto numerado
    try {
      const { to, text, buttons } = req.body;
      let fallbackText = text + '\n\n';
      (buttons || []).forEach((b, i) => {
        fallbackText += `*${i + 1}.* ${b.texto}\n`;
      });
      fallbackText += '\n_Responda com o número ou nome da opção._';
      const jid = toJid(to);
      await sock.sendMessage(jid, { text: fallbackText });
      res.json({ ok: true, fallback: true });
    } catch (fallbackErr) {
      res.status(500).json({ error: err.message });
    }
  }
});

// POST /send-document
app.post('/send-document', async (req, res) => {
  try {
    if (connectionStatus !== 'connected' || !sock) {
      return res.status(503).json({ error: 'WhatsApp não está conectado' });
    }

    const { to, filePath, filename, caption } = req.body;
    if (!to || !filePath) {
      return res.status(400).json({ error: 'Campos "to" e "filePath" são obrigatórios' });
    }

    const { readFile } = await import('fs/promises');
    const buffer = await readFile(filePath);
    const jid = toJid(to);

    await sock.sendMessage(jid, {
      document: buffer,
      mimetype: 'application/pdf',
      fileName: filename || 'documento.pdf',
      caption: caption || '',
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Erro ao enviar documento:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Iniciar servidor ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 WhatsApp Service rodando na porta ${PORT}`);
  console.log(`📡 Webhook: ${BACKEND_WEBHOOK_URL}\n`);
  startBaileys();
});
