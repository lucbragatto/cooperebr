# Corretiva de Segurança — Mensageria WhatsApp — 16/07/2026

## TL;DR

Sessão maratona de segurança pós-auditoria read-only 2026-07-16 do pipeline
de mensageria WhatsApp. **5 dos 7 achados fechados, 2 pendentes** (Achado 3
secret webhook na query; Achado 4 sessão Baileys em texto claro). Os
achados 5, 6 e 7 nasceram DURANTE a corretiva — verificações read-only V2,
V3 e V4 escalaram achados dormentes/latentes em ativos. Todos os fixes
usam o mesmo padrão: **classificação NA ORIGEM (não regex)**, flag/estado
sensível como contexto, teste do PAR (não-sensível + sensível) com
espelho/canal ATIVO via env mockada, e **prova por mutação** demonstrada
antes de aprovar. **Contagem histórica: 14 OTPs em claro em `mensagens_
whatsapp` (todos smoke expirados), 0 em `dadosTemp`, 0 no inbound —
higiene aplicada preventivamente.** Nenhum incidente. 7 commits locais
**não pushed** (aguardando revisão final do Luciano).

## Marco entregue

**Corretiva SEG WA-2026-07-16 (5/7 achados)** — 5 das 7 partes da corretiva
de segurança da mensageria WhatsApp fechadas. Achados 3 e 4 planejados
mas não implementados nesta sessão.

## Commits do dia (6 trabalho + 1 débito reclassificado)

| Hash | Mensagem |
|---|---|
| `d5003f4` | `fix(seg): faturas — roteia relatorio pos-aprovacao via WhatsappSenderService (Achado 2)` |
| `efc276b` | `fix(seg): sender — flag 'sensivel' evita espelho super-admin em OTP (Achado 1)` |
| `ee54a12` | `fix(seg): sender — nao persiste OTP em claro no log de mensagens (Achado 5)` |
| `17501eb` | `docs(debitos): P2 over-fetching em whatsapp-fatura.controller.getHistorico` (RECLASSIFICADO no A7) |
| `34f3a57` | `fix(seg): bot — redige inbound sensivel (PIN/OTP/CPF) em mensagens_whatsapp (Achado 6)` |
| `43fe3f8` | `fix(seg): PIN em ConversaWhatsapp.dadosTemp — select + cron + zeragem + hash defesa em prof (Achado 7)` |

**Não pushed.** Instrução explícita do Luciano durante toda a sessão:
"sem push" a cada achado, revisão final antes de subir pra origem.

## Entregas técnicas por achado

### Achado 2 — Faturas via fachada (silent 404 → sucesso falso) — `d5003f4`

- `FaturasService.enviarRelatorioAposAprovacao` chamava `http://localhost:3002/api/send` (endpoint INEXISTENTE — rota real é `/send-message`), recebia 404 sem checar `res.ok`, logava sucesso.
- Fix: injeta `WhatsappSenderService` via `forwardRef` (não `@Optional` — falha no boot em vez de silenciosa em runtime + `.catch(() => {})` do caller externo virar o próprio bug).
- Spec `faturas.service.enviar-relatorio.spec.ts` (3 cenários) — quebra se alguém reintroduzir `fetch` direto ao `:3002`.
- Débito P2 `D-novo-WA-SENDER-CICLO-BILATERAL` catalogado — solução limpa é extrair `WhatsappSenderService` pra módulo próprio sem dep de `FaturasModule`.

### Achado 1 — Flag `sensivel` no espelho super-admin — `efc276b`

- `WhatsappSenderService.enviarMensagem` copiava TODA mensagem pro `SUPER_ADMIN_PHONE`. Dormente (env não setada em prod) mas ativo por desenho.
- Fix: parâmetro opcional `sensivel?: boolean` (default `false`) no 3º arg. Quando `true`, o espelho pula. Auditoria: `[ESPELHO] enviado` / `[ESPELHO SKIP: sensivel]`.
- 2 emissores OTP ativos passam `sensivel: true`: `convites-convenio.service.ts:1217` + `whatsapp-fluxo-motor.service.ts:1721`.
- V1 completude: `enviarMenuComBotoes` alarga tipo pra aceitar `sensivel` (herda o filtro por delegação); `enviarListaMensagem` e `enviarPdfWhatsApp` NÃO espelham (documentado no header).
- Spec ativa espelho via `process.env.SUPER_ADMIN_PHONE` mockada — sem isso, o teste "sensível → não espelhou" passaria trivialmente (verde vazio).

