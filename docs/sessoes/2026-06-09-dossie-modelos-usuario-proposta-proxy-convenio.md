# Dossiê Modelos de Usuário + Proposta Proxy via Convênio para Agregador/Condomínio — 09/06/2026

**Tipo:** Sessão QA Funcional (análise profunda, leitura de artefatos, sugestões de melhorias — sem implementação).

## TL;DR (para leigo)
Hoje foquei em aprofundar o dossiê que mapeia todas as telas e funções por tipo de usuário no sistema (super admin, admin de parceiro, cooperado, proprietário de usina, agregador que capta clientes, empresa conveniada). Li muito do histórico (sessões antigas, VISAO, código) e aprofundei especialmente as partes do Proprietário de Usina (repasse e despesas — que já tem um sprint inteiro entregue) e do Agregador (que ainda está bem cru, era pra ser o "Carlos que capta via MLM como no Hangar").

O grande tema foi a sua proposta: por enquanto, usar o portal já existente da Empresa Conveniada (o convênio) como "atalho" para os papéis de Agregador e Condomínio, escondendo as telas dedicadas deles (que estão incompletas) e melhorando a tela do convênio para cobrir esses casos. Analisei prós/contras de vários ângulos (técnico, de quem usa, de design, de arquitetura) e dei sugestões concretas de melhorias na tela do convênio (nomenclatura flexível, seção "Minha Rede de Captação", KPIs de quem trouxe os membros, suporte a condomínio com rateio, flags técnicas para não bagunçar o futuro, etc.). 

Entreguei o dossiê atualizado com tudo isso. Você vai passar pro Code analisar primeiro. Amanhã retomo com o que o Code disser.

## Entregas
- Dossiê principal atualizado com seções 3.5 (PROPRIETARIO_USINA) e 3.6 (ADMIN_AGREGADOR) bem mais profundas, incluindo:
  - Mapeamento real de páginas, backend, regras, entregas do Sprint AN (repasse proprietário) e estado atual do agregador.
  - Análise completa da proposta de proxy via convênio (prós, contras, riscos de confusão de papéis, dívida futura).
  - Sugestões detalhadas de melhorias na tela do convênio (7 pontos priorizados: nomenclatura, seção de captação/rede, suporte a condomínio, KPIs, UX, arquitetura com flag, testes como QA).
  - Dúvidas, soluções e melhorias de uso/técnicas de múltiplas perspectivas (arquiteto de sistemas/DB, desenvolvedor, design/UX, usuário final).
- Leitura adicional de sessões e código (leitura-total, cadeia-hangar, AN sprint, serviços de proprietário/repasses-proprietario/admin-proprietarios, administradoras, páginas frontend de conveniada/agregador/proprietario, etc.) para embasar a análise.
- Preparação de resumo curto para envio via WhatsApp do projeto (número whitelist +5527981341348) e arquivos em docs/relatorios/ + docs/sessoes/ para Claude Code desktop carregar direto.
- Fechamento ritual completo (esta doc + atualização do CONTROLE-EXECUCAO.md com frase de retomada).

## Débitos novos catalogados
- D-novo-PROXY-CONVENIO-CONFUSAO-PAPEIS (P2): Usar convênio como proxy para agregador/condomínio pode gerar confusão de identidade e UX se não houver nomenclatura/flexibilidade clara (ex: "minha rede" vs "funcionários").
- D-novo-PROXY-CONVENIO-MIGRACAO-FUTURA (P3): Quando evoluirmos os portais dedicados de agregador/condomínio, teremos migração de usuários/dados que já se acostumaram com o proxy (sugestão: planejar flag + tags de origem desde agora).
- D-novo-TESTES-PROXY (P1): Antes de liberar o proxy, testar explicitamente os bugs conhecidos amplificados (convite lote, refresh após aprovação, visibilidade kWh/UC) no contexto de "agregador" e "condomínio".
- Carry-over: Agregador/condomínio continuam como os portais mais atrasados (esqueleto desde abril, "cruzamento de dados real falta").

## Débitos resolvidos / atualizados
- Nenhum novo resolvido nesta sessão (foi de análise e sugestão, sem implementação). Os débitos de MLM/captacao e telas parciais de agregador/condomínio foram apenas catalogados/mapeados com mais profundidade.

## Bugs descobertos durante validação / análise
- Nenhum bug novo de código (sessão de leitura/análise). Os já conhecidos (convite em lote não envia, UI não atualiza após aprovar, dados de cadastro não aparecem) foram reforçados como críticos para o proxy (vão afetar os usuários que usarem o convênio como "agregador" ou "condomínio").
- Gap de documentação: Muitos papéis (agregador, condomínio) ainda aparecem como "PARCIAL" ou "esqueleto" em inventários antigos (leitura-total), enquanto o convênio evoluiu muito — isso reforça a proposta de proxy.

