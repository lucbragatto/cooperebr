# Recomendação Concreta de Arquitetura: OpenClaw + Hermes + Obsidian + ECC/Claw para CoopereBR

**Data da análise:** 2026-06-07 (após buscas locais e background tasks)
**Contexto:** Seu projeto já tem OpenClaw profundamente integrado (package.json, .agent/ com SOUL/IDENTITY/HEARTBEAT/memory para agente "coop", gateways WA + Telegram). Tem sistema avançado de FluxoEtapa + ModeloMensagem com API REST em /fluxo-etapas. Setup ECC/.claude completo com plugins Telegram/Discord e wa-bot-agent.md. Buscas não localizaram vault Obsidian óbvio em paths padrão (Documents/Obsidian etc.) — pode estar em outro local ou via OneDrive/sync. Claw mencionado mas sem sessions dir ativo em alguns checks.

## 1. Resposta Direta à Sua Pergunta: Ativar Todos via WhatsApp e Telegram?

**Sim, é possível ativar o conjunto de forma unificada, mas com papéis diferentes:**

- **OpenClaw e Hermes (gateways de canais):** Sim, nativamente e como você já tem com OpenClaw.
  - Ambos suportam multi-channel gateway (um processo/agent atende WA + Telegram + outros simultaneamente, com memória compartilhada).
  - OpenClaw: Você já configurou para CoopereBR (porta 18800, WA allowlist seu número, Telegram dmPolicy). O agente "coop" já responde no WA/Telegram, monitora o projeto, usa memória .agent/.
  - Hermes: Pode rodar em paralelo ou como principal/alternativa. Tem gateway excelente para WA, Telegram (suporte a voz, arquivos, groups), e 20+ plataformas. Um único "hermes gateway" conecta tudo. Memória e skills compartilhadas.
  - Como ativar: Rode o gateway (openclaw gateway ou hermes gateway). Configure credenciais WA (WhatsApp Web session) e Telegram bot. Use allowlists/pairing para segurança. O mesmo agente conversa nos dois canais.

- **ECC + Claw (skills + REPL interativo):** Parcialmente/sim via integração.
  - Claw: É REPL (node scripts/claw.js ou similar) — **não é gateway de mensagens**. Rode localmente ou em tmux para sessões de desenvolvimento (branching com /branch, hot-load skills com /load, compaction com /compact, export para Obsidian).
  - ECC: Fornece o ecossistema de skills (você já tem wa-bot-agent.md, whatsapp-guardian.md, e plugins para Telegram access/configure). Carregue skills ECC **dentro** do gateway (OpenClaw ou Hermes). Use os plugins de canal do ECC para Telegram (já presentes em .claude/plugins). Para WA, o gateway do OpenClaw/Hermes é o front.
  - Ativação via canais: O agente no WA/Telegram (OpenClaw/Hermes) carrega skills ECC. Para "ativar Claw via canais", use o REPL local e instrua o agente no chat a carregar/exportar o que você desenvolveu.

- **Obsidian (PKM / LLM Wiki / memória durável):** Não diretamente como chatbot, mas **sim via skills dos agentes**.
  - Obsidian é o vault local (markdown + links + Canvas + graph). Não roda como gateway WA/Telegram.
  - Como "ativar" via canais: O agente (OpenClaw/Hermes com skills ECC) usa ferramentas/skills para:
    - Ler o vault como contexto (buscar templates de fluxos, memória de lições).
    - Escrever/sincronizar (distilar conversas reais do WA para raw/, atualizar wiki/ com novos FluxoEtapa, gerar Canvas visual de fluxos que interagem).
  - Buscas não acharam o vault facilmente — verifique paths como Documents/Obsidian, ou use Obsidian sync/OneDrive. Crie um vault "CoopereBR-Knowledge" se não tiver. Instale plugins: Dataview, Canvas, Copilot/Smart Connections para RAG local, Git.
  - Benefício: Transparente para você (humano) e contratante. Agente + humano co-editam o conhecimento de fluxos.