### Achado 5 — REDACTED-OTP em `mensagens_whatsapp` — `ee54a12`

- `registrarMensagem` gravava texto completo em `conteudo` (`String? @db.Text`), incluindo OTP em claro. Contradição com `Convite.otpCodigoHash` e `OtpDesafio.codigoHash` que dizem "NUNCA plain" no próprio schema.
- Fix: `registrarMensagem` reusa a flag `sensivel`; se `true`, `conteudo = '[REDACTED-OTP]'`; metadados intactos.
- Constante `WhatsappSenderService.CONTEUDO_REDACTED = '[REDACTED-OTP]'` exportada.
- Higiene histórica: **14 linhas** de OTP em claro redigidas (todas `convite_convenio_otp`, janela 2026-06-03 a 2026-06-18, todas expiradas, dados de smoke/canário do tenant `cmn0ho8b...` = **CoopereBR principal 307 cooperados**). Confirmação pós-UPDATE: 0 linhas em claro.

### Achado 6 — Inbound sensível em `mensagens_whatsapp` (PIN/OTP/CPF) — `34f3a57`

- `WhatsappBotService.processarMensagem` gravava o TEXTO CRU do inbound (`direcao='ENTRADA'`), incluindo PIN em fluxo `DEFINIR_PIN`.
- Fix: consulta `ConversaWhatsapp.estado` ANTES de gravar. Se estado ∈ `ESTADOS_INBOUND_SENSIVEL` (constante nomeada, fonte única de verdade), grava sentinel `[REDACTED-SENSIVEL]`. Estados iniciais: `DEFINIR_PIN_AGUARDANDO_OTP/PIN/CONFIRMACAO`, `ALTERAR_LIMITE_AGUARDANDO_PIN`.
- Método privado `gravarInbound` extraído — teste cirúrgico.
- **Rede de segurança:** spec varre `whatsapp-bot.service.ts` + `whatsapp-fluxo-motor.service.ts` por literais `estado: 'X'` / `case 'X':`, filtra ações por prefixo verbal (`INICIAR_/VALIDAR_/SALVAR_/CONFIRMAR_/RECEBER_/CONSULTAR_`), e FALHA se algum estado casa `/PIN|OTP|SENHA|LIMITE/i` fora da lista. Allowlist explícita hoje só com `ALTERAR_LIMITE_AGUARDANDO_VALOR`. Nota de limitação documentada no spec (`FluxoEtapa` do banco não é varrido).
- Contagem histórica: **0/0** — 263 inbound total, 0 PINs, 0 OTP+CPF. Preventivo.
- Débito P3 `D-novo-WA-SUPORTE-CORPO-EM-LOG` catalogado — `whatsapp-bot.service.ts:1121` loga corpo em `AGUARDANDO_ATENDENTE` (sem PIN/OTP mas pode logar conteúdo privado).

### Achado 7 — PIN em `ConversaWhatsapp.dadosTemp` — `43fe3f8`

Descoberto na varredura V4 do Achado 6. Escopo: PIN persistido em CLARO como `definirPinPropostoTemp` na scratchpad JSON entre `DEFINIR_PIN_AGUARDANDO_PIN` → `_AGUARDANDO_CONFIRMACAO`. `dadosTemp` chegava ao browser via `findMany` sem `select`.

**4 partes num commit único** (correção conceitual do Luciano — hash sozinho não protege 6 dígitos):

