# Relatório de estudo — CoopereBR / SISGD como base para uma IAG

Data: 2026-05-28
Escopo: leitura do código, documentação e pontos de acoplamento com IA/assistência inteligente

## 1. Resumo executivo

O CoopereBR/SISGD não é, hoje, uma IAG completa. Ele é uma plataforma SaaS muito madura no domínio de energia solar/GD, com forte governança, multi-tenant, auditoria, WhatsApp bot, OCR com Claude e documentação extensa. Isso é uma base excelente para virar uma IAG, porque já existem dados, regras, fluxos, logs, estados e canais de interação reais.

A melhor estratégia não é “trocar o sistema por IA”, e sim adicionar uma camada de IA sobre o sistema existente: um sidecar/orquestrador agêntico, com RAG, memória estruturada, tool runner controlado, aprovação humana e observabilidade.

## 2. O que o projeto já tem de base para uma IAG

### 2.1 Fundamentos fortes
- Backend NestJS com muitos módulos de domínio.
- Frontend Next.js com várias áreas operacionais.
- Banco relacional multi-tenant com isolamento por `cooperativaId`.
- Auditoria e logs já presentes em múltiplos fluxos.
- WhatsApp como canal operacional real.
- Documentação muito rica e viva.
- Rotinas, cron jobs, estados de workflow e tarefas humanas já modelados.

### 2.2 Pontos de IA já existentes
- `backend/src/whatsapp/coopere-ai.service.ts`
  - usa `@anthropic-ai/sdk` diretamente;
  - mantém histórico de conversa por telefone;
  - salva interações em JSON e JSONL;
  - detecta temas por palavras-chave;
  - serve como primeira camada de atendimento.
- `backend/src/whatsapp/whatsapp-bot.service.ts`
  - integra a CoopereAI no fluxo real;
  - usa IA como primeiro atendimento e fallback;
  - encaminha para humano quando necessário;
  - combina regras determinísticas + IA.
- OCR com Claude em faturas e monitoramento de email.
- Script de extração de FAQ/memória a partir de interações WhatsApp.
- Documentos já citam explicitamente um futuro “motor híbrido” com LLM.

## 3. Estado atual: onde o projeto já é inteligente e onde ainda não é IAG

### Já é forte em:
- triagem de mensagens;
- extração de dados de documentos;
- automações por cron;
- workflows com estados claros;
- decisão baseada em regras de negócio;
- multi-tenant com governança.

### Ainda não é IAG de verdade porque falta:
- camada de orquestração agêntica separada do core;
- ferramentas tipadas e controladas para o modelo agir;
- RAG estruturado com fontes canônicas e dados operacionais;
- memória persistente organizada por tipo e tenant;
- política de risco e aprovação humana para escrita;
- avaliação contínua com conjunto ouro;
- proteção contra prompt injection em documentos e mensagens;
- observabilidade de custo, latência, qualidade e falhas.

## 4. Diagnóstico técnico do potencial de IAG

A leitura do repositório mostra um cenário muito favorável para evolução em IAG:

1. O domínio já está modelado em entidades reais.
2. O sistema já tem workflow, eventos, auditoria e canais de entrada.
3. Já existe uma primeira implementação de assistente com Claude.
4. A documentação já pensa em LLM híbrido, o que reduz risco de “reinventar tudo”.
5. O projeto tem maturidade suficiente para receber uma camada agêntica sem virar um protótipo solto.

O maior risco não é técnico; é de governança: deixar a IA agir sem política, memória estruturada, aprovações e testes.

## 5. O que eu proponho como caminho para virar uma IAG

### 5.1 Princípio principal
Criar um “AI Sidecar” — não colocar a IA diretamente no core transacional.

O core continua responsável por:
- contratos;
- faturas;
- repasses;
- despesas;
- auditoria;
- regras regulatórias;
- multi-tenant.