**Como tudo junto via WA + Telegram (experiência unificada para cooperados e para configurar):**
- Rode **OpenClaw (ou Hermes)** como gateway principal — este é o "chatbot" que os usuários veem no WA e Telegram.
- Dentro do agente do gateway:
  - Carregue skills ECC (wa-bot-agent.md como base + a skill "cooperebr-flows" que criamos).
  - Skills para Obsidian (read/write vault para contexto e sync).
  - O agente responde usuários normais, e também aceita comandos de configuração ("liste fluxos", "crie etapa para novas questões com gatilho X", "sincronize com Obsidian").
- Use **Claw** localmente para prototipar (sessões branch para testar novas rotinas de fluxo, depois exporte a skill para o gateway).
- Resultado: Cooperado fala no WA/Telegram. Você (configurador) também usa os mesmos canais para gerenciar FluxoEtapa via agente (chama sua API /fluxo-etapas). Tudo documentado/sincronizado em Obsidian para visibilidade e "LLM Wiki".

Isso é exatamente o padrão híbrido recomendado em guias ECC (distilar de Hermes/OpenClaw para skills ECC + Obsidian como camada durável).

## 2. Integração com Seu Sistema de Fluxos Atual (FluxoEtapa + ModeloMensagem)

Seu sistema é sólido:
- API REST em /fluxo-etapas (GET/POST/PUT/DELETE/preview) com tenant scoping (GLOBAL ou por cooperativaId).
- Motor dinâmico em whatsapp-fluxo-motor.service.ts (processarComFluxoDinamico com gatilhos, acoes, comandos universais).
- Híbrido com fallback no whatsapp-bot.service.ts.
- UI admin em /dashboard/whatsapp-config com Banco de Mensagens, lista de etapas, ModalEtapa, SimuladorCelular (PhoneFrame com bolhas, atalhos de gatilhos, painel de estado).

**Melhorias com a stack para "fácil configuração e criação de rotinas novas":**
- **Criação de novas rotinas (ex: fluxo inicial + cobranças + novas questões que interagem):**
  - Agente no WA/Telegram: "Crie um fluxo modular para novas questões, com 4 etapas, gatilho 'suporte' ou 'problema', usa modelo de atendimento, acaoAutomatica para criar ticket."
  - Skill (cooperebr-flows) valida, sugere estrutura, chama sua API para criar FluxoEtapa(s), atualiza ModeloMensagem se necessário, sincroniza para Obsidian (nota + Canvas mostrando as transições entre fluxos).
  - Usa comandos universais do seu motor para navegação entre "sub-fluxos".
- **Configuração atrativa:**
  - Em vez de só UI técnica (lista + modal com "estado", "gatilhos"), use chat natural no canal que você já usa.
  - Obsidian: Visual (Canvas para o grafo de fluxos que interagem), queries (Dataview: "todas etapas do fluxo cobranças"), histórico de versões (Git).
  - Simulador existente + agente: "Simule o fluxo X com mensagem 'quero reclamar'".
- **O que implica:**
  - Mais autonomia para configurador/contratante (menos dependência de dev para tweaks).
  - Menos risco de fluxos longos/monolíticos: Etapas pequenas + sync para documentação visual.
  - Memória: Agente distila conversas reais (do whatsapp-service) para raw/ no Obsidian, extrai padrões para wiki/fluxos/.
  - Tenant: Mantido (agente passa cooperativaId).
  - Segurança: Use ECC rules + guardian agent.

**Limitações atuais a mitigar:**
- Híbrido legado + dinâmico: Priorize migrar mais para o motor (o agente pode ajudar identificando partes hardcoded).
- Ações (acaoAutomatica): Expanda via skills ECC (ex: "CHAMAR_IAG" para novas questões).
- UI admin: Mantenha para power users; use agente para "no-code" via chat.

## 3. Passos Concretos para Ativar (Baseado no que Já Existe)