1. **`select` explícito** (fronteira de contenção real) — `getConversas` (`:170`), `getHistorico` (`:278`), `getHistoricoContato` (`:355`). Absorve o débito P2 do `17501eb` que foi RECLASSIFICADO: "não era over-fetching cosmético, era canal de vazamento".
2. **Cron ampliado** — `whatsapp-conversa.job.ts:31` filtro anterior `startsWith('AGUARDANDO_')` NÃO cobria `DEFINIR_PIN_*` nem `ALTERAR_LIMITE_*`. Novo filtro: `OR(startsWith('AGUARDANDO_') OR estado IN ESTADOS_AGUARDANDO_INPUT)`. Lista canônica reusa `ESTADOS_INBOUND_SENSIVEL` do bot service (fonte única).
3. **Zeragem no caminho de divergência** — antes, `pin !== pinProposto` só mostrava erro e retornava sem limpar `dadosTemp`. Agora limpa E transita pra `DEFINIR_PIN_AGUARDANDO_PIN` pra reinício.
4. **Hash defesa em profundidade** — `dadosTemp.definirPinPropostoHash + definirPinPropostoSalt` via `otp-helper.hashOtp/gerarSaltOtp`; comparação via `otp-helper.compararOtp` (timingSafeEqual). Reuso INTEGRAL do helper (já auditado, testado, em produção). **Comentário no código diz com todas as letras "DEFESA EM PROFUNDIDADE, NÃO CONTENÇÃO"** — PIN=10^6, admin com {hash, salt} bruta em 0.1s. Contenção real = SELECT (parte 1).

Contagem histórica: **0/43** conversas com PIN residente. Preventivo.

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| Achado 2 | Alta | Endpoint `/api/send` inexistente + `res.ok` não checado | Rota via fachada + 2xx-only | ✅ RESOLVIDO `d5003f4` |
| Achado 1 | Média (dormente) | Espelho super-admin copia OTP integral | Flag `sensivel` NA ORIGEM | ✅ RESOLVIDO `efc276b` |
| Achado 5 | Alta (ativa) | OTP persistido em claro no log | REDACTED-OTP via flag reusada | ✅ RESOLVIDO `ee54a12` + higiene 14 linhas |
| Achado 6 | Máxima (preventiva) | Inbound PIN gravado em claro | REDACTED-SENSIVEL via estado da conversa | ✅ RESOLVIDO `34f3a57` |
| Achado 7 | Máxima (preventiva) | PIN em `dadosTemp` + `findMany` sem select | `select` + cron + zeragem + hash defesa em prof | ✅ RESOLVIDO `43fe3f8` |
| Achado 3 | Média | Secret webhook em query string | Header + compat + teste 4 cenários | 🔴 PENDENTE próxima sessão |
| Achado 4 | Baixa | Sessão Baileys em texto claro | icacls + .gitignore + README | 🔴 PENDENTE próxima sessão |
| `D-novo-WA-SENDER-CICLO-BILATERAL` | P2 | forwardRef bilateral + injeção undefined | Extrair sender pra módulo próprio | ❕ CATALOGADO |
| `D-novo-WA-HISTORICO-OVERFETCH` | P2 → RESOLVIDO | Over-fetching em endpoint autenticado | Reclassificado no A7 como canal de vazamento | ✅ RESOLVIDO no A7 |
| `D-novo-WA-SUPORTE-CORPO-EM-LOG` | P3 | Log de corpo em PM2 no estado suporte | Remover `${corpo}` do log ou mask | ❕ CATALOGADO |

## Decisões estratégicas catalogadas

- **Padrão de correção para achados de segurança**: classificação NA ORIGEM (não regex), teste do PAR com canal ATIVO via env mockada, prova por mutação obrigatória antes de aprovar. Consolidado ao longo da sessão nos 5 achados.
- **Rótulo travado do tenant** para doc-sessão: `cmn0ho8bx0000uox8wu96u6fd` = **CoopereBR principal (307 cooperados)** — não confundir com "CoopereBR Teste" (TRIAL, 4 cooperados).
- **Regra "sucesso só com artefato"** importada da casa JurIAG — nenhum log de sucesso sem resposta 2xx verificada.
- **Hash em scratchpad JSON não protege PIN 6-dígitos** — 10^6 combinações + salt no mesmo JSON = 0.1s de brute force. Fix real de canal é `select`, hash é defesa em profundidade contra regressão. Registrado no comentário do código.
- **`ESTADOS_INBOUND_SENSIVEL` = fonte única de verdade** (Achado 6). O cron de higiene (Achado 7) reusa a mesma lista — sinergia bidirecional.
- **`dadosTemp` é scratchpad por design** — hoje tem hash+salt, amanhã tem o que o próximo fluxo puser. Contenção via `select` explícito na fronteira do endpoint.
- Nenhuma memória global em `~/.claude/projects/.../memory/` foi criada nesta sessão (mudanças específicas de sessão vão no doc-sessão + CONTROLE, memórias reservadas pra regras cross-sessão).

