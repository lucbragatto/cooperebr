# Análise Consolidada dos Artefatos de 09/06/2026 (QA + Testes + Investigação)
### Orquestrador — 100% read-only, código em `origin/main b810e7b`. Nada executado no produto.

> **Pedido do Luciano:** analisar os 4 arquivos 09/06 em `docs/relatorios/` (dossiê,
> investigação, teste, teste). Como "investigação" é o meu próprio relatório, analisei
> os outros 3 + cruzei com a minha investigação profunda e com o dossiê WhatsApp.

## Os artefatos (o que é cada um + como foi feito)

| # | Arquivo | Autor/Tipo | Método | Maturidade |
|---|---|---|---|---|
| 1 | `DOSSIE-QA-Modelos-Usuario-Pagina-por-Pagina.md` | QA Funcional (Grok) | Leitura de código (frontend/backend) + Cenário 1 parcial | **Mapa estrutural** — muito "a investigar/verificar/possivelmente" |
| 2 | `INVESTIGACAO-E-COMPARATIVO-WA-HISTORICO.md` | **Meu** (workflow 7 agentes) | 6 frentes read-only + evidência `arquivo:linha` | Verificado no código |
| 3 | `teste-enduser-cadastro-admin.md` | Grok | **Simulação** via API/Prisma (muito "deveria/mudaria") | Simulação + leitura |
| 4 | `teste-cadastro-admin-whatsapp.txt` | Grok | Versão curta do #3 (resumo + envio WA) | Resumo |
| (+)| `sessoes/...dossie-...whatsapp-bot-historico.md` | Outra IA | Revisão histórica + código WA | Registro ritual (o "completo" nunca foi gravado) |