A IA entra como camada paralela para:
- ler;
- resumir;
- classificar;
- sugerir;
- comparar;
- explicar;
- montar rascunhos;
- acionar tools autorizadas.

### 5.2 Camadas recomendadas

1. Experiência de usuário
- botões “resumir”, “explicar”, “comparar”, “gerar rascunho”, “escalar humano”.
- IA embutida nas telas de operação e no WhatsApp.

2. Orquestrador agêntico
- identifica intenção, tenant, papel e risco;
- decide se responde, consulta RAG, chama tool ou escala;
- registra a trilha completa.

3. Tool runner controlado
- nenhuma IA acessa banco direto;
- ferramentas com contrato tipado;
- cada tool tem escopo, tenant e logging.

4. Memória estruturada
- operacional curta;
- perfil/preferência;
- caso/projeto;
- institucional/canônica.

5. RAG multi-tenant
- documentos canônicos;
- dados operacionais;
- mensagens e logs;
- fontes com citação e versão.

6. Governança e segurança
- RBAC/policies;
- redaction de sensíveis;
- human-in-the-loop para ações críticas;
- auditoria total;
- proteção contra prompt injection.

## 6. Sugestão de roadmap prático

### Fase 0 — Fundação
- inventário das fontes;
- taxonomia de intenções;
- classificação de risco;
- schema de logs de IA;
- política por papel e tenant.

### Fase 1 — Copilot de leitura
- IA apenas lê e explica;
- zero escrita;
- foco em faturas, contratos, documentos e estado operacional.

### Fase 2 — RAG operacional
- indexar docs canônicos e dados do sistema;
- respostas com citação;
- filtros por tenant;
- base para WhatsApp e dashboard.

### Fase 3 — Tool use com aprovação humana
- criar tarefas, rascunhos, resumos e sugestões;
- qualquer escrita passa por aprovação.

### Fase 4 — Agentes especializados por domínio
- agente de faturas;
- agente regulatório;
- agente de cobrança;
- agente de atendimento;
- agente de auditoria;
- agente do super-admin.

### Fase 5 — Autonomia controlada
- automações seguras para tarefas repetitivas;
- critérios claros de fallback humano.

## 7. Onde a IA tende a gerar mais valor primeiro

Prioridade prática:
1. WhatsApp: entender intenção, responder melhor e reduzir atrito.
2. OCR/documentos: resumir, validar, comparar e sinalizar inconsistências.
3. Dashboard interno: explicar pendências e priorizar tarefas.
4. Propostas/contratos: gerar rascunhos com base no contexto.
5. Auditoria: detectar anomalias e montar checklist.

## 8. Pontos de atenção que precisam entrar na arquitetura

- O prompt atual do CoopereAI precisa ser revisado: há referência regulatória desatualizada (RN 482/2012) em material de bot.
- O histórico do assistente existe, mas ainda é memória fraca, por conversa, sem recuperação semântica.
- Não há suíte de regressão específica para o comportamento do assistente.
- O sistema já é multi-tenant; a camada de IA precisa respeitar isso desde o começo.
- Dados sensíveis não devem ser tratados como “chat livre”.

## 9. Conclusão

O CoopereBR/SISGD já tem maturidade de plataforma para evoluir para uma IAG aplicada ao negócio.

A arquitetura mais segura e promissora é:
- core SaaS estável;
- IA como camada paralela;
- RAG e memória estruturada;
- ferramentas tipadas;
- aprovação humana para ações críticas;
- métricas e avaliação contínua.

Em outras palavras: o projeto já tem o chão. Falta construir a torre da IA em cima dele, sem mexer na fundação errada.

## 10. Próximos passos sugeridos

Se o objetivo for começar a implementação, a ordem ideal seria:
1. criar o módulo AI sidecar;
2. padronizar logs e trilha de auditoria;
3. indexar documentos e docs canônicos para RAG;
4. criar tools de leitura;
5. depois tools de escrita com aprovação;
6. por fim, agentes por domínio.