## Higiene de histórico aplicada

Executada por instrução explícita do Luciano no Achado 5, com dry-run prévio + confirmação pós-UPDATE:

- **UPDATE 2026-07-17T00:32:00Z** (21:32 BRT, 2026-07-16), duração 756ms.
- Filtro fechado: `tipoDisparo IN ('convite_convenio_otp', 'definir_pin_otp') AND conteudo <> '[REDACTED-OTP]'`.
- **14 linhas redigidas** (todas `convite_convenio_otp`; `definir_pin_otp` = 0, etiqueta nasceu no `efc276b`).
- Janela: 2026-06-03 a 2026-06-18, todas expiradas (TTL 10min).
- Natureza: smoke/canário do tenant **CoopereBR principal** (`cmn0ho8b...`); nomes sintéticos ("teste", "Smoke *", "Funcionário Teste 2").
- Metadados preservados (updateMany só mudou `conteudo`).
- Cross-check pré-UPDATE: heurística `LIKE '%Seu código%'` = 14 = contagem por etiqueta (nenhum OTP sem etiqueta).
- Confirmação pós-UPDATE: **0** em claro; heurística fallback: **0**; total marcado `[REDACTED-OTP]`: **14**.

Scripts one-off criados e deletados (nunca commitados): `_readonly-count-otp-plain.ts`, `_readonly-dry-run-redact-otp.ts`, `_apply-redact-otp-historico.ts`, `_readonly-count-inbound-sensivel.ts`, `_readonly-count-dadosTemp-pin.ts`.

## Próximo passo

**Retomar corretiva SEG WA-2026-07-16 nos Achados 3 e 4:**

- **Achado 3** — Secret webhook: query → header, receptor primeiro (`whatsapp-fatura.controller.ts:53-84`), scripts `smoke-c1-throttler-burst.ts` + `test-endpoints.mjs` migrados no mesmo commit, teste unit sobre função de extração/validação com **4 cenários** (só header ok, só query ok com warn, header+query juntos sem warn duplicado, sem secret 401).
- **Achado 4** — Sessão Baileys em texto claro: `icacls whatsapp-service\auth_info /inheritance:r /grant:r <usuario-PM2>:F /T` em PowerShell (`$env:USERNAME` + confirmar PM2 owner antes — ACL destrutiva), .gitignore já cobre `auth_info/` (confirmado), git log vazio (nunca commitou), README do serviço com nota "a pasta É a credencial", avaliar cifra em repouso sem implementar (reportar viabilidade).

**Antes de Achado 3, Luciano tem que:**
1. Revisar os 6 commits locais (`d5003f4..43fe3f8`) — nenhum pushado.
2. `git push origin main` quando aprovar.

## Pré-requisitos leitura próxima sessão

- Este doc: `docs/sessoes/2026-07-16-corretiva-seguranca-mensageria-wa.md`.
- `docs/debitos-tecnicos.md` — 2 débitos novos catalogados (P2 CICLO-BILATERAL, P3 SUPORTE-CORPO-EM-LOG) + 1 reclassificado como resolvido (P2 HISTORICO-OVERFETCH).
- `CLAUDE.md` — regra contatos de teste (Luciano 14/05) e regra de rebuild PM2.
- `~/.claude/projects/.../memory/regra_validacao_previa_e_retomada.md` (Decisões 15/20/23).
- Prompt original do usuário sobre a corretiva (contém a especificação dos 4 achados originais + notas de execução) — mantido no histórico do chat.

## Carry-overs (não-bloqueantes)

