import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { PrismaService } from '../prisma.service';
import { FaturasService } from '../faturas/faturas.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { FaturasCampanhaService } from './faturas-campanha.service';
import {
  matchAliasCampanha,
  localPartDoMailboxTenant,
} from './lib/campanha-alias';
import { AsPlatform } from '../common/tenant-context';


interface AnexoPdf {
  filename: string;
  content: Buffer;
}

interface EmailProcessado {
  remetente: string;
  assunto: string;
  anexos: AnexoPdf[];
  textoCorpo: string;
  // Sprint Máscara (06/07/2026) — todos os destinatários do header To
  // (parsed.to.value). Usado pra detectar `<local>+<alias>@<domain>` e
  // rotear pro ramo campanha antes do fluxo cooperado normal.
  destinatarios: string[];
}

@Injectable()
export class EmailMonitorService {
  private readonly logger = new Logger(EmailMonitorService.name);
  private processando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly faturasService: FaturasService,
    private readonly whatsappSender: WhatsappSenderService,
    // Sprint Máscara (06/07/2026) — ramo campanha (fatura de funcionário
    // pré-cadastro via alias contato+X@).
    private readonly faturasCampanhaService: FaturasCampanhaService,
  ) {}

  // ── Config helpers (com isolamento por tenant) ─────────────────────

  async getConfigValue(chave: string, cooperativaId: string): Promise<string | null> {
    return this.getConfigFromDb(chave, cooperativaId);
  }

  private async getConfigFromDb(chave: string, cooperativaId: string): Promise<string | null> {
    const config = await this.prisma.configTenant.findFirst({
      where: { chave, cooperativaId },
    });
    return config?.valor ?? null;
  }

  // ── Buscar cooperativas com monitor de e-mail ativo ────────────────

  private async getCooperativasComMonitorAtivo(): Promise<string[]> {
    const configs = await this.prisma.configTenant.findMany({
      where: { chave: 'email.monitor.ativo', valor: 'true' },
      select: { cooperativaId: true },
    });
    return configs.map((c) => c.cooperativaId).filter(Boolean) as string[];
  }

  private async criarClientePorCooperativa(cooperativaId: string): Promise<ImapFlow> {
    // D-novo-BR F1.5 M8 (31/05/2026) — credenciais DEVEM vir do banco do tenant.
    // Fallback pra ENV global removido — vazava credencial entre tenants quando
    // a config do tenant estava ausente (SUPER_ADMIN sem cooperativaId chamando
    // processarManual usaria credencial "default" do ENV).
    const userDb = await this.getConfigFromDb('email.monitor.user', cooperativaId);
    const passDb = await this.getConfigFromDb('email.monitor.pass', cooperativaId);

    if (!userDb || !passDb) {
      throw new Error(
        `Credenciais IMAP do tenant ${cooperativaId} não configuradas. ` +
          'Cadastre email.monitor.user e email.monitor.pass em ConfigTenant ' +
          '(fallback ENV removido por segurança multi-tenant).',
      );
    }

    const hostDb = await this.getConfigFromDb('email.monitor.host', cooperativaId);
    const portDb = await this.getConfigFromDb('email.monitor.port', cooperativaId);
    const host = hostDb || 'imap.gmail.com';
    const port = Number(portDb || '993');
    const pass = Buffer.from(passDb, 'base64').toString('utf-8');

    // ⚠️ tls.rejectUnauthorized: false — workaround pra SSL inspection do Kaspersky
    // local que injeta cert self-signed na cadeia TLS. Bloqueava CRON @6h ha semanas
    // (so 9 cooperados auditados em 6 meses). TODO: remover ao migrar pra cloud.
    return new ImapFlow({
      host,
      port,
      secure: true,
      auth: { user: userDb, pass },
      logger: false,
      tls: { rejectUnauthorized: false },
    });
  }

  // ── Cron: verifica e-mails a cada 30 min para cada tenant ativo ────

  @Cron('0 0 6 * * *') // 1x por dia às 6h (pode ser acionado manualmente via POST /email-monitor/processar)


  @AsPlatform()
  async verificarEmailsFaturas() {
    if (this.processando) {
      this.logger.debug('Já processando e-mails de faturas — pulando ciclo');
      return;
    }

    const cooperativas = await this.getCooperativasComMonitorAtivo();
    if (cooperativas.length === 0) return;

    for (const cooperativaId of cooperativas) {
      await this.processarCaixaDeEntrada(cooperativaId);
    }
  }

  // ── Trigger manual: POST /email-monitor/processar ─────────────────

  async processarManual(cooperativaId: string): Promise<{ processados: number; pendentes: number; erros: number }> {
    if (this.processando) {
      return { processados: 0, pendentes: 0, erros: 0 };
    }
    return this.processarCaixaDeEntrada(cooperativaId);
  }

  private async processarCaixaDeEntrada(
    cooperativaId: string,
  ): Promise<{ processados: number; pendentes: number; erros: number }> {
    this.processando = true;
    const resultado = { processados: 0, pendentes: 0, erros: 0 };
    const client = await this.criarClientePorCooperativa(cooperativaId);

    try {
      await client.connect();

      await this.garantirPasta(client, 'Processados');
      await this.garantirPasta(client, 'Pendentes');

      const lock = await client.getMailboxLock('INBOX');

      try {
        const msgs = client.fetch({ seen: false }, { envelope: true, source: true, uid: true });

        // Sprint Máscara (06/07/2026) — cachea alias→convênio pra evitar N
        // queries no loop de mensagens. Uma consulta por ciclo do monitor.
        const conveniosCampanha = await this.carregarConveniosCampanhaAtivos(cooperativaId);
        const localMailbox = localPartDoMailboxTenant(
          await this.getConfigFromDb('email.monitor.user', cooperativaId),
        );

        for await (const msg of msgs) {
          try {
            const email = await this.extrairEmail(msg);
            if (!email) continue;

            if (email.anexos.length === 0) continue;

            // Sprint Máscara (06/07/2026) — ANTES do fluxo cooperado normal,
            // verificar se algum destinatário casa com alias de campanha
            // configurado no tenant. Alias é sinal explícito e mais forte
            // que a heurística `pareceSerFaturaConcessionaria` (RH pode não
            // usar palavras-chave no assunto). EXCLUSÃO MÚTUA com o fluxo
            // cooperado: se bater, roteia pro ramo campanha e pula o resto.
            const matchCampanha = this.detectarConvenioDeCampanha(
              email.destinatarios,
              localMailbox,
              conveniosCampanha,
            );
            if (matchCampanha) {
              const houveErro = await this.processarRamoCampanha(
                email,
                matchCampanha,
                cooperativaId,
                resultado,
              );
              await client.messageMove(
                msg.uid,
                houveErro ? 'Pendentes' : 'Processados',
                { uid: true },
              );
              continue;
            }

            if (!this.pareceSerFaturaConcessionaria(email)) continue;

            // Tentar identificar cooperado por e-mail do remetente ou UC no corpo
            let cooperado = await this.identificarCooperado(email, cooperativaId);

            if (cooperado) {
              // Cooperado identificado pré-OCR → fluxo padrão via uploadConcessionaria
              for (const anexo of email.anexos) {
                try {
                  const base64 = anexo.content.toString('base64');
                  const resultUpload = await this.faturasService.uploadConcessionaria({
                    cooperadoId: cooperado.id,
                    arquivoBase64: base64,
                    tipoArquivo: 'pdf',
                    mesReferencia: this.extrairMesReferencia(email),
                  });
                  resultado.processados++;

                  // Ativar emailFaturasAtivo + notificar cooperado na primeira fatura
                  await this.ativarEmailFaturas(cooperado.id, cooperado.nomeCompleto, cooperativaId);

                  // Notificar admin via WhatsApp
                  const ucNum = (resultUpload.fatura?.dadosExtraidos as Record<string, unknown>)?.numeroUC || 'N/A';
                  await this.notificarAdminWhatsApp(
                    cooperativaId,
                    `📄 Nova fatura recebida via e-mail\n\n👤 Cooperado: ${cooperado.nomeCompleto}\n🔌 UC: ${ucNum}\n📅 Ref: ${this.extrairMesReferencia(email)}\n📊 Status: aguardando aprovação`,
                  );

                  this.logger.log(
                    `Fatura processada: ${anexo.filename} → cooperado ${cooperado.nomeCompleto} [coop: ${cooperativaId}]`,
                  );
                } catch (err) {
                  this.logger.warn(
                    `Erro ao processar anexo ${anexo.filename}: ${(err as Error).message}`,
                  );
                  resultado.erros++;
                }
              }
              await client.messageMove(msg.uid, 'Processados', { uid: true });
            } else {
              // Cooperado NÃO identificado pré-OCR → tentar via OCR (UC/CPF extraídos)
              for (const anexo of email.anexos) {
                try {
                  const base64 = anexo.content.toString('base64');
                  const dadosOcr = await this.faturasService.extrairOcr(base64, 'pdf') as unknown as { numeroUC?: string; documento?: string; mesReferencia?: string; historicoConsumo?: unknown[]; [key: string]: unknown };

                  // Tentar identificar por UC extraída do OCR
                  cooperado = await this.identificarPorOcr(dadosOcr, cooperativaId);

                  if (cooperado) {
                    // Encontrado via OCR → processar normalmente
                    const resultUpload = await this.faturasService.uploadConcessionaria({
                      cooperadoId: cooperado.id,
                      arquivoBase64: base64,
                      tipoArquivo: 'pdf',
                      mesReferencia: this.extrairMesReferencia(email),
                    });
                    resultado.processados++;

                    // Ativar emailFaturasAtivo + notificar cooperado na primeira fatura
                    await this.ativarEmailFaturas(cooperado.id, cooperado.nomeCompleto, cooperativaId);

                    const ucNum = dadosOcr.numeroUC || 'N/A';
                    await this.notificarAdminWhatsApp(
                      cooperativaId,
                      `📄 Nova fatura recebida via e-mail (identificada por OCR)\n\n👤 Cooperado: ${cooperado.nomeCompleto}\n🔌 UC: ${ucNum}\n📅 Ref: ${this.extrairMesReferencia(email)}\n📊 Status: aguardando aprovação`,
                    );

                    this.logger.log(
                      `Fatura processada (via OCR): ${anexo.filename} → cooperado ${cooperado.nomeCompleto} [coop: ${cooperativaId}]`,
                    );
                  } else {
                    // Não identificado nem por OCR → salvar como não identificada
                    await this.criarFaturaNaoIdentificada(dadosOcr, base64, email, cooperativaId);
                    resultado.pendentes++;

                    const ucNum = dadosOcr.numeroUC || 'desconhecida';
                    await this.notificarAdminWhatsApp(
                      cooperativaId,
                      `⚠️ Fatura recebida por e-mail NÃO IDENTIFICADA\n\n📧 Remetente: ${email.remetente}\n🔌 UC (OCR): ${ucNum}\n📄 CPF/CNPJ (OCR): ${dadosOcr.documento || 'não extraído'}\n📅 Ref: ${dadosOcr.mesReferencia || 'N/A'}\n\n🔍 Revisão manual necessária na Central de Faturas`,
                    );

                    this.logger.warn(
                      `Cooperado não identificado (pós-OCR) para e-mail de ${email.remetente} [coop: ${cooperativaId}]`,
                    );
                  }
                } catch (err) {
                  this.logger.warn(
                    `Erro ao processar anexo não identificado ${anexo.filename}: ${(err as Error).message}`,
                  );
                  resultado.erros++;
                }
              }

              if (cooperado) {
                await client.messageMove(msg.uid, 'Processados', { uid: true });
              } else {
                await client.messageMove(msg.uid, 'Pendentes', { uid: true });
              }
            }
          } catch (err) {
            this.logger.warn(`Erro ao processar mensagem: ${(err as Error).message}`);
            resultado.erros++;
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (err) {
      this.logger.error(
        `Erro ao verificar e-mails IMAP [coop: ${cooperativaId}]: ${(err as Error).message}`,
      );
    } finally {
      this.processando = false;
    }

    if (resultado.processados > 0 || resultado.pendentes > 0) {
      this.logger.log(
        `[coop: ${cooperativaId}] Email Monitor: ${resultado.processados} processado(s), ${resultado.pendentes} pendente(s), ${resultado.erros} erro(s)`,
      );
    }

    return resultado;
  }

  // ── Identificação pós-OCR: UC e CPF/CNPJ ──────────────────────────

  private async identificarPorOcr(
    dadosOcr: { numeroUC?: string; documento?: string; [key: string]: unknown },
    cooperativaId: string,
  ): Promise<{ id: string; nomeCompleto: string; cooperativaId: string | null } | null> {
    // 1. Match por número da UC extraído pelo OCR
    const numeroUC = dadosOcr.numeroUC;
    if (numeroUC) {
      const uc = await this.prisma.uc.findFirst({
        // T5 Sprint 5: match pelo campo canônico `uc.numero` (unique).
        // O campo `uc.numeroUC` é legado, nullable — buscar nele sempre
        // retornava null e deixava faturas órfãs. `dadosOcr.numeroUC` é
        // chave do JSON OCR (mantém), distinto do campo do model.
        where: { numero: numeroUC, cooperado: { cooperativaId } },
        include: {
          cooperado: {
            select: { id: true, nomeCompleto: true, cooperativaId: true },
          },
        },
      });
      if (uc?.cooperado) return uc.cooperado;
    }

    // 2. Match por CPF/CNPJ extraído pelo OCR
    const documento = dadosOcr.documento;
    if (documento) {
      const cpfLimpo = documento.replace(/\D/g, '');
      if (cpfLimpo.length >= 11) {
        const cooperado = await this.prisma.cooperado.findFirst({
          where: { cpf: cpfLimpo, cooperativaId },
          select: { id: true, nomeCompleto: true, cooperativaId: true },
        });
        if (cooperado) return cooperado;
      }
    }

    return null;
  }

  // ── Criar FaturaProcessada para faturas não identificadas ──────────

  private async criarFaturaNaoIdentificada(
    dadosOcr: { numeroUC?: string; documento?: string; mesReferencia?: string; historicoConsumo?: unknown[]; [key: string]: unknown },
    base64: string,
    email: EmailProcessado,
    cooperativaId: string,
  ): Promise<void> {
    try {
      const historicoConsumo = dadosOcr.historicoConsumo ?? [];

      // Factory pode resolver ucId via dadosOcr.numeroUC e derivar
      // cooperadoId a partir da UC. Se resolver, upgrade pra PENDENTE_REVISAO.
      const fatura = await this.faturasService.criarFaturaProcessada({
        cooperativaId,
        cooperadoId: null,
        ucId: null,
        arquivoUrl: null,
        dadosExtraidos: {
          ...(dadosOcr as object),
          emailRemetente: email.remetente,
          emailAssunto: email.assunto,
        },
        historicoConsumo: historicoConsumo as object,
        mesesUtilizados: 0,
        mesesDescartados: 0,
        mediaKwhCalculada: 0,
        thresholdUtilizado: 0,
        status: 'PENDENTE',
        mesReferencia: dadosOcr.mesReferencia || null,
        statusRevisao: 'NAO_IDENTIFICADA',
      });

      // Upgrade: se factory identificou UC + cooperado via OCR
      if (fatura.ucId && fatura.cooperadoId) {
        await this.prisma.faturaProcessada.update({
          where: { id: fatura.id },
          data: { statusRevisao: 'PENDENTE_REVISAO' },
        });
        this.logger.log(
          `Fatura ${fatura.id}: identificação automática via numeroUC ` +
          `do OCR. Status NAO_IDENTIFICADA → PENDENTE_REVISAO.`,
        );
      }

      // Criar notificação no sistema também
      await this.prisma.notificacao.create({
        data: {
          titulo: fatura.ucId ? 'Fatura por e-mail identificada automaticamente' : 'Fatura por e-mail não identificada',
          mensagem: `E-mail de ${email.remetente} com assunto "${email.assunto}". UC (OCR): ${dadosOcr.numeroUC || 'N/A'}, CPF (OCR): ${dadosOcr.documento || 'N/A'}. Verifique na Central de Faturas.`,
          tipo: 'ALERTA',
          lida: false,
          cooperativaId,
        },
      });
    } catch (err) {
      this.logger.warn(`Falha ao criar fatura não identificada: ${(err as Error).message}`);
    }
  }

  // ── Notificar admin via WhatsApp ───────────────────────────────────

  private async notificarAdminWhatsApp(cooperativaId: string, mensagem: string): Promise<void> {
    try {
      const adminPhone =
        (await this.getConfigFromDb('admin_phone', cooperativaId)) ||
        (await this.getConfigFromDb('suporte_telefone', cooperativaId)) ||
        process.env.ADMIN_WHATSAPP_NUMBER ||
        process.env.ADMIN_PHONE ||
        null;

      if (!adminPhone) {
        this.logger.warn(`[coop: ${cooperativaId}] Sem telefone admin configurado para notificação WhatsApp`);
        return;
      }

      await this.whatsappSender.enviarMensagem(adminPhone, mensagem, {
        tipoDisparo: 'SISTEMA',
        cooperativaId,
      });
    } catch (err) {
      this.logger.warn(`Falha ao notificar admin via WhatsApp: ${(err as Error).message}`);
    }
  }

  // ── Ativar emailFaturasAtivo + notificar cooperado na primeira fatura ──

  private async ativarEmailFaturas(
    cooperadoId: string,
    nomeCompleto: string,
    cooperativaId: string,
  ): Promise<void> {
    try {
      const cooperado = await this.prisma.cooperado.findUnique({
        where: { id: cooperadoId },
        select: { emailFaturasAtivo: true, telefone: true },
      });
      if (!cooperado) return;

      // Sempre atualizar o timestamp da última fatura recebida
      await this.prisma.cooperado.update({
        where: { id: cooperadoId },
        data: {
          emailFaturasAtivo: true,
          emailFaturasAtivoEm: new Date(),
        },
      });

      // Se é a primeira vez, notificar cooperado via WhatsApp
      if (!cooperado.emailFaturasAtivo && cooperado.telefone) {
        await this.whatsappSender.enviarMensagem(
          cooperado.telefone,
          `Boa notícia, ${nomeCompleto.split(' ')[0]}! Recebemos sua primeira fatura da EDP automaticamente. Seu sistema de monitoramento está ativo! 🎉`,
          { tipoDisparo: 'SISTEMA', cooperativaId },
        );
      }
    } catch (err) {
      this.logger.warn(`Falha ao ativar emailFaturas para cooperado ${cooperadoId}: ${(err as Error).message}`);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private async extrairEmail(msg: unknown): Promise<EmailProcessado | null> {
    const msgTyped = msg as { source?: Buffer };
    if (!msgTyped.source) return null;

    const parsed = await simpleParser(msgTyped.source);
    const remetente = parsed.from?.value?.[0]?.address || '';
    const assunto = parsed.subject || '';
    const textoCorpo = parsed.text || '';

    // Sprint Máscara (06/07/2026) — coleta TODOS os destinatários do header
    // To (parsed.to pode ser AddressObject único ou array). Alias
    // `contato+X@` normalmente aparece aqui, não no envelope.
    const destinatarios = this.extrairDestinatariosDoTo(parsed.to);

    const anexos: AnexoPdf[] = [];
    if (parsed.attachments) {
      for (const att of parsed.attachments) {
        const isPdf =
          att.contentType === 'application/pdf' ||
          att.filename?.toLowerCase().endsWith('.pdf');
        if (isPdf && att.content) {
          anexos.push({
            filename: att.filename || 'fatura.pdf',
            content: att.content,
          });
        }
      }
    }

    return { remetente, assunto, anexos, textoCorpo, destinatarios };
  }

  /**
   * Sprint Máscara (06/07/2026) — normaliza `parsed.to` do simpleParser
   * (que pode ser AddressObject único, array de AddressObject, ou
   * undefined) em uma lista plana de endereços.
   */
  private extrairDestinatariosDoTo(to: unknown): string[] {
    if (!to) return [];
    const array = Array.isArray(to) ? to : [to];
    const enderecos: string[] = [];
    for (const item of array) {
      const values = (item as { value?: Array<{ address?: string }> })?.value;
      if (!values) continue;
      for (const v of values) {
        if (v.address) enderecos.push(v.address);
      }
    }
    return enderecos;
  }

  private pareceSerFaturaConcessionaria(email: EmailProcessado): boolean {
    const termos = [
      'fatura', 'conta de energia', 'conta de luz', 'energia elétrica',
      'edp', 'cemig', 'copel', 'celpe', 'coelba', 'energisa', 'cpfl',
      'enel', 'light', 'equatorial', 'neoenergia', 'celesc',
      'demonstrativo', 'consumo', 'kwh', 'unidade consumidora',
    ];
    const textoCompleto = `${email.remetente} ${email.assunto} ${email.textoCorpo}`.toLowerCase();
    return termos.some((t) => textoCompleto.includes(t));
  }

  private async identificarCooperado(
    email: EmailProcessado,
    cooperativaId: string,
  ): Promise<{ id: string; nomeCompleto: string; cooperativaId: string | null } | null> {
    // 1. Match por e-mail do remetente, filtrado por cooperativaId
    if (email.remetente) {
      const cooperado = await this.prisma.cooperado.findFirst({
        where: { email: email.remetente, cooperativaId },
        select: { id: true, nomeCompleto: true, cooperativaId: true },
      });
      if (cooperado) return cooperado;
    }

    // 2. Match por número da UC extraído do corpo/assunto
    const ucNumeros = this.extrairNumerosUC(email.textoCorpo + ' ' + email.assunto);
    for (const numero of ucNumeros) {
      const uc = await this.prisma.uc.findFirst({
        // T5 Sprint 5: mesma correção da identificarPorOcr — campo canônico é `numero`.
        where: { numero, cooperado: { cooperativaId } },
        include: {
          cooperado: {
            select: { id: true, nomeCompleto: true, cooperativaId: true },
          },
        },
      });
      if (uc?.cooperado) return uc.cooperado;
    }

    return null;
  }

  private extrairNumerosUC(texto: string): string[] {
    const numeros: string[] = [];

    const ucRegex = /(?:UC|unidade\s*consumidora)[:\s]*(\d{6,15})/gi;
    let match: RegExpExecArray | null;
    while ((match = ucRegex.exec(texto)) !== null) {
      numeros.push(match[1]);
    }

    const instRegex = /instala[çc][ãa]o[:\s]*(\d{6,15})/gi;
    while ((match = instRegex.exec(texto)) !== null) {
      numeros.push(match[1]);
    }

    return [...new Set(numeros)];
  }

  private extrairMesReferencia(email: EmailProcessado): string {
    const texto = `${email.assunto} ${email.textoCorpo}`;

    const matchBarra = texto.match(/(\d{2})\/(\d{4})/);
    if (matchBarra) return `${matchBarra[2]}-${matchBarra[1]}`;

    const matchHifen = texto.match(/(\d{4})-(\d{2})/);
    if (matchHifen) return `${matchHifen[1]}-${matchHifen[2]}`;

    const meses: Record<string, string> = {
      janeiro: '01', fevereiro: '02', março: '03', marco: '03',
      abril: '04', maio: '05', junho: '06', julho: '07',
      agosto: '08', setembro: '09', outubro: '10',
      novembro: '11', dezembro: '12',
    };
    for (const [nome, num] of Object.entries(meses)) {
      const regex = new RegExp(`${nome}[\\s/]*(?:de\\s*)?(\\d{4})`, 'i');
      const m = texto.match(regex);
      if (m) return `${m[1]}-${num}`;
    }

    const hoje = new Date();
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    return `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, '0')}`;
  }

  private async garantirPasta(client: ImapFlow, nome: string): Promise<void> {
    try {
      await client.mailboxCreate(nome);
    } catch {
      // Pasta já existe — ignorar
    }
  }

  // ── Sprint Máscara de e-mail por convênio (06/07/2026) — RAMO CAMPANHA ─
  //
  // Detecção de fatura de funcionário de campanha empresarial (pré-cadastro)
  // via alias `<local>+<sufixo>@<domain>`. Exclusão mútua com o fluxo cooperado
  // normal — se um destinatário casar com alias configurado, o e-mail é
  // ROTEADO pro ramo campanha e NÃO segue pra `identificarCooperado`.
  // Acréscimo A do orquestrador: o local-part vem da config do monitor DO
  // TENANT (email.monitor.user), não hardcoda 'contato' — pronto pra novos
  // parceiros com caixa própria.

  private async carregarConveniosCampanhaAtivos(cooperativaId: string): Promise<
    Array<{ id: string; empresaNome: string; emailAliasCampanha: string }>
  > {
    const convenios = await this.prisma.contratoConvenio.findMany({
      where: {
        cooperativaId,
        status: 'ATIVO',
        emailAliasCampanha: { not: null },
      },
      select: { id: true, empresaNome: true, emailAliasCampanha: true },
    });
    return convenios
      .filter((c): c is typeof c & { emailAliasCampanha: string } => !!c.emailAliasCampanha)
      .map((c) => ({
        id: c.id,
        empresaNome: c.empresaNome,
        emailAliasCampanha: c.emailAliasCampanha.toLowerCase(),
      }));
  }

  /**
   * Encontra convênio cujo alias bate com algum destinatário do e-mail.
   * Retorna o primeiro match (raramente há múltiplos aliases no mesmo To).
   */
  private detectarConvenioDeCampanha(
    destinatarios: string[],
    localMailbox: string | null,
    convenios: Array<{ id: string; empresaNome: string; emailAliasCampanha: string }>,
  ): { id: string; empresaNome: string; emailAliasCampanha: string } | null {
    if (!localMailbox || convenios.length === 0) return null;
    for (const conv of convenios) {
      const r = matchAliasCampanha(destinatarios, localMailbox, conv.emailAliasCampanha);
      if (r.bateu) return conv;
    }
    return null;
  }

  /**
   * Processa TODOS os anexos PDF de um e-mail casado ao ramo campanha.
   * Cada anexo vira 1 FaturaCampanhaConvenio (dedupe semântica por UC no
   * service). Notifica admin via WA no fim. Retorna true se HOUVE erro
   * (move msg pra Pendentes em vez de Processados).
   */
  private async processarRamoCampanha(
    email: EmailProcessado,
    convenio: { id: string; empresaNome: string; emailAliasCampanha: string },
    cooperativaId: string,
    resultado: { processados: number; pendentes: number; erros: number },
  ): Promise<boolean> {
    let houveErro = false;
    let ultimoResult: {
      id: string;
      status: string;
      upserted: string;
      nomeExtraido?: string | null;
      numeroUC?: string | null;
      consumoMedioKwh?: number | null;
    } | null = null;

    for (const anexo of email.anexos) {
      try {
        const r = await this.faturasCampanhaService.processarFaturaCampanha({
          convenioId: convenio.id,
          cooperativaId,
          emailRemetente: email.remetente,
          emailAssunto: email.assunto,
          anexo: { filename: anexo.filename, content: anexo.content },
        });

        // Recarrega os campos exibíveis pra montar a notificação humana.
        const registro = await this.prisma.faturaCampanhaConvenio.findUnique({
          where: { id: r.id },
          select: { id: true, nomeExtraido: true, numeroUC: true, consumoMedioKwh: true, status: true },
        });
        if (registro) {
          ultimoResult = {
            id: r.id,
            status: r.status,
            upserted: r.upserted,
            nomeExtraido: registro.nomeExtraido,
            numeroUC: registro.numeroUC,
            consumoMedioKwh: registro.consumoMedioKwh ? Number(registro.consumoMedioKwh) : null,
          };
        }

        if (r.status === 'OCR_FALHOU') {
          resultado.pendentes++;
        } else {
          resultado.processados++;
        }

        this.logger.log(
          `[campanha] Fatura processada — convenio=${convenio.empresaNome}, alias=${convenio.emailAliasCampanha}, UC=${registro?.numeroUC ?? '?'}, status=${r.status}, upserted=${r.upserted}`,
        );
      } catch (err) {
        houveErro = true;
        resultado.erros++;
        this.logger.warn(
          `[campanha] Erro ao processar anexo ${anexo.filename} pro convenio ${convenio.empresaNome}: ${(err as Error).message}`,
        );
      }
    }

    // Notificação humana pro admin — 1 mensagem por e-mail processado.
    if (ultimoResult) {
      const nome = ultimoResult.nomeExtraido ?? '(nome não extraído)';
      const kwh = ultimoResult.consumoMedioKwh != null
        ? `${ultimoResult.consumoMedioKwh.toLocaleString('pt-BR')} kWh`
        : 'consumo não extraído';
      const statusEmoji = ultimoResult.status === 'OCR_OK' ? '📥' : '⚠️';
      await this.notificarAdminWhatsApp(
        cooperativaId,
        `${statusEmoji} Fatura de campanha [${convenio.empresaNome}]: ${nome} — ${kwh}\n\n` +
          `Status: ${ultimoResult.status}${ultimoResult.upserted === 'UPDATED' ? ' (atualização)' : ''}\n` +
          `Convênio: ${convenio.emailAliasCampanha}`,
      );
    }

    return houveErro;
  }
}
