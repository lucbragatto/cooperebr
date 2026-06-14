# Arquitetura de Agentes Multi-Canal + PKM para CoopereBR

**Data:** 2026-06-07
**Objetivo:** Integrar OpenClaw, Hermes, Obsidian e ECC/Claw para:
- Ativação via WhatsApp e Telegram (como gateways principais).
- Facilitar configuração e criação de novas rotinas/fluxos (usando FluxoEtapa + ModeloMensagem existentes).
- Memória de longo prazo transparente (LLM Wiki style).
- Desenvolvimento interativo (Claw) + execução autônoma + skills estruturadas (ECC).
- Atrativo para usuário que configura (admin) e contratante (cooperativa).

## 1. Visão Geral da Stack Recomendada (Híbrida Vencedora)

**Camada de Canais (Front-end para usuários):**
- **OpenClaw ou Hermes** como gateway principal.
  - Suporte nativo multi-channel: WhatsApp + Telegram (e Discord/Slack se quiser).
  - Um único agente ("Coop" ou "Assis") responde nos dois canais com memória compartilhada.
  - Você já tem OpenClaw instalado e configurado no projeto (veja .agent/ e package.json).
  - Hermes é alternativa forte se quiser mais auto-melhoria de skills.

**Camada de Execução e Skills (Cérebro operacional):**
- **ECC + Claw**:
  - ECC fornece o harness: skills reutilizáveis, hooks, regras de segurança, padrões (incluindo para flows como wa-bot-agent.md).
  - Claw (NanoClaw) para sessões interativas de desenvolvimento: branching, compaction, hot-load de skills, REPL persistente.
  - Carregue skills do ECC no gateway (OpenClaw/Hermes).

**Camada de Memória de Longo Prazo e Conhecimento (Fonte da Verdade):**
- **Obsidian** como vault principal (LLM Wiki).
  - Agentes (via skills) leem/escrevem no vault.
  - Humano edita diretamente no app Obsidian (gráficos, Canvas para fluxos, daily notes).
  - Use para: documentação de FluxoEtapa, templates de ModeloMensagem, lições aprendidas, raw data -> síntese wiki, entity pages para cooperados/fluxos.
  - Git-friendly para versionamento.

**Camada de Domínio (seu sistema atual):**
- Backend NestJS com:
  - luxo-etapas module (CRUD para etapas dinâmicas: estado, gatilhos, modeloMensagem, acaoAutomatica, tenant scoping).
  - whatsapp-fluxo-motor.service.ts (processarComFluxoDinamico).
  - whatsapp-bot.service.ts (híbrido: tenta motor dinâmico, fallback hardcoded).
  - modelo-mensagem.service.ts.
  - whatsapp-service/ (Baileys standalone para conexão real).
- Agentes interagem via API REST do backend (ex: /fluxo-etapas, /whatsapp/simular, webhooks).

## 2. Como Ativar Todos via WhatsApp e Telegram

**Sim, é possível e já parcialmente implementado.**

- **OpenClaw**: Já ativo no seu setup.
  - Gateway em portas diferentes (18789 principal, 18800 para CoopereBR).
  - WhatsApp: allowlist seu número (+5527981341348), selfChatMode.
  - Telegram: dmPolicy open ou pairing, allowFrom.
  - O agente "coop" já monitora o projeto, responde no WA/Telegram, usa memória em .agent/ e ~/.openclaw-cooperebr/.
  - Comandos: openclaw gateway, etc.

- **Hermes**: Pode ativar paralelamente ou como substituto.
  - Instale Hermes (hermes gateway setup).
  - Configure o mesmo Messaging Gateway para WhatsApp + Telegram.
  - Compartilhe memória com OpenClaw via Obsidian (agente Hermes escreve no vault, OpenClaw lê).
  - Use para mais autonomia (Hermes tem loop de auto-melhoria de skills).