## Pendências abertas para próxima sessão
- Usuário vai passar o dossiê atualizado (com a análise da proposta de proxy) para o Code analisar/implementar primeiro.
- Ao retomar amanhã: Validar feedback do Code sobre a proposta (aprova o proxy? quais melhorias prioriza na tela do convênio?).
- Se aprovado, planejar testes funcionais do proxy (Cenário com Hangar-like usando o convênio como agregador, com telefone whitelist).
- Continuar leitura de outros artefatos se necessário (ex: mais sessões de MLM/indicações ou administradoras).
- Enviar o relatório via WhatsApp do projeto (número +5527981341348) + deixar arquivos prontos para Claude Code desktop.
- Manter o dossiê vivo (atualizar com o que o Code decidir).

## Decisões catalogadas
- Decisão do usuário: Passar o dossiê para o Code analisar tudo antes de retomar aqui (evitar trabalho em paralelo).
- Proposta de proxy via convênio: Analisada e recomendada como pragmática no curto prazo (prós: velocidade, reuso de código maduro do Hangar; contras: risco de confusão de papéis e dívida de migração futura). Sugerido suprimir as telas de agregador/condomínio por enquanto + lista de melhorias concretas na tela do convênio (nomenclatura flexível, seção "Minha Rede", KPIs de captação, suporte a condomínio, flags técnicas, testes QA).
- Perspectiva multi: Análise feita como QA (só reportar), arquiteto (modelagem, dívida futura), desenvolvedor (reaproveitamento, flags), design/UX (nomenclatura, HelpBox, visibilidade de captação) e usuário final (ferramenta útil para quem capta sem telas quebradas).

## Próximo passo único e claro
Aguardar retorno do usuário amanhã com feedback do Code sobre o dossiê e a proposta de proxy via convênio. Quando voltar: 
1. Validar se aprova o proxy + quais melhorias da lista priorizar na tela do convênio.
2. Se sim, atualizar o dossiê + preparar execução de testes funcionais do proxy (usando o convênio como agregador/condomínio, com dados de teste, telefone whitelist, verificando os bugs conhecidos).
3. Continuar o mapeamento de outras páginas/fluxos do dossiê ou leitura de sessões pendentes, conforme orientação.
(Frase completa na seção de retomada do CONTROLE-EXECUCAO.md — copie e cole direto pro Code.)

**Pré-requisitos para próxima sessão (ordem recomendada):**
1. Este arquivo (docs/sessoes/2026-06-09-dossie-modelos-usuario-proposta-proxy-convenio.md).
2. Dossiê principal atualizado: docs/relatorios/2026-06-09-DOSSIE-QA-Modelos-Usuario-Pagina-por-Pagina.md (com as seções aprofundadas + análise da proposta).
3. CONTROLE-EXECUCAO.md (seção "Onde paramos" e frase de retomada de hoje).
4. Sessões relevantes: 2026-04-28-leitura-total-parte1.md (visão dos papéis e Carlos agregador), 2026-04-24-cadeia-hangar-distribuicao.md (exemplo real Hangar como agregador via empresa), 2026-05-30-sub-sprint-an-repasse-proprietario-completo.md (entregas do proprietário), e o código do convênio (web/app/conveniada/* + backend de convites/membros).
5. git log --oneline -10 (para ver o que mudou desde a última vez).

**Lição / decisão importante desta sessão:** Usar o convênio como proxy é bom para desbloquear captação agora (aproveita o que Hangar já prova), mas exige melhorias na tela (nomenclatura + seção de rede + KPIs) e documentação clara de que é temporário. Evita mostrar telas quebradas e foca no que já está maduro. Quando o Code evoluir os portais dedicados, a migração será mais fácil porque o núcleo (convites, membros, kWh, aprovação) já está bem trabalhado.

---

**Arquivos entregues / atualizados nesta sessão:**
- docs/relatorios/2026-06-09-DOSSIE-QA-Modelos-Usuario-Pagina-por-Pagina.md (atualizado com seções 3.5/3.6 aprofundadas + análise completa da proposta de proxy).
- docs/sessoes/2026-06-09-dossie-modelos-usuario-proposta-proxy-convenio.md (esta — registro ritual).
- Preparado resumo curto para WhatsApp do projeto (número +5527981341348) + arquivos em docs/ para Claude Code desktop.
- CONTROLE-EXECUCAO.md atualizado (próximo passo nesta sessão).

**Bugs / gaps destacados para o Code (do dossiê):**
- Agregador e condomínio ainda muito parciais (esqueleto desde abril) — proxy via convênio ajuda a não mostrar isso agora.
- Bugs conhecidos que vão impactar o proxy: convite em lote não envia, UI não atualiza após aprovar, dados de cadastro (UC/kWh) não aparecem direito.
- Risco de confusão de papéis se não melhorar a nomenclatura/flexibilidade na tela do convênio.

Obrigado pela sessão. Amanhã retomo com o que o Code trouxer. Boa noite!