1. **OpenClaw/Hermes (canais):**
   - OpenClaw: Já rodando. Adicione a skill cooperebr-flows (carregue via config/SOUL ou /load no Claw e exporte).
   - Hermes: Rode hermes gateway setup, configure WA + Telegram (use as mesmas credenciais/sessions). Adicione skills (incluindo ECC e Obsidian integration). Rode como serviço.
   - Unificado: Um agente no gateway atende os dois canais.

2. **ECC + Claw (skills + dev):**
   - Carregue skills no gateway (wa-bot-agent, nova cooperebr-flows, telegram plugins se usar ECC para canais).
   - Para dev: Rode Claw (ver .claude/commands/claw.md). Ex: 
ode scripts/claw.js, /load cooperebr-flows, crie branch para nova rotina, teste prompts, /export para Obsidian.
   - Use plugins ECC para Telegram se quiser canal direto via ECC.

3. **Obsidian (PKM):**
   - Localize ou crie o vault (buscas não acharam facilmente — verifique OneDrive/Documents ou rode busca manual por .obsidian).
   - Estrutura sugerida (como no doc criado):
     - raw/ (ingest de conversas, memory dumps).
     - wiki/ (síntese de fluxos, entidades).
     - cooperebr/flows/ (espelho de FluxoEtapa + Canvas visual).
     - agents/ (docs de wa-bot etc.).
   - Skills para agente: Ler/escrever notas, buscar por "fluxo X", gerar resumos de etapas.
   - Sync: A skill cooperebr-flows faz to-obsidian (exporta API para notas) e from-obsidian (lê e propõe via API).

4. **Integração com FluxoEtapa:**
   - A skill usa sua API (/fluxo-etapas) — já existe, com auth por roles.
   - Exemplo: Agente cria etapa para "novas questões", define gatilhos que interagem com fluxo de cobranças via comando universal "MENU".
   - Preview: Chama seu /preview ou /simular.
   - Sync: Mantém Obsidian atualizado com o que está no banco.

5. **Testes e Segurança:**
   - Sempre use simulate/preview antes de mutar.
   - Tenant: Agente sempre passa cooperativaId.
   - Use whatsapp-guardian para auditoria.
   - ECC security patterns.

## 4. Benefícios para Configurador e Contratante

- **Configurador (você/time):** Chat no WA/Telegram para gerenciar fluxos (muito mais rápido que UI para iterações). Visual no Obsidian (Canvas mostra como fluxos interagem). Claw para dev seguro com branching. Menos "fluxo longo" — etapas modulares + documentação viva.
- **Contratante (cooperativa):** Personalização self-service via chat com agente. Conhecimento transparente no Obsidian (auditoria fácil, sem depender só de dev). Multi-tenant nativo. Criação de rotinas novas (ex: fluxo específico para um parceiro) sem código/deploy.
- **Atrativo geral:** Combina execução em canais reais + memória durável/editável + estrutura de skills + seu motor dinâmico. Evolui de "config via UI técnica" para "agente ajuda a criar e documentar fluxos em tempo real".

**Entregáveis já criados nesta sessão (via tools):**
- docs/arquitetura-agentes-pkm-cooperebr.md (recomendação completa).
- .claude/skills/cooperebr-flows/SKILL.md (skill para gerenciar fluxos + sync Obsidian; com exemplos e regras).
- Atualização em wa-bot-agent.md com referências à stack.

**Próximos imediatos:**
- Localize o Obsidian vault e rode o sync da skill.
- Carregue a skill no seu OpenClaw "coop" (via config ou Claw).
- Teste no WA/Telegram: "Liste fluxos ativos" ou "Crie fluxo para novas questões".
- Se quiser Hermes: Instale e configure gateway com mesmas skills.
- Para Claw: Rode e teste /load cooperebr-flows.

Isso permite ativar o poder de todos os três (OpenClaw/Hermes para canais, Obsidian para PKM, ECC/Claw para skills/dev) de forma integrada ao seu sistema de fluxos, mantendo o que já funciona (API, motor, OpenClaw existente).

Se precisar de mais código (ex: script de setup inicial do vault, extensão da skill, ou rodar comandos específicos agora), é só pedir — continuo com tools.