- **ECC/Claw**:
  - **Não é gateway de mensagens nativo** (Claw é REPL local: node scripts/claw.js ou npm run claw).
  - **Ative via canais**:
    - Use os plugins/skills de ECC para Telegram (já existem em .claude/plugins/marketplaces/.../telegram/skills/access e configure).
    - Para WhatsApp, use OpenClaw/Hermes como front e carregue skills ECC no agente (via SOUL.md ou equivalente).
    - No OpenClaw/Hermes, configure para carregar skills do ECC (ex: wa-bot-agent, whatsapp-guardian, e novos skills para flows).
  - Use **Claw** para desenvolvimento interativo: crie/teste novas rotinas de fluxo em sessões branch ( /branch ), compacte contexto ( /compact ), hot-load skills ( /load ).
  - Exporte sessões para Obsidian.

- **Obsidian**:
  - Não é "ativado" como chatbot. O humano usa o app Obsidian localmente.
  - Agentes (OpenClaw, Hermes, ou ECC-powered) interagem via **skills/plugins**:
    - Crie skills para: ler/escrever notas de fluxos, buscar em vault por "fluxo cobranças", sintetizar lições de conversas reais para wiki/, atualizar ModeloMensagem/FluxoEtapa via API e documentar no vault.
  - Estrutura sugerida no vault:
    - raw/ (logs de conversas, raw data de fluxos)
    - wiki/ (síntese: fluxos documentados, entity pages para "Fluxo Cobrança", "Etapa Aguardando Fatura")
    - cooperebr/flows/ (espelho dos FluxoEtapa + templates)
    - memory/ (conhecimento-cooperebr.md etc. sincronizado)
    - agents/ (cópias de wa-bot-agent.md, decisões)

**Como unificar (um agente "principal" no WA/Telegram):**
- Use **OpenClaw ou Hermes** como o gateway que os cooperados falam.
- Dentro dele, carregue:
  - Skills do ECC (incluindo wa-bot-agent.md como base, novos para flows).
  - Skills de integração com Obsidian (read/write vault).
  - Skills para chamar API do seu backend (gerenciar FluxoEtapa dinamicamente, simular fluxos).
- Resultado: Usuário manda mensagem no WA/Telegram -> Agente usa ECC skills + consulta Obsidian para contexto + atualiza FluxoEtapa via API se necessário + responde.
- Para dev: Use Claw localmente para iterar em novas skills/rotinas, depois "publique" para o gateway.

## 3. Integração com Seu Sistema de Fluxos Atual (FluxoEtapa)

Seu sistema atual é excelente para "dynamic flows" (melhor que hardcoded monolítico):
- Admin cria/edita FluxoEtapa (via UI ou API /fluxo-etapas): estado, gatilhos (resposta -> proximoEstado ou acao), modeloMensagem, timeout, acaoAutomatica.
- Motor dinâmico no whatsapp-fluxo-motor.service.ts.
- Fallback para legado no bot.service.ts.
- Preview e simulador in-memory.

**Melhorias com a stack:**
- **Criação de novas rotinas mais fácil e atrativa**:
  - No Obsidian: Crie "templates de fluxo" como notas (Canvas para diagrama visual do fluxo: inicial -> cobranças -> questões).
  - Agente (no WA/Telegram): "Crie um novo fluxo para suporte a novas questões" -> skill ECC analisa, propõe etapas/gatilhos/modelos, cria via API /fluxo-etapas, documenta no Obsidian.
  - Use o simulador existente + estenda com agent para "testar fluxo completo" via chat.
- **Memória**: Agente distila conversas reais (do whatsapp-service) para raw/ no Obsidian, sintetiza para wiki/fluxos/.
- **Ações (acaoAutomatica)**: Expanda com skills ECC (ex: chamar IAG para "novas questões", integrar com outros módulos).
- **Tenant**: Já bem feito (cooperativaId). Agente respeita escopo ao criar/editar.
- **UI atual (whatsapp-config)**: Mantenha para admin power-user. Para "contratante" (cooperativa), exponha via agente no chat: "Liste fluxos", "Crie etapa no fluxo X", "Preview modelo Y".

**Exemplo de nova rotina (interagindo fluxos)**:
- Fluxo Inicial (conversa inicial, captura lead).
- Transição via gatilho/universal command para "Fluxo Cobranças".
- Outro para "Novas Questões" (pode usar CoopereAI fallback ou skill IAG).
- Universal commands (MENU, INICIO) permitem pular entre fluxos.
- Agente no chat pode "sugerir" ou auto-criar conexões.

## 4. Passos Concretos para Implementar (Execute Imediatamente)

