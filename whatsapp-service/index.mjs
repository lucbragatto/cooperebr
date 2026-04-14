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
const WHATSAPP_WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET;
if (!WHATSAPP_WEBHOOK_SECRET) {
  console.error('❌ WHATSAPP_WEBHOOK_SECRET não definido no .env — abortando');
  process.exit(1);
}
const BACKEND_WEBHOOK_URL =
  process.env.BACKEND_WEBHOOK_URL || `http://localhost:3000/whatsapp/webhook-incoming?secret=${WHATSAPP_WEBHOOK_SECRET}`;
const AUTH_DIR = './auth_info';

const logger = pino({ level: 'warn' });

// ─── Estado da conexão ───────────────────────────────────────────────
let sock = null;
let connectionStatus = 'disconnected';
let currentQR = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

// BUG-WA-005: Buffer de mensagens durante reconexão + backoff exponencial com jitter
const messageBuffer = [];
const MAX_BUFFER_SIZE = 200;
const MAX_BUFFER_AGE_MS = 5 * 60 * 1000; // 5 minutos

function calcBackoffWithJitter(attempt) {
  const baseDelay = 1000;
  const maxDelay = 60000;
  const exponential = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = Math.random() * exponential * 0.3;
  return Math.round(exponential + jitter);
}

function bufferMessage(to, text) {
  if (messageBuffer.length >= MAX_BUFFER_SIZE) {
    console.warn(`⚠️ Buffer de mensagens cheio (${MAX_BUFFER_SIZE}), descartando mensagem mais antiga`);
    messageBuffer.shift();
  }
  messageBuffer.push({ to, text, timestamp: Date.now() });
}

async function flushMessageBuffer() {
  if (messageBuffer.length === 0) return;
  const now = Date.now();
  console.log(`📤 Enviando ${messageBuffer.length} mensagem(ns) do buffer...`);
  while (messageBuffer.length > 0) {
    const msg = messageBuffer.shift();
    // Descartar mensagens muito antigas
    if (now - msg.timestamp > MAX_BUFFER_AGE_MS) {
      console.log(`⏭️ Mensagem descartada (expirou): ${msg.to}`);
      continue;
    }
    try {
      const jid = toJid(msg.to);
      await sock.sendMessage(jid, { text: msg.text });
    } catch (err) {
      console.error(`❌ Falha ao enviar mensagem do buffer para ${msg.to}: ${err.message}`);
    }
    // Delay entre mensagens para evitar rate limit
    await new Promise(r => setTimeout(r, 500));
  }
}

// ─── Normalizar telefone para JID ────────────────────────────────────
function toJid(phone) {
  let digits = phone.replace(/\D/g, '');
  if (digits.length <= 11 && !digits.startsWith('55')) {
    digits = '55' + digits;
  }
  return digits + '@s.whatsapp.net';
}

// ─── CoopereAI — fallback inteligente ─────────────────────────────────
const COOPERE_AI_URL =
  process.env.COOPERE_AI_URL || 'http://localhost:18789/api/sessions/send';

