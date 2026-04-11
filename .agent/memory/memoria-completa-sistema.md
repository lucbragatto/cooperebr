# Memória Completa do Sistema CoopereBR
**Atualizado:** 2026-04-11
**Mantenedor:** Assis (agente principal do Luciano)

---

## REGRAS CRÍTICAS DE NEGÓCIO — NUNCA ESQUECER

1. **O cooperado NÃO gera energia.** Apenas a cooperativa gera (usinas arrendadas).
2. **Toda geração é da cooperativa.** Distribui créditos kWh proporcionalmente.
3. **CooperToken NÃO é creditado por excedente do cooperado.** Cooperado é consumidor.
4. **Uso dos tokens é SEMPRE manual** — cooperado decide quando usar. NUNCA desconto automático.
5. **Desconto variável** — pode passar de 20%. NUNCA dizer "15% fixo".
6. **Distribuidora:** EDP Espírito Santo APENAS. Não atende outras distribuidoras.

---

## INFRAESTRUTURA DO SISTEMA

- **Backend:** NestJS + Prisma + PostgreSQL (Supabase SP) — porta 3000
- **Frontend:** Next.js + Tailwind + Shadcn — porta 3001
- **WhatsApp Service:** Baileys — porta 3002
- **Agente P:** OpenClaw instalado em C:\Users\Luciano\cooperebr\node_modules\openclaw
- **Agente Assis (principal):** OpenClaw global, porta 18789
- **Agente P (independente):** porta 18790 (script: cooperebr/start-agent-p.ps1)

---

## HISTÓRICO DE DESENVOLVIMENTO (resumo)

### Março 2026
- Sistema base: cooperados, UCs, usinas, contratos, cobranças, MLM indicações
- Motor de proposta, wizard de cadastro, portal do cooperado
- WhatsApp bot com fluxo completo de onboarding
- OCR de faturas, simulação de economia
- PDF de propostas (Puppeteer)
- Módulo financeiro: cobranças, pagamentos, penhora (SISBAJUD)

### Abril 2026 (semana 1-2)
- **CooperToken completo:**
  - Camada 1: lançamentos contábeis automáticos (EventEmitter)
  - Camada 2: ledger, débito/crédito, extrato
  - Camada 3: dashboard financeiro (passivo, receita parceiro, fluxo de caixa)
  - Camada 4A: CoopereAI primeiro contato (Claude API direta)
  - Taxa emissão: 2% (UI e backend alinhados)
  - Uso SEMPRE manual (Opção C) — cooperado escolhe quando usar
- **Clube de Vantagens:** catálogo ofertas, resgate via token, modal confirmação
- **CoopereAI:** primeiro contato WA antes do bot, salva interações em data/interacoes-coopereai/
- **Bugs corrigidos:** darBaixa race condition, kwhContrato=0, modoTeste=false, race condition resgate, ledger FATURA_CHEIA, cotaKwhMensal null, conflito crons 6h

---

## QUALIDADE ATUAL DO SISTEMA (QA 11/04/2026)

**Score:** 7.8/10 (histórico: 8.5 em 08/04, 8.0 em 09/04)

**Bugs P2 abertos:**
- BUG-005: Race condition resgate ofertas Clube (SENDO CORRIGIDO)
- BUG-006: FATURA_CHEIA gravado como BONUS_INDICACAO no ledger (SENDO CORRIGIDO)
- BUG-007: Conflito crons 6h (SENDO CORRIGIDO)
- BUG-008: cotaKwhMensal=null gera tokens indevidos (SENDO CORRIGIDO)
- SEC-CT-002: Secret WA hardcoded no index.mjs
- BUG-WA-AUDIO: audioMessage/videoMessage sem handler
- BUG-NEW-002: Webhook Asaas sem HMAC validation

---

## FLUXO WHATSAPP — COOPEREAI PRIMEIRO CONTATO

```
Usuário manda mensagem
        ↓
Número desconhecido? → SIM → CoopereAI responde
        ↓                    (educa, explica, captura lead)
        ↓                    Ao final: "Para mais opções, digite menu"
        ↓
Digitou "menu"? → SIM → Bot assume normalmente
        ↓
Estado ativo no bot? → SIM → Bot processa
        ↓
CoopereAI responde (conversa educativa)
```

