import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.COOPEREAI_MODEL || 'claude-haiku-4-5-20251001';
const ANTHROPIC_MAX_TOKENS = Number(process.env.COOPEREAI_MAX_TOKENS) || 512;

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data', 'interacoes-coopereai');
const HISTORICO_FILE = path.join(DATA_DIR, 'historico-consolidado.jsonl');

const SYSTEM_PROMPT = `Você é o P (ou CoopereAI), assistente virtual da CoopereBR — Cooperativa de Energia Renovável Brasil.

Seu papel é ser o PRIMEIRO contato com qualquer pessoa que entra em contato pelo WhatsApp. Você humaniza a conversa, educa sobre energia solar por assinatura e captura leads.

## Personalidade
- Acolhedor, simpático, usa linguagem simples
- Usa emojis com moderação (1-2 por mensagem)
- Respostas curtas e diretas (máximo 3-4 parágrafos)
- Nunca inventa dados — se não sabe, encaminha para atendente

## Sobre a CoopereBR

A CoopereBR é uma cooperativa de energia solar que permite economizar na conta de luz sem instalar nada em casa. Atuamos no modelo de Geração Distribuída (GD), regulamentado pela Lei 14.300/2022 (Marco Legal da Geração Distribuída) e pela RN ANEEL 1059/2023, que substituíram a antiga Resolução Normativa nº 482/2012.

**Como funciona:**
1. A CoopereBR arrenda usinas solares que produzem energia
2. Essa energia é injetada na rede da EDP Espírito Santo
3. A EDP transforma em créditos de energia (kWh) na conta do cooperado
4. Resultado: desconto na fatura todo mês

**IMPORTANTE:** O cooperado NÃO gera energia — ele apenas consome os créditos que a cooperativa distribui a partir das usinas arrendadas.

**Dados:**
- 3 usinas solares arrendadas (2 em Linhares-ES, 1 em Ibiraçu-ES)
- Distribuidora: EDP Espírito Santo
- Capacidade total: ~145.000 kWh/mês
- ~310 cooperados ativos
- Créditos válidos por até 60 meses

**Vantagens:**
- Desconto variável na conta de luz — pode passar de 20% (NUNCA diga 15% fixo)
- R$ 0 de investimento inicial
- Sem fidelidade
- Sem obras ou alterações na residência
- 100% digital
- Energia limpa e sustentável

## Diferença: cooperativa vs instalar placa solar
- **Placa solar própria:** investimento alto (R$ 15-50 mil), manutenção por conta do dono, retorno em 5-7 anos
- **Cooperativa (CoopereBR):** zero investimento, sem manutenção, desconto imediato após ativação, sem fidelidade. Você não instala nada — apenas recebe os créditos na sua conta de luz.

## Processo de adesão — 4 passos
1. **Simulação** — pelo site ou WhatsApp (enviar foto da conta de luz)
2. **Cadastro** — CPF + número da instalação/UC
3. **Análise** — elegibilidade verificada pela CoopereBR
4. **Aprovação** — cooperado avisado quando desconto começa a aparecer na conta

## Requisitos para participar
- Ser titular da conta de energia
- Estar na área de atendimento da EDP Espírito Santo
- Não ter Tarifa Social ou benefícios tarifários conflitantes
- CPF e dados da conta de luz

## CooperToken (Clube de Vantagens)
- Sistema de tokens digitais: 1 TOKEN = 1 crédito de energia
- Tokens podem abater na fatura de energia ou ser usados com parceiros
- Parceiros: ASSEJUFES, OAB-ES, AESMP, UAINE, RACSEL, ODONTOSCAN, CDSSOLAR, ECOSUN, MYTHOS

## Geração Distribuída (GD)
- Sistema regulamentado pela Lei 14.300/2022 (Marco Legal GD) e RN ANEEL 1059/2023, onde energia é gerada em usinas remotas e compensada via rede da concessionária
- Cooperado continua cliente da EDP — a única diferença é que paga menos

## Calculadora CO2
- 100 kWh/mês = 354 kg CO2/ano neutralizados

## Arrendamento de usina (para donos de usina solar)
- Proprietários de usinas podem alugar créditos excedentes para a CoopereBR
- Recebem aluguel fixo mensal + continuam com sua própria energia
- Usinas aceitas: de 110 kWp até 5+ MWp
- Contato: WhatsApp (27) 4042-1630

## Contato
- WhatsApp: (27) 4042-1630
- Site: www.cooperebr.com.br

## Regras IMPORTANTES
1. NUNCA afirme desconto fixo de 15% — diga "desconto variável, pode passar de 20%"
2. Se não souber responder após 2 tentativas, diga: "Vou chamar um colaborador para te ajudar!"
3. Sempre capture nome e email quando fizer sentido no contexto
4. Respostas em português brasileiro, linguagem simples e acolhedora
5. Ao final de TODA resposta, inclua um call-to-action contextual:
   - Se falou de economia/desconto/tarifa → "Quer simular sua economia? Digite *simulação* ou envie a foto da sua conta de luz."
   - Se falou de cadastro/adesão → "Para iniciar seu cadastro, digite *cadastro* ou envie a foto da sua conta de luz."
   - Se falou de fatura/conta → "Para acessar sua fatura, digite *fatura*."
   - Genérico → "Para todas as opções, digite *menu*."
6. NUNCA invente dados, valores ou percentuais que não estejam neste prompt`;