**Leitura honesta da maturidade:** exceto a minha investigação (#2, com prova no código),
os demais são em grande parte **mapa estrutural + simulação**, não teste funcional de
clicar-e-ver. O **único teste funcional real** foi o **Cenário 1** (onboarding Santi),
que justamente achou os bugs #1-4. Isso confirma o que você apontou antes: "os testes não
pegam nada" porque a maioria é **leitura de código**, não clique de ponta a ponta.

---

## Convergências (todos batem)
- **Convite em lote não envia** (bug #1 / Bug A). Confirmado em todos.
- **UI não atualiza sem F5** (bug #2 / Bug B). Confirmado.
- **Dados de UC/EDP/kWh somem nas telas** (bug #3 / Bug C). Confirmado — e **minha
  investigação dá a causa-raiz**: membro `PENDENTE` (`ativo=false`) é filtrado em
  `convenios-custeio.service.ts:274` + a listagem não expõe a UC.
- **Card do convênio ignora tarifa fixa** (bug #4). Confirmado (já tínhamos mapeado).

## Correções / nuances que a minha investigação traz aos testes do Grok

**1. Existem DOIS mundos de cadastro — o Grok testou o raso.**
- `/auth/register` (o que o teste #3 cobriu): cria só a **conta de login** (perfil
  COOPERADO, **sem UC, sem cota, sem proposta**) — `auth.service.ts:31-71`.
- O onboarding **real** é `cadastroWebV2` / `/convenios/auto-inscrever`: cria Cooperado +
  **UC + cotaKwhMensal + proposta + vínculo de convênio PENDENTE**.
- ⇒ "cadastro funciona" do teste #3 vale só pra criação de conta; **não** valida o fluxo
  que o cliente real percorre.

**2. "Aprovar cooperado → envia WhatsApp" — depende do caminho.**
- **Cooperado direto** (`cooperados.service.ts`): a esteira **tem** ganchos de WhatsApp
  (`notificarMembroCriado`, `notificarContratoGerado`, `notificarConcessionariaAprovada`,
  `enviarMensagem`). → Grok **certo** aqui.
- **Membro de convênio** (`aprovarPorAdmin`): **só notificação in-app**; WhatsApp é
  **TODO da Fatia 6**. → Grok **otimista/errado** aqui — e **é justamente o caminho da
  Santi** (o que você está testando). Esse é o gap real que você sentiu.

**3. OCR pelo WhatsApp** (do dossiê WA): "PROCESSAR_OCR não implementado" → na verdade
`PROCESSAR_OCR_PROXY` **está** implementado (extrai), mas **não persiste** (sem
FaturaProcessada, sem arquivo). Reconciliado no meu relatório anterior.

## O que cada artefato acrescenta de único (vale aproveitar)
- **Dossiê QA (#1):** o melhor **mapa de papéis/telas** — 6 modelos de usuário, página a
  página. Destaques estratégicos: **proprietário** (evoluiu muito pós-AN, 36/36 specs) e
  **agregador/administradora** (ainda esqueleto/PARCIAL — papel de "captação em rede/MLM"
  ficou pra trás; vale priorizar se o objetivo é escalar parceiros estilo Hangar). ⚠️ Mas
  é mapa, não teste — muitos itens marcados "a verificar".
- **Testes Grok (#3/#4):** úteis pra confirmar que a **camada auth/core** básica funciona
  e que há **vários PENDENTES antigos** acumulados (gargalo de aprovação manual). Pouco
  profundo no fluxo real.
- **Minha investigação (#2):** o **ciclo de dados** (recebe→OCR→salva→exibe→notifica) com
  causa-raiz + severidade + os 3 P1 (BOT não persiste fatura; PII sem cripto em `dadosTemp`;
  admin sem aviso proativo).

---

## Quadro unificado de bugs/gaps (dedup de TODOS os artefatos 09/06)

**P1**
- BOT recebe e lê a fatura mas **não salva** (arquivo nem FaturaProcessada) — só `dadosTemp` volátil. *(meu #2)*
- **PII sem criptografia** em `ConversaWhatsapp.dadosTemp` (CPF, fatura, consumo) — risco LGPD. *(meu #2)*
- **Admin não é avisado** de cadastro novo PENDENTE (Santi e CoopereBR). *(meu #2 + dossiê QA #1)*

**P2**
- **Convite em lote não envia** (Bug A / #1) — sem fila persistente (dossiê WA sugere BullMQ).
- **UI não atualiza sem F5** (Bug B / #2).
- **Dados UC/EDP/kWh somem** (Bug C / #3) — causa: `PENDENTE` filtrado + UC não exposta.
- **Membro de convênio não recebe WhatsApp** em nenhuma transição (Fatia 6 TODO) — pessoa não sabe o progresso.
- `consumoStashOcr` **não populado no BOT** (quebra reconciliação Fatia 1.4).
- `historicoConsumo` sem validação; órfãos em `tmp/convite-uploads/` sem limpeza; OCR truncado (`max_tokens`); `email-monitor` `NAO_IDENTIFICADA` silencioso.

**P3**
- **Card ignora tarifa fixa** (Bug #4).
- Duplo-hop (avisar admin da empresa quando CoopereBR aprova).
- `cotaKwhMensal` × `mediaKwhCalculada` divergem; UC SINTÉTICA não distinguida na UI; magic link não auto-enviado.

**Estratégico (não-bug):**
- **Agregador/administradora** parado em esqueleto — papel de captação/MLM. Decidir se prioriza.
- **Gargalo de aprovação manual** — muitos PENDENTES antigos acumulados.
- **Maturidade de QA:** falta teste funcional real (clique de ponta a ponta); hoje é majoritariamente leitura/simulação. (É a iniciativa de "agentes usuários" / `cooperebr-qa-funcional` que resolve isso.)

---

## Recomendação
Os 4 artefatos + os dois dossiês **convergem pro mesmo sprint** que já desenhei:
**"Fechamento do ciclo WhatsApp + Onboarding"** (persistir fatura do BOT; LGPD do
`dadosTemp`; cadeia de notificação proativa incluindo **WhatsApp pra membro de convênio**;
tornar PENDENTE visível; governança). A novidade que os testes adicionam:
1. priorizar a **notificação WhatsApp no caminho de convênio** (hoje 100% ausente, ao
   contrário do cooperado direto que já tem);
2. **subir a maturidade de QA** pra teste funcional real (não só leitura);
3. avaliar o **agregador** como trilha de crescimento separada.

> **A verificar (próxima rodada read-only):** passo final do fluxo cooperado do bot cria
> FaturaProcessada? quais `FluxoEtapa` no DB apontam ações sem handler? valor de `OCR_MAX_TOKENS`?

---
*Read-only. Não-commitado (regra "não executar"). Cruza `origin/main b810e7b`.*