async function askCoopereAI(userMessage, senderInfo = {}) {
  const context = [
    senderInfo.nome ? `Nome: ${senderInfo.nome}` : null,
    senderInfo.telefone ? `Tel: ${senderInfo.telefone}` : null,
    senderInfo.cooperativa ? `Cooperativa: ${senderInfo.cooperativa}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const fullMessage = context
    ? `[${context}] ${userMessage}`
    : userMessage;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(COOPERE_AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'coop', message: fullMessage }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`⚠️ CoopereAI HTTP ${res.status}`);
      return 'Olá! No momento não consigo acessar a assistente virtual. Por favor, tente novamente em instantes.';
    }

    const data = await res.json();
    return data.reply || data.response || data.text || 'Olá!';
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'timeout' : err.message;
    console.error(`⚠️ CoopereAI ${reason}`);
    return 'Olá! No momento não consigo acessar a assistente virtual. Por favor, tente novamente em instantes.';
  }
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
      // BUG-WA-005: Flush mensagens acumuladas durante reconexão
      flushMessageBuffer().catch(err => console.error('❌ Erro ao flush buffer:', err.message));
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
        // BUG-WA-005: Backoff exponencial com jitter para evitar reconnection storm
        const delay = calcBackoffWithJitter(reconnectAttempts);
        console.log(`⚠️  Desconectado (code: ${statusCode}). Tentativa ${reconnectAttempts}/${MAX_RECONNECT} em ${(delay / 1000).toFixed(1)}s...`);
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

      const rawJid = msg.key.remoteJid || '';
      // Ignorar grupos
      if (rawJid.includes('@g.us')) continue;

      let telefone = rawJid.replace('@s.whatsapp.net', '').replace('@lid', '');

      // Resolver LID para número real via lid-mapping reverso
      if (rawJid.includes('@lid')) {
        const lidId = rawJid.replace('@lid', '');
        try {
          const { readFileSync } = await import('fs');
          const mapFile = `${AUTH_DIR}/lid-mapping-${lidId}_reverse.json`;
          const mapped = JSON.parse(readFileSync(mapFile, 'utf8'));
          // O arquivo contém o número como string ou objeto
          telefone = typeof mapped === 'string' ? mapped.replace(/\D/g, '') : String(mapped).replace(/\D/g, '');
          console.log(`🔄 LID ${lidId} → ${telefone}`);
        } catch {
          console.log(`⚠️ LID ${lidId} sem mapeamento — ignorando`);
          continue;
        }
      }

      if (!telefone || telefone.length > 15) {
        console.log(`⚠️ JID não resolvido: ${rawJid} — ignorando`);
        continue;
      }

      try {
        let tipo = 'texto';
        let corpo = null;
        let mediaBase64 = null;
        let mimeType = null;

        // Normalizar: documentWithCaptionMessage wraps documentMessage
        const rawMsg = msg.message.documentWithCaptionMessage?.message || msg.message;

        const docMsg = rawMsg.documentMessage;
        const imgMsg = rawMsg.imageMessage;
        const audioMsg = rawMsg.audioMessage;
        const videoMsg = rawMsg.videoMessage;

        // Resposta de lista interativa (listResponseMessage)
        const listResponse = rawMsg.listResponseMessage;
        // Resposta de botão interativo (buttonsResponseMessage)
        const buttonResponse = rawMsg.buttonsResponseMessage;

        if (listResponse) {
          tipo = 'texto';
          corpo = listResponse.singleSelectReply?.selectedRowId || listResponse.title || null;
        } else if (buttonResponse) {
          tipo = 'texto';
          corpo = buttonResponse.selectedButtonId || buttonResponse.selectedDisplayText || null;
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
        } else if (audioMsg) {
          tipo = 'audio';
          mimeType = audioMsg.mimetype;
        } else if (videoMsg) {
          tipo = 'video';
          mimeType = videoMsg.mimetype;
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
    const { to, text } = req.body;
    if (!to || !text) {
      return res.status(400).json({ error: 'Campos "to" e "text" são obrigatórios' });
    }

    // BUG-WA-005: Buffer mensagens durante reconexão em vez de rejeitar
    if (connectionStatus !== 'connected' || !sock) {
      bufferMessage(to, text);
      return res.json({ ok: true, buffered: true, message: 'Mensagem será enviada após reconexão' });
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
      listMessage: {
        title: '',
        description: text,
        footerText: footer || '',
        buttonText: buttonText || 'Selecione',
        listType: 1,
        sections,
      },
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
      listMessage: {
        title: '',
        description: text,
        footerText: footer || 'CoopereBR',
        buttonText: 'Escolha uma opção',
        listType: 1,
        sections,
      },
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

// POST /send-interactive — envia botões ou lista interativa
app.post('/send-interactive', async (req, res) => {
  try {
    if (connectionStatus !== 'connected' || !sock) {
      return res.status(503).json({ error: 'WhatsApp não está conectado' });
    }

    const { to, type, message } = req.body;
    if (!to || !type || !message) {
      return res.status(400).json({ error: 'Campos "to", "type" e "message" são obrigatórios' });
    }

    const jid = toJid(to);

    if (type === 'buttons') {
      // Enviar como lista interativa (mais confiável que buttons no Baileys)
      const sections = [{
        title: 'Opções',
        rows: (message.buttons || []).map((b) => ({
          title: b.buttonText?.displayText || b.texto || 'Opção',
          rowId: b.buttonId || b.id || String(Math.random()),
        })),
      }];

      await sock.sendMessage(jid, {
        listMessage: {
          title: '',
          description: message.text || '',
          footerText: message.footerText || 'CoopereBR',
          buttonText: 'Escolha uma opção',
          listType: 1,
          sections,
        },
      });
    } else if (type === 'list') {
      await sock.sendMessage(jid, {
        listMessage: {
          title: message.title || '',
          description: message.text || '',
          footerText: message.footerText || '',
          buttonText: message.buttonText || 'Ver opções',
          listType: 1,
          sections: message.sections || [],
        },
      });
    } else {
      return res.status(400).json({ error: `Tipo "${type}" não suportado. Use "buttons" ou "list".` });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Erro ao enviar interativo:', err.message);
    // Fallback: enviar como texto com opções numeradas pelo rowId/buttonId
    try {
      const { to, type, message } = req.body;
      let fallbackText = message.text || '';
      if (type === 'buttons' && message.buttons) {
        fallbackText += '\n';
        message.buttons.forEach((b) => {
          const texto = b.buttonText?.displayText || b.texto || 'Opção';
          const id = b.buttonId || b.id || '';
          fallbackText += `\n*${id}.* ${texto}`;
        });
        fallbackText += '\n\n_Responda com o número da opção._';
      } else if (type === 'list' && message.sections) {
        for (const section of message.sections) {
          for (const row of (section.rows || [])) {
            const id = row.rowId || '';
            fallbackText += `\n*${id}.* ${row.title}`;
            if (row.description) fallbackText += ` — _${row.description}_`;
          }
        }
        fallbackText += '\n\n_Responda com o número da opção desejada._';
      }
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