**Call-to-action contextual ao final de TODA resposta:**
- Perguntou sobre desconto/economia → "Quer simular? Digite **simulação**"
- Perguntou sobre fatura/status → "Digite **fatura**"
- Perguntou sobre cadastro → "Digite **cadastro**"
- Genérico → "Para todas as opções, digite **menu**"
- Quer atendente → "Digite **atendimento**"

---

## MÓDULOS PRINCIPAIS

### CoopereAI (backend/src/whatsapp/coopere-ai.service.ts)
- Modelo: claude-haiku-4-5 (configurável via COOPEREAI_MODEL)
- Max tokens: 512 (configurável via COOPEREAI_MAX_TOKENS)
- Persiste histórico por telefone (últimas 10 msgs)
- Salva em: backend/data/interacoes-coopereai/

### WhatsApp Bot (backend/src/whatsapp/whatsapp-bot.service.ts)
- Estado PRIMEIRO_ATENDIMENTO_AI → CoopereAI
- Estado INICIAL + número desconhecido → iniciarPrimeiroAtendimentoAI()
- "menu" explícito → bot assume
- Fallback inteligente com CoopereAI para mensagens não reconhecidas

### CooperToken (backend/src/cooper-token/)
- Ledger de tokens por cooperado
- Tipos: FATURA_CHEIA, BONUS_INDICACAO, COMPRA, PARCEIRO, VENCIMENTO
- Taxa emissão: 2% (TAXA_EMISSAO), taxa QR: 1% (TAXA_QR)
- Uso SEMPRE manual — cooperado escolhe

### Motor de Proposta (backend/src/motor-proposta/)
- Calcula proposta baseado em consumo médio kWh
- Gera PDF com Puppeteer
- Validação: kwhContrato > 0 obrigatório

### Clube de Vantagens (backend/src/clube-vantagens/)
- Catálogo de ofertas dos parceiros
- Resgate via CooperToken com transação atômica (race condition corrigida)
- Modal de confirmação antes do resgate

---

## PENDÊNCIAS ABERTAS (sprint backlog)

1. Auto-cadastro público /cadastro (wizard multi-step, steps 1-4)
2. Compra de tokens via Asaas (PIX/boleto)
3. Dashboard financeiro tokens (Camada 3 — a testar)
4. Módulo financeiro: integração BB + Sicoob
5. Google MCP OAuth (aguarda redirect URIs no Cloud Console)
6. Fio B: calcular impacto por usina (confirmar potência das 3 usinas)
7. PM2: configurar auto-start CoopereBR

---

## INFORMAÇÕES DE CONTATO E ACESSO

- WhatsApp CoopereBR: (27) 4042-1630 / +55 27 3191-4391
- Site: www.cooperebr.com.br
- Backend local: http://localhost:3000
- Frontend local: http://localhost:3001

---

## SOBRE O P (AGENTE DO COOPEREBR)

- P é o agente OpenClaw instalado no VSCode do CoopereBR
- Responsável pelo WA CoopereBR, monitoramento do sistema, QA noturno
- Gateway na porta 18790 (independente do Assis na 18789)
- Config: C:\Users\Luciano\cooperebr\.openclaw\openclaw.json
- Para iniciar independente: executar start-agent-p.ps1

### Rotina do P:
1. QA noturno às 03h → analisa bugs → envia relatório para Assis → Assis consolida → reporta para Luciano
2. Monitor WA a cada 15min → alerta imediato se cair
3. Responder WA CoopereBR como CoopereAI (primeiro contato) + acionar bot quando "menu"
4. Skill de referência: C:\Users\Luciano\.openclaw\workspace\skills\cooperebr-qa\SKILL.md

### Fluxo de relatório:
P analisa → envia para Assis → Assis analisa → reporta para Luciano (Telegram + WA pessoal)
O P NÃO reporta diretamente para Luciano. Sempre via Assis.
