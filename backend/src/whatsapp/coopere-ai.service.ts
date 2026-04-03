import { Injectable, Logger } from '@nestjs/common';

const OPENCLAW_URL =
  process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || 'coop';
const OPENCLAW_TIMEOUT_MS = Number(process.env.OPENCLAW_TIMEOUT_MS) || 15000;

export interface CoopereAiResponse {
  ok: boolean;
  resposta: string | null;
}

@Injectable()
export class CoopereAiService {
  private readonly logger = new Logger(CoopereAiService.name);

  /**
   * Envia a mensagem do cooperado para o agente CoopereAI (OpenClaw Gateway)
   * e retorna a resposta textual. Retorna null em caso de falha ou timeout.
   */
  async perguntar(
    mensagem: string,
    contexto?: { telefone?: string; nomeCooperado?: string },
  ): Promise<CoopereAiResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OPENCLAW_TIMEOUT_MS);

    try {
      const prompt = contexto?.nomeCooperado
        ? `[Cooperado: ${contexto.nomeCooperado}, Tel: ${contexto.telefone}] ${mensagem}`
        : mensagem;

      const res = await fetch(`${OPENCLAW_URL}/api/agent/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: OPENCLAW_AGENT_ID,
          message: prompt,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        this.logger.warn(
          `OpenClaw respondeu ${res.status}: ${res.statusText}`,
        );
        return { ok: false, resposta: null };
      }

      const data = (await res.json()) as Record<string, unknown>;

      // O gateway pode retornar { response: "..." } ou { message: "..." }
      const resposta =
        (data.response as string) ??
        (data.message as string) ??
        (data.text as string) ??
        null;

      if (!resposta || resposta.trim().length === 0) {
        this.logger.warn('OpenClaw retornou resposta vazia');
        return { ok: false, resposta: null };
      }

      this.logger.log(
        `CoopereAI respondeu (${resposta.length} chars) para ${contexto?.telefone ?? 'anon'}`,
      );
      return { ok: true, resposta: resposta.trim() };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('abort')) {
        this.logger.warn(
          `CoopereAI timeout (${OPENCLAW_TIMEOUT_MS}ms) para ${contexto?.telefone ?? 'anon'}`,
        );
      } else {
        this.logger.warn(`CoopereAI indisponível: ${message}`);
      }
      return { ok: false, resposta: null };
    } finally {
      clearTimeout(timer);
    }
  }
}