- 5 scripts one-off foram deletados durante a sessão (nunca commitados) — nenhum resíduo no repo.
- Frontend `web/app/dashboard/whatsapp/page.tsx:139` faz `GET :3002/status` direto do browser — LISTADO como leitura legítima (não é bypass da fachada), fora do escopo da corretiva.
- 2 scripts `.mjs` one-shot (`backend/send-desculpas.mjs`, `backend/scripts/extrair-faq-whatsapp.mjs`) usam `/send-message` diretamente. Não são runtime (executados manualmente). Ficam por enquanto — se aparecer débito futuro por reuso, migrar pra fachada.
- `whatsapp-service/index.mjs:275` loga `📩 Mensagem de ${telefone} (${tipo})` — só metadados, sem corpo. Verificado seguro no V3d.

## Pendências fora do escopo desta corretiva (registrar pra não perder)

1. **4 manuais em `docs/manual/` escritos e NÃO commitados** — `cadastro-publico-cooperado.md`, `clube-convenio-coopertoken.md`, `configuracao-parceiro-sisgd.md`, `dono-de-usina.md` + pastas de imagens. PDFs já em Downloads. Decisão pendente sobre commitá-los como sessão dedicada de docs.
2. **2 despesas de demonstração na usina-linhares (E-Solares)** — `IPTU/ITR R$1.200` + `MANUTENCAO_CORRETIVA R$850`, ambas `resp=PROPRIETARIO`. Foram criadas pra enriquecer demo. Decisão pendente: manter (enriquecem a demo) ou remover.
3. **Investigação mensageria WhatsApp × JurIAG** (6 blocos + tabela + recomendação máscara vs. canal próprio) existe SÓ no chat do orquestrador — não está no repo. Norma "sucesso só com artefato" desta corretiva foi importada dessa investigação; ideal materializar num doc próprio antes que se perca do chat.

## Lição de método (não é anedota — registrar)

Os **3 achados mais graves da sessão (5, 6, 7) NÃO vieram da auditoria original.** Vieram de perguntar, depois de cada correção:

> **"Onde mais esse dado vai parar?"**

- Após o Achado 1 (redigir OTP no espelho) → V2 → Achado 5 (OTP também está em `mensagens_whatsapp.conteudo`).
- Após o Achado 5 (redigir OTP na saída) → V3 → Achado 6 (inbound do PIN também está em `mensagens_whatsapp.conteudo`).
- Após o Achado 6 (redigir inbound) → V4 → Achado 7 (PIN também está em `ConversaWhatsapp.dadosTemp`).

**E o `findMany` sem `select` foi catalogado por NÓS como "P2 over-fetching cosmético" quando era o canal de entrega do PIN pro browser** (`17501eb`). Uma classificação errada de débito escondeu um vazamento ativo por 2 commits antes do V4 reabrir a análise e o commit `43fe3f8` reclassificar como "RESOLVIDO no A7 — era canal de vazamento, não higiene".

**Regra derivada pra próximas auditorias de segurança:** todo achado de vazamento aciona uma varredura "onde mais esse dado vai parar?" — cópia visível + cópia de trabalho + logs + payload JSON + histórico. Achado individual sem varredura é meia correção.

## Regras aplicadas na sessão

- **regra_fechamento_sessao_inegociavel** (13/05) — este doc é o registro consolidado.
- **regra_contato_teste_impreterivel** (14/05) — todos os testes são jest unitário com transporte mockado; ZERO envio real de WhatsApp foi feito.
- **regra_validacao_previa_e_retomada** (Decisões 15/20/23) — Fase 1 read-only executada ANTES do Achado 2, com mapa de impacto entregue e aprovado. Cada verificação subsequente (V1-V4) precedeu a decisão de novo achado.
- **regra_nao_trabalhar_paralelo_com_code** (17/05) — Luciano manteve controle bloco a bloco; Code aguardou aprovação em cada PARA/OK.
- **regra_coerencia_sistemica_mapa_impacto** (10/06) — mapa de impacto enxuto entregue no início antes de qualquer edit.
- **feedback_analise_modelo_canonico_primeiro** — derivado no fix do Achado 7 (correção conceitual do Luciano sobre hash não proteger 6 dígitos).
- **Norma "SUCESSO SÓ COM ARTEFATO"** importada da casa JurIAG (Achado 2).

## Frase comandante

Ver seção `## FRASE DE RETOMADA` deste próprio `CONTROLE-EXECUCAO.md` (Decisão 24 — local único). Frase apresentada no terminal no fechamento da sessão.