1. **Obsidian Vault**:
   - Crie um vault dedicado (ex: "CoopereBR-Knowledge" ou integre ao seu atual).
   - Estrutura:
     - 00-raw/ (ingestão: logs WA, memory dumps).
     - 01-wiki/ (síntese: fluxos, entidades, decisões).
     - 02-flows/ (espelho de FluxoEtapa + diagramas Canvas).
     - 03-agents/ (cópia de wa-bot-agent.md, wa-guardian, novos skills).
     - 04-memory/ (sync com .agent/memory do OpenClaw).
   - Instale plugins Obsidian: Dataview, Canvas, Copilot (para chat local com vault), Smart Connections ou similar para RAG.

2. **Skills de Integração**:
   - Crie skill ECC "cooperebr-flows" (em .claude/skills/cooperebr-flows/SKILL.md):
     - Tools: Read/Write (para Obsidian), Bash (curl para API backend /fluxo-etapas).
     - Comandos: /flow list, /flow create <nome> <estado> <gatilhos...>, /flow preview <id>, /flow sync-to-obsidian.
     - Use o API existente (já tem controller com POST/PUT/GET).
   - Carregue no OpenClaw/Hermes (via SOUL ou config de skills).
   - Para Claw: /load cooperebr-flows durante sessões de dev.

3. **Multi-Channel**:
   - OpenClaw: Já configurado. Adicione skill "cooperebr-flows" e "obsidian-sync".
   - Hermes: Rode hermes gateway setup, configure WA + Telegram, adicione skills equivalentes (Hermes suporta skills/obsidian integration).
   - ECC Telegram plugin: Use para acesso ao canal (já tem skills/access). Para WA, delegue ao OpenClaw/Hermes.
   - Unificado: Um agente principal no gateway que usa todos os layers.

4. **Claw para Dev**:
   - Instale/rode Claw: cd cooperebr && npm run claw ou similar.
   - Use para branching: crie branch "novo-fluxo-cobranca", teste prompts, exporte para Obsidian.
   - Compaction para manter contexto em sessões longas de design de fluxos.

5. **Sincronização e Automação**:
   - No OpenClaw/Hermes agent: Adicione heartbeat ou cron para sync memory -> Obsidian (resumos de conversas -> raw/, extraia padrões -> wiki/).
   - Use wa-bot-agent.md como base, estenda com ECC patterns.
   - No backend: Adicione webhook ou job para quando novo FluxoEtapa criado, agente notifica ou atualiza Obsidian.

6. **Segurança e Tenant**:
   - Mantenha scoping no API.
   - No agente: Sempre passe cooperativaId quando relevante.
   - Use ECC security rules (do .claude/rules).

## 5. Benefícios para Usuário Configurador e Contratante

- **Configurador (admin)**: Em vez de só UI lista+modal, use chat no WA/Telegram com agente: "Crie fluxo de novas questões com 5 etapas, gatilho 'suporte', modelo 'resposta-padrao'". Simule no chat. Veja tudo no Obsidian (visual, links). Menos fricção, mais iterativo.
- **Contratante (cooperativa)**: Personalize fluxos sem depender só de dev. Agente ajuda a criar rotinas novas. Conhecimento transparente no Obsidian (auditoria fácil). Multi-tenant nativo.
- **Atrativo geral**: Combina o melhor: execução em canais que usuários já usam (WA/Telegram) + memória durável e editável (Obsidian) + estrutura e eficiência (ECC) + dev interativo (Claw) + seu domínio existente (FluxoEtapa dinâmico).

**Próximos Passos Imediatos Sugeridos**:
- Rode Claw para prototipar a skill "cooperebr-flows".
- Crie o vault Obsidian e popule com cópia dos memory files atuais + docs de flows.
- Adicione a skill ao seu OpenClaw "coop" agent.
- Teste: No WA/Telegram, peça ao agente para listar fluxos ou criar um novo (via API).

Esta arquitetura permite evoluir seu sistema de fluxos de "quase-dinâmico via UI" para "altamente configurável e auto-documentado via agentes multi-canal + PKM".

Se quiser, posso gerar o código da skill "cooperebr-flows" agora, ou atualizar arquivos existentes (ex: estender wa-bot-agent.md, adicionar script de sync).