interface InteracaoMsg {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface InteracaoArquivo {
  telefone: string;
  data: string;
  mensagens: InteracaoMsg[];
  temas_abordados: string[];
}

export interface CoopereAiResponse {
  ok: boolean;
  resposta: string | null;
}

@Injectable()
export class CoopereAiService {
  private readonly logger = new Logger(CoopereAiService.name);
  private readonly client: Anthropic | null;
  private readonly historicos = new Map<string, InteracaoMsg[]>();

  constructor() {
    if (ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
      this.logger.log('CoopereAI inicializado com Claude API direta');
    } else {
      this.client = null;
      this.logger.warn('ANTHROPIC_API_KEY não configurada — CoopereAI desabilitado');
    }

    // Garantir que o diretório de dados existe
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {
      // Ignorar se já existe
    }
  }

  /**
   * Envia a mensagem do usuário para o Claude e retorna a resposta.
   * Mantém histórico em memória por telefone para contexto da conversa.
   */
  async perguntar(
    mensagem: string,
    contexto?: { telefone?: string; nomeCooperado?: string },
  ): Promise<CoopereAiResponse> {
    if (!this.client) {
      this.logger.warn('Claude API não disponível — sem API key');
      return { ok: false, resposta: null };
    }

    const telefone = contexto?.telefone ?? 'anonimo';
    const historico = this.historicos.get(telefone) ?? [];

    // Adicionar mensagem do usuário ao histórico
    const userMsg: InteracaoMsg = {
      role: 'user',
      content: mensagem,
      timestamp: new Date().toISOString(),
    };
    historico.push(userMsg);

    try {
      // Montar mensagens para a API (últimas 10 mensagens para contexto)
      const mensagensApi = historico.slice(-10).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const response = await this.client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: mensagensApi,
      });

      const resposta =
        response.content[0]?.type === 'text'
          ? response.content[0].text.trim()
          : null;

      if (!resposta) {
        this.logger.warn('Claude retornou resposta vazia');
        return { ok: false, resposta: null };
      }

      // Adicionar resposta ao histórico
      const assistantMsg: InteracaoMsg = {
        role: 'assistant',
        content: resposta,
        timestamp: new Date().toISOString(),
      };
      historico.push(assistantMsg);
      this.historicos.set(telefone, historico);

      // Salvar interação em arquivo (async, não bloqueia)
      this.salvarInteracao(telefone, historico, resposta).catch((err) =>
        this.logger.warn(`Falha ao salvar interação: ${err.message}`),
      );

      this.logger.log(
        `CoopereAI respondeu (${resposta.length} chars) para ${telefone}`,
      );
      return { ok: true, resposta };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`CoopereAI erro Claude API: ${message}`);
      return { ok: false, resposta: null };
    }
  }

  /**
   * Limpa o histórico de conversa para um telefone (ex: ao resetar conversa).
   */
  limparHistorico(telefone: string): void {
    this.historicos.delete(telefone);
  }

  /**
   * Salva a interação em arquivo JSON individual e no histórico consolidado.
   */
  private async salvarInteracao(
    telefone: string,
    historico: InteracaoMsg[],
    ultimaResposta: string,
  ): Promise<void> {
    const hoje = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const telLimpo = telefone.replace(/\D/g, '');
    const arquivo = path.join(DATA_DIR, `${hoje}-${telLimpo}.json`);

    // Detectar temas abordados
    const temas = this.detectarTemas(
      historico.map((m) => m.content).join(' '),
    );

    const interacao: InteracaoArquivo = {
      telefone,
      data: hoje,
      mensagens: historico,
      temas_abordados: temas,
    };

    // Salvar arquivo individual (sobrescreve com histórico completo do dia)
    fs.writeFileSync(arquivo, JSON.stringify(interacao, null, 2), 'utf-8');

    // Append no histórico consolidado (JSONL)
    const linha = JSON.stringify({
      telefone,
      timestamp: new Date().toISOString(),
      user_msg: historico[historico.length - 2]?.content ?? '',
      ai_msg: ultimaResposta,
      temas,
    });
    fs.appendFileSync(HISTORICO_FILE, linha + '\n', 'utf-8');
  }

  /**
   * Detecta temas abordados na conversa com base em palavras-chave.
   */
  private detectarTemas(texto: string): string[] {
    const lower = texto.toLowerCase();
    const temas: string[] = [];

    const mapa: Record<string, string[]> = {
      'energia_solar': ['energia solar', 'usina', 'fotovoltaic'],
      'desconto': ['desconto', 'economia', 'economizar', 'conta de luz'],
      'cadastro': ['cadastro', 'cadastrar', 'aderir', 'adesão'],
      'cooperativa': ['cooperativa', 'cooperebr', 'coopere'],
      'geracao_distribuida': ['geração distribuída', 'crédito de energia', 'compensação'],
      'coopertoken': ['token', 'coopertoken', 'clube de vantagens'],
      'sustentabilidade': ['sustentab', 'co2', 'carbono', 'verde', 'limpa'],
      'arrendamento': ['arrendamento', 'alugar usina', 'aluguel'],
      'placa_solar': ['placa solar', 'instalar placa', 'painel solar'],
      'tarifa': ['tarifa', 'tusd', 'fio b'],
      'simulacao': ['simulação', 'simular', 'quanto vou economizar'],
      'atendimento': ['atendente', 'humano', 'colaborador'],
    };

    for (const [tema, palavras] of Object.entries(mapa)) {
      if (palavras.some((p) => lower.includes(p))) {
        temas.push(tema);
      }
    }

    return temas;
  }
}
