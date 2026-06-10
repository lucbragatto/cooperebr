# Dossiê Análise Profunda WhatsApp/Bot + Histórico vs Realidade — 09/06/2026

**Tipo de sessão:** Análise QA profunda + revisão histórica completa (conforme pedido explícito do usuário).

**Ações executadas:**
- Leitura exaustiva de todas as sessões relevantes em docs/sessoes/ (de abril a junho 2026, com foco nos mais recentes sobre Token-WA, multi-cadastro, convite-lote, onboarding, IAG, etc.).
- Leitura de CONTROLE-EXECUCAO.md (estado vivo + "Onde paramos").
- Leitura completa do código WhatsApp/bot: whatsapp-bot.service.ts, whatsapp-fluxo-motor.service.ts, modelo-mensagem.service.ts, whatsapp-sender.service.ts, whatsapp-ciclo-vida.service.ts, whatsapp-cobranca.service.ts, integração com FluxoEtapas, CooperToken, PinCooperado, etc.
- Análise comparativa: planos/decisões históricas (das sessões) vs estado atual do código e do sistema.
- Investigação de **todos os fluxos de WhatsApp e bot** (visitante, cooperado, empresa conveniada, convite, onboarding, CooperToken, ciclo de vida, cobrança, MLM, etc.).
- Análise multi-perspectiva: Arquiteto de sistemas/DB, Desenvolvedor, Design/UX, Usuário final.
- Sugestões de aperfeiçoamento priorizadas (P0-P3), categorizadas.

**Entrega:**
- Dossiê completo salvo em: docs/relatorios/2026-06-09-DOSSIE-ANALISE-PROFUNDA-WHATSAPP-HISTORICO.md
- Versão curta despachada via função WhatsApp nativa do projeto (usando o padrão do WhatsappSenderService + infraestrutura do bot, com número whitelist +5527981341348).
- Este arquivo + o relatorio em docs/relatorios/ estão prontos para carregamento direto no Claude Code desktop / ECC.

**Resumo executivo (do dossiê):**
O que ainda faz sentido e foi bem atendido: ritual de documentação, blindagem multi-tenant, fonte única de verdade em fluxos críticos, bot como canal principal + "Qual cadastro?", CooperToken Fase 1+2 com hardening.

O que não faz mais sentido ou está incompleto: modelos/etapas órfãos, ações declaradas mas não implementadas, estado de conversa inchado, envio em lote frágil, resíduos de UX antiga, dados de cadastro que somem em telas, phone normalization pendente, Fase 3 Token-WA pausada com razão.

Sugestões principais: versionar fluxos/modelos, fila persistente real para envios, governança de banco de mensagens, UX de troca de cadastro explícita, observabilidade do bot, hardening do circuito CooperToken antes de Fase 3.

**Ação de envio WhatsApp executada agora** (via script send-dossie-whatsapp.mjs usando o padrão do projeto).

**Próximo passo:** Aguardar confirmação/feedback do usuário para continuar testes de fluxos específicos ou outros aprofundamentos.

(Conteúdo completo do dossiê está no arquivo de relatorio referenciado acima — este é o registro ritual de sessão conforme CLAUDE.md.)