# QA Funcional Faseado — CoopereBR/SISGD

> **Documento vivo de QA manual visual.** Última atualização do sistema: **M14 fechado em 18/05/2026** (Sub-Fase 1 Listas Concessionária COMPLETA + Sprint 8 / Bloco E Realocação Multi-Usina COMPLETO).
>
> Dúvida técnica → consultar [docs/PRODUTO.md](../PRODUTO.md) ou [docs/MAPA-INTEGRIDADE-SISTEMA.md](../MAPA-INTEGRIDADE-SISTEMA.md).

---

## Como usar este documento

Luciano, este é o roteiro pra você testar o sistema do início ao fim, **sem precisar saber programar**. Cada fase demora 10-40 minutos. **Não precisa fazer tudo num dia só** — pode parar em qualquer fase e retomar depois.

Antes de começar, lembre:

- Cada fase tem **pré-requisito** (o que precisa estar pronto antes), **passos numerados**, e um **critério de sucesso** (o que define que a fase passou).
- Pra cada passo você verá três blocos:
  - **O que fazer** (sua ação clara)
  - **O que deveria acontecer** (resultado esperado, com tela/badge/mensagem)
  - **Anotar se der errado** (sinais de bug visíveis)
- Se algo não bater, **abra um bug pelo modelo no fim do documento + anote fase + tela + URL**.
- **Este documento é COMPLEMENTAR ao subagent automatizado** `cooperebr-qa-funcional` (que roda builds, smoke, AuditLog programaticamente). Aqui é o lado **manual visual** — você percorre pela tela como um usuário real.

---

## Quando rodar este checklist

- ✅ **Antes de onboarding de novo parceiro** (Sinergia, próxima cooperativa real)
- ✅ **Após fechar sprint dedicado** (sanity check pós-marco, ex: pós-Sprint 5a Neutro Fio B)
- ✅ **Mensalmente** como ronda de saúde geral
- ✅ **Quando suspeitar de bug em fluxo específico** — pode rodar só a fase relevante isoladamente
- ❌ **NÃO rodar pra ronda diária** — pra isso, invocar o subagent `cooperebr-qa-funcional` (mais rápido, ~45 min, automatizado)

---

## Quem deve rodar cada fase

| Fase | Responsável padrão | Por quê |
|---|---|---|
| 0 — Preparação segura | Luciano | Decisão de ambiente teste vs produção |
| 1 — Login e acesso | Luciano | Único com perfil SUPER_ADMIN |
| 2 — Cadastro cooperado | Marcos (admin CoopereBR) ou equipe operacional | Fluxo do dia a dia |
| 3 — UCs (unidades consumidoras) | Marcos ou equipe | Anexa fatura, OCR, validação ANEEL |
| 4 — Usinas | Marcos ou Luciano | Cadastro técnico |
| 5 — Contratos e migrações | Marcos | Vínculo cooperado × usina × UC |
| 6 — Dashboard e relatórios | Marcos + Luciano | Visão executiva |
| 7 — Financeiro | **Walter (contador externo)** | Conferência contábil |
| 8 — Comunicação | Marcos com supervisão Luciano | Risco de disparo real |
| 9 — Cooper Token / indicações / convênios | Marcos | Features comerciais |
| 10 — Auditoria e segurança | Luciano | Visão multi-tenant SUPER_ADMIN |
| 11 — Listas Concessionária | Marcos | Fluxo operacional EDP |
| 12 — Realocação Multi-Usina | Luciano | Decisões estratégicas |
| 13 — Regras inegociáveis | Luciano | Auditoria de governança |

---

## Fase 0 — Preparação segura

**Pré-requisito:** decisão sobre qual ambiente testar (sempre teste, **NUNCA produção real** sem autorização explícita).

**Tempo estimado:** 5 min

### Passos

1. **O que fazer:** abrir o terminal e rodar `pm2 status`.
   **O que deveria acontecer:** ver `cooperebr-backend` com status `online` (verde) + `cooperebr-whatsapp` com status `online` (verde).
   **Anotar se der errado:** algum processo `errored` (vermelho) ou `stopped`. Se backend está caído, nada do checklist funciona.

2. **O que fazer:** abrir o navegador e ir em `http://localhost:3001`.
   **O que deveria acontecer:** página de login do CoopereBR carrega sem erro 404 ou tela branca.
   **Anotar se der errado:** "Cannot connect" — frontend dev caiu, precisa relancar `cd web ; npm run dev` em terminal vivo.

3. **O que fazer:** confirmar mentalmente que você vai testar SOMENTE com **dois parceiros teste do banco**:
   - **CoopereBR** (plano OURO — produção em teste)
   - **CoopereBR Teste** (plano PRATA TRIAL — sandbox)
   **O que deveria acontecer:** nenhuma ação ainda — só consciência.
   **Anotar se der errado:** se em algum momento o sistema mostrar parceiro **diferente desses dois**, parar imediatamente e reportar (pode ser parceiro real entrou sem aviso).

4. **O que fazer:** decorar mentalmente os contatos teste obrigatórios pra Fase 8:
   - WhatsApp: **27981341348** (celular do Luciano)
   - Email: **lucbragatto+qa1@gmail.com** (substitua `qa1` por `qa2`, `qa3`... a cada nova rodada de QA).

### Critério de sucesso

✅ Backend e WhatsApp service online + frontend carregando + contatos teste decorados.

---

## Fase 1 — Login e acesso

**Pré-requisito:** Fase 0 OK.

**Tempo estimado:** 10 min

### Passos

1. **O que fazer:** acessar `http://localhost:3001` e logar com credenciais SUPER_ADMIN (Luciano).
   **O que deveria acontecer:** redireciona para `/dashboard` com sidebar mostrando seção "Gestão Global" (link "Painel SISGD").
   **Anotar se der errado:** sidebar sem seção "Gestão Global" — papel detectado errado.

2. **O que fazer:** clicar em "Painel SISGD" na sidebar.
   **O que deveria acontecer:** carrega `/dashboard/super-admin` com 5 cards (parceiros, membros, faturado, MRR, alerta inadimplência) + hero "incêndios" no topo.
   **Anotar se der errado:** página em branco, 404, ou cards com valor `NaN` / `undefined`.

3. **O que fazer:** sair (logout) e logar como admin do parceiro CoopereBR (Marcos).
   **O que deveria acontecer:** redireciona para `/dashboard` com sidebar SEM seção "Gestão Global" (multi-tenant — cada parceiro vê só seu próprio escopo).
   **Anotar se der errado:** se aparecer "Painel SISGD" como admin de parceiro = vazamento de papel (bug P0).

4. **O que fazer:** tentar acessar `/dashboard/super-admin` digitando direto na URL do navegador (estando logado como Marcos).
   **O que deveria acontecer:** redireciona pra `/dashboard` ou mostra mensagem "Acesso negado" — **NÃO** deve mostrar dados de super-admin.
   **Anotar se der errado:** página carrega normalmente = falha de autorização (bug P0 SEGURANÇA).

### Critério de sucesso

✅ Login Luciano vê painel SISGD; login Marcos não vê + tentativa direta na URL bloqueada.

---

## Fase 2 — Cadastro de cooperado (COM_UC e SEM_UC separados)

**Pré-requisito:** Fase 1 OK. Logar como Marcos (admin CoopereBR).

**Tempo estimado:** 30-40 min

### Bloco A — Cadastro COM_UC (via wizard padrão)

1. **O que fazer:** ir em `/dashboard/cooperados/novo`.
   **O que deveria acontecer:** wizard de 11 etapas carrega na etapa 0 (Dados Pessoais).
   **Anotar se der errado:** wizard pula etapas, ou tela branca.

2. **O que fazer:** preencher etapas 0-11. **Use sempre** nome fictício + CPF de teste (você sabe quais usar) + email `lucbragatto+coopnovo1@gmail.com` + WhatsApp `27981341348`.
   **O que deveria acontecer:** cada etapa valida campos obrigatórios antes de avançar. Etapa de OCR aceita imagem de fatura e preenche 50+ campos em ~20s.
   **Anotar se der errado:** validações faltando (deixa avançar com campo vazio), OCR não preenche, OCR demora >2min.

3. **O que fazer:** finalizar wizard.
   **O que deveria acontecer:** cooperado criado com status PENDENTE_ATIVACAO + redirect pra `/dashboard/cooperados`. Novo cooperado aparece na lista com badge **"COM_UC"**.
   **Anotar se der errado:** badge errado (mostra SEM_UC), cooperado não aparece, erro 500.

### Bloco B — Cadastro SEM_UC (via UI dedicada — Bloco C 16/05)

1. **O que fazer:** ir em `/dashboard/cooperados/novo-sem-uc`.
   **O que deveria acontecer:** página dedicada (sem wizard) com formulário curto: nome, CPF, email, WhatsApp, escolha de plano CLUBE.
   **Anotar se der errado:** redireciona pro wizard COM_UC, ou página não existe (404).

2. **O que fazer:** preencher e enviar. Use `lucbragatto+semuc1@gmail.com`.
   **O que deveria acontecer:** cooperado criado com **0 UCs, 0 contratos, status ATIVO, modoRemuneracao=CLUBE**. Badge dourado **"SEM_UC"** na listagem.
   **Anotar se der errado:** cria UC vazia (não pode), modo de remuneração errado, badge faltando.

3. **O que fazer:** voltar ao wizard COM_UC `/dashboard/cooperados/novo` e verificar etapa 0.
   **O que deveria acontecer:** ver banner de redirect dizendo "Cooperado sem UC? Use o cadastro SEM_UC".
   **Anotar se der errado:** banner ausente — risco de operador escolher fluxo errado.

### Critério de sucesso

✅ Wizard COM_UC completa 11 etapas + cooperado novo COM_UC aparece + cadastro SEM_UC funciona + badges corretos + banner de redirect visível.

---

## Fase 3 — Unidades consumidoras (UCs)

**Pré-requisito:** Fase 2 OK (cooperado COM_UC criado).

**Tempo estimado:** 20 min

### Passos

1. **O que fazer:** abrir detalhe do cooperado criado na Fase 2.
   **O que deveria acontecer:** ver aba "Unidades Consumidoras" com pelo menos 1 UC anexada (vinda do OCR da fatura).
   **Anotar se der errado:** aba vazia mesmo OCR tendo aceitado fatura.

2. **O que fazer:** verificar campos da UC:
   - `numero` (canônico SISGD, 10 dígitos)
   - `numeroUC` (legado EDP, 9 dígitos)
   - `numeroConcessionariaOriginal` (formato cru da fatura)
   - `distribuidora` (deve estar **preenchido** — não pode ser vazio, é obrigatório desde Sprint 11)
   **O que deveria acontecer:** todos os 4 campos populados; distribuidora = enum (EDP_ES, CEMIG, etc.).
   **Anotar se der errado:** distribuidora vazia, números misturados (`numero` com 9 dígitos), `numeroConcessionariaOriginal` ausente.

3. **O que fazer:** tentar criar UC manual com distribuidora **diferente** da usina vinculada no contrato (se houver).
   **O que deveria acontecer:** sistema **bloqueia** com mensagem ANEEL sobre compatibilidade UC × Usina (regra `validarCompatibilidadeAneel`).
   **Anotar se der errado:** sistema deixa criar — vazamento ANEEL (bug P1).

### Critério de sucesso

✅ UCs com 4 campos preenchidos + distribuidora obrigatória + validação ANEEL bloqueando incompatibilidade.

---

## Fase 4 — Usinas (incluindo HIBRIDO + classeGdAnotada inline)

**Pré-requisito:** logado como Marcos.

**Tempo estimado:** 25 min

### Bloco A — Cadastrar usina nova (Mini-Bloco H'.9 — opção HIBRIDO)

1. **O que fazer:** ir em `/dashboard/usinas/nova`.
   **O que deveria acontecer:** formulário expandido com 11 campos + 2 selects:
   - **`formaAquisicao`**: PROPRIA, ALUGUEL, ARRENDAMENTO, OUTRA
   - **`formaPagamentoDono`**: FIXO, PERCENTUAL, **HIBRIDO** (a opção HIBRIDO é a nova de 17/05)
   **Anotar se der errado:** select sem opção HIBRIDO, ou campos faltando.

2. **O que fazer:** escolher `formaPagamentoDono = HIBRIDO`. Verificar que aparecem **AMBOS** os campos: `valorFixoMensal` (R$/mês) + `percentualRepasse` (%).
   **O que deveria acontecer:** os dois campos ficam visíveis e obrigatórios.
   **Anotar se der errado:** só um campo aparece, ou campos viram opcional.

3. **O que fazer:** preencher tudo válido, incluindo `apelidoInterno` (ex: "testeusina1"). Salvar.
   **O que deveria acontecer:** usina criada + retorna pra lista. `capacidadeKwh` deve aparecer com label **"kWh/mês"** (convenção MENSAL oficial — Decisão 17/05).
   **Anotar se der errado:** label "kWh/ano" ou só "kWh" sem indicação de período — débito D-novo-H ainda pendente em código.

4. **O que fazer:** tentar criar segunda usina com **mesmo `apelidoInterno`**.
   **O que deveria acontecer:** sistema bloqueia (constraint `@unique`).
   **Anotar se der errado:** sistema deixa duplicar = constraint quebrada.

### Bloco B — Editar `classeGdAnotada` inline (Sprint 8 — padrão UX Tipo A)

1. **O que fazer:** ir em `/dashboard/parceiro/alocacao` aba "Estado atual".
   **O que deveria acontecer:** tabela com 1 linha por usina, coluna "Classe GD anotada" mostra select inline (clique pra editar).
   **Anotar se der errado:** coluna é só texto sem permitir edição.

2. **O que fazer:** clicar numa célula de classeGdAnotada e escolher GD_II. Apertar Enter (ou clicar fora).
   **O que deveria acontecer:** valor salva **otimistic** (mostra imediato) + chama API em background + ícone de check breve. Recálculo de cards no topo (concentração %) em tempo real.
   **Anotar se der errado:** abre Dialog de edição (não é inline = padrão errado), valor não persiste, header não recalcula.

3. **O que fazer:** marcar o filtro "Mostrar só usinas sem classe".
   **O que deveria acontecer:** linhas com classe preenchida somem da tabela.
   **Anotar se der errado:** filtro não filtra, ou some todas.

### Critério de sucesso

✅ Cadastro com HIBRIDO + apelidoInterno único + label "kWh/mês" + edição inline classeGdAnotada salva + filtro funciona.

---

## Fase 5 — Contratos e migrações

**Pré-requisito:** cooperado COM_UC + usina + UC compatível.

**Tempo estimado:** 25 min

### Passos

1. **O que fazer:** criar contrato vinculando cooperado da Fase 2 a uma usina compatível (mesma distribuidora). Preencher: planoId, percentualUsina, kwhContratoMensal.
   **O que deveria acontecer:** contrato criado com status PENDENTE_ATIVACAO (porque cooperado ainda não foi homologado).
   **Anotar se der errado:** vai direto pra ATIVO sem passar por PENDENTE — quebra fluxo Listas Concessionária.

2. **O que fazer:** tentar criar contrato com **soma de `kwhContrato` ultrapassando capacidade da usina**.
   **O que deveria acontecer:** sistema bloqueia com mensagem de capacidade excedida.
   **Anotar se der errado:** sistema deixa criar — bug P1.

3. **O que fazer:** acessar tela de migração `/dashboard/migracoes-usina` e simular migrar cooperado de Usina A → Usina B (mesma distribuidora).
   **O que deveria acontecer:** mostra impacto (capacidade liberada em A, ocupada em B). Pede confirmação. Após confirmar, contratos antigos viram TERMINADO e novos PENDENTE_ATIVACAO.
   **Anotar se der errado:** capacidade não recalcula, contratos antigos ficam ATIVO duplicados.

4. **O que fazer:** abrir migração e usar `ajustarKwh` (mudar `kwhContratoMensal` sem trocar de usina).
   **O que deveria acontecer:** mostra novo valor + diff. **Atenção**: label de input deve dizer **"kWh/mês"** (não /ano) — checa convenção MENSAL.
   **Anotar se der errado:** label fala "kWh/ano", ou input divide valor por 12 indevidamente (D-novo-H ainda em código).

### Critério de sucesso

✅ Contrato cria PENDENTE_ATIVACAO + validação capacidade + migração trata vínculos + ajustar kWh respeita MENSAL.

---

## Fase 6 — Dashboard e relatórios

**Pré-requisito:** Fase 5 OK (algum contrato + UC + usina ativos).

**Tempo estimado:** 15 min

### Passos

1. **O que fazer:** logar como Marcos e ir em `/dashboard`.
   **O que deveria acontecer:** ver cards-resumo: total cooperados ATIVOS, cobranças do mês, MRR (receita recorrente mensal), inadimplência.
   **Anotar se der errado:** valores em zero quando você sabe que tem cooperados, ou valores impossíveis (negativos).

2. **O que fazer:** ir em `/dashboard/relatorios`.
   **O que deveria acontecer:** lista de relatórios disponíveis (conferência kWh, fechamento mensal, DRE — se já existir).
   **Anotar se der errado:** página vazia, ou link aponta pra 404.

3. **O que fazer:** logar como Luciano e ir em `/dashboard/super-admin`.
   **O que deveria acontecer:** painel mostra **TODOS os parceiros** (CoopereBR + CoopereBR Teste). MRR consolidado dos dois.
   **Anotar se der errado:** vê só 1 parceiro = bug de agregação SUPER_ADMIN.

### Critério de sucesso

✅ Cards do dashboard refletem realidade do banco + super-admin agrega cross-tenant.

---

## Fase 7 — Financeiro

**Pré-requisito:** Fase 5 OK + cobranças geradas pelo cron mensal (ou geração manual).

**Tempo estimado:** 30 min

> **Quem deve rodar:** Walter (contador externo). Luciano pode acompanhar.

### Passos

1. **O que fazer:** ir em `/dashboard/financeiro/cobrancas`.
   **O que deveria acontecer:** lista de cobranças do mês com colunas: cooperado, valor, status (ABERTA/PAGA/ATRASADA), forma pagamento (PIX/Boleto), vencimento.
   **Anotar se der errado:** valores sem arredondamento (`12.34567`), cobrança sem cooperativaId, lista vazia mesmo com contratos ATIVOS.

2. **O que fazer:** abrir detalhe de uma cobrança.
   **O que deveria acontecer:** valor `valorContrato` deve estar **arredondado a 2 casas** (R$ 123,45 — nunca R$ 123,456789). Linha "Fio B" aparece **se o cooperado está em modelo COMPENSADOS/DINAMICO** (em FIXO_MENSAL pode não aparecer ainda — Sprint 5a vai aplicar).
   **Anotar se der errado:** valor com 4+ casas decimais; linha Fio B mostrando R$ 0,00 indevidamente (deveria ter valor a partir de Sprint 5a).

3. **O que fazer:** ir em `/dashboard/financeiro/lancamentos-caixa` (livro caixa).
   **O que deveria acontecer:** ver lançamentos PREVISTOS e REALIZADOS. Cada cobrança gerada deve ter `LancamentoCaixa PREVISTO` espelhado (D-54 — confirmar não regrediu).
   **Anotar se der errado:** cobrança sem LancamentoCaixa correspondente.

4. **O que fazer:** verificar se DRE / conciliação bancária / fechamento mês têm tela.
   **O que deveria acontecer:** **provavelmente NÃO existem ainda** (gap conhecido — Sprint 7 implementa). Anotar como informativo, não como bug.
   **Anotar se der errado:** se aparecer tela funcional, ótimo (mas verificar se valores fazem sentido).

5. **O que fazer:** abrir cobrança e simular pagamento via PIX/Boleto. **NÃO disparar Asaas real** — só verificar que o link/QR Code gera.
   **O que deveria acontecer:** ver QR Code (PIX) ou linha digitável (Boleto). Webhook Asaas em sandbox deve voltar `RECEIVED` (validado Sprint 12).
   **Anotar se der errado:** QR não gera, link 404.

### Critério de sucesso

✅ Cobranças arredondadas + LancamentoCaixa espelhado + Asaas sandbox funciona + Walter consegue auditar valores.

---

## Fase 8 — Comunicação (SOMENTE com contatos teste)

**Pré-requisito:** Fase 5 OK.

**Tempo estimado:** 20 min

> ⚠️ **ATENÇÃO MÁXIMA — diretriz inegociável catalogada em 14/05/2026:**
>
> Esta fase **dispara comunicação real** (WhatsApp + Email + Asaas). **SOMENTE use:**
> - **WhatsApp:** `27981341348` (celular do Luciano)
> - **Email:** `lucbragatto+qaN@gmail.com` (substitua N pelo número da rodada — `qa1`, `qa2`...)
>
> **NUNCA use contato real de cooperado do banco.** O sistema tem **3 camadas de proteção** (defense in depth aplicada em 18/05 após bug D-novo-N), mas a regra é INEGOCIÁVEL: contato real só em produção real, com cooperado real homologado.
>
> Se você é admin de parceiro e tem dúvida, **pare e pergunte ao Luciano antes de prosseguir.**

### Passos

1. **O que fazer:** disparar notificação manual pra cooperado teste (criado nas Fases 2-5). Pode ser via tela de cobrança "Enviar lembrete" ou similar.
   **O que deveria acontecer:** WhatsApp chega em `27981341348` + email chega em `lucbragatto+qaN@gmail.com`. **Não em contato banco do cooperado fictício.**
   **Anotar se der errado:** comunicação chega em contato banco — bug P0 SEGURANÇA/LGPD (regra contatos teste violada — repetir incidente D-novo-N).

2. **O que fazer:** verificar logs do envio em `email_logs` (via tela de auditoria ou ferramenta admin).
   **O que deveria acontecer:** entry com `status=ENVIADO` + destinatário = `lucbragatto+qaN@gmail.com` (override aplicado).
   **Anotar se der errado:** destinatário no log mostra contato banco — override falhou em alguma das 3 camadas.

3. **O que fazer:** testar trigger automático "cooperado homologado" (Fase 4 Sub-Fase 1 — M12). Marcar cooperado como HOMOLOGADO numa lista enviada à concessionária.
   **O que deveria acontecer:** WhatsApp + email automáticos chegam em contatos override (não banco).
   **Anotar se der errado:** se chegar em contato banco = repetiu o bug crítico D-novo-N. Parar QA imediatamente, reportar Luciano.

### Critério de sucesso

✅ Toda comunicação real chega EXCLUSIVAMENTE nos contatos override + logs confirmam destinatário override + zero disparos pra banco.

---

## Fase 9 — Cooper Token, indicações, convênios

**Pré-requisito:** Fase 2 OK.

**Tempo estimado:** 30 min

### Bloco A — Cooper Token

1. **O que fazer:** ir em `/dashboard/cooper-token` ou no portal do cooperado `/portal/coopertoken`.
   **O que deveria acontecer:** ver saldo de tokens do cooperado + histórico de movimentações (ledger).
   **Anotar se der errado:** saldo ausente, ledger vazio mesmo com cooperado em plano CLUBE.

2. **O que fazer:** simular bonificação (se houver tela de admin pra isso).
   **O que deveria acontecer:** tokens entram no saldo + entrada no ledger com `tipo=BONIFICACAO`.
   **Anotar se der errado:** saldo dobra (dupla bonificação CLUBE — bug já corrigido Sprint 12, conferir não voltou).

### Bloco B — Indicações (MLM)

1. **O que fazer:** abrir cooperado AGREGADOR (se houver) ou simular cooperado com `indicadorId` preenchido.
   **O que deveria acontecer:** ver tela de indicações com cascata (quem indicou quem).
   **Anotar se der errado:** cooperado sem indicador mas aparece em rede; ou cascata quebrada.

2. **O que fazer:** verificar bônus pendente quando indicado paga 1ª fatura.
   **O que deveria acontecer:** bônus calculado e entra no saldo do indicador.
   **Anotar se der errado:** bônus zerado ou duplicado.

### Bloco C — Convênios

1. **O que fazer:** ir em `/dashboard/convenios`.
   **O que deveria acontecer:** lista de convênios (ContratoConvenio). **Provavelmente vazia** (0 registros em produção, gap conhecido).
   **Anotar se der errado:** se aparecer convênio surpresa = parceiro real entrou sem aviso.

### Critério de sucesso

✅ Cooper Token saldo + ledger consistentes + indicações sem cascata quebrada + convênios coerentes com banco.

---

## Fase 10 — Auditoria e segurança

**Pré-requisito:** logado como Luciano (SUPER_ADMIN).

**Tempo estimado:** 25 min

### Bloco A — AuditLog (registro automático de cada ação importante — pra rastreabilidade)

1. **O que fazer:** fazer 3 ações que devem gerar registro: (a) criar cooperado, (b) aprovar fatura, (c) marcar cooperado como HOMOLOGADO em lista concessionária.
   **O que deveria acontecer:** cada ação gera entry em `audit_log` (acessível via Prisma Studio ou tela de admin se houver).
   **Anotar se der errado:** ações sensíveis sem registro = D-30N parcial. **Caso QA detecte rota crítica de mutação SEM registro, anotar como bug P1.**

> ℹ️ **Estado conhecido em 18/05:** AuditLog cobre **18 endpoints sensíveis** (Fase 2F) + **7 rotas envio-lista** (Bug #4 M11). Se rota nova entrou (ex: Sprint 8 alocação) sem `@AuditLog`, é gap real.

### Bloco B — Multi-tenant (cada parceiro vê só os dados dele)

1. **O que fazer:** logar como admin do parceiro **CoopereBR**. Anotar o ID de um cooperado do **CoopereBR Teste** (você pode pegar via Luciano logado como super-admin).

2. **O que fazer:** ainda logado como CoopereBR (Marcos), tentar acessar `/dashboard/cooperados/<ID-do-CoopereBR-Teste>` digitando direto na URL.
   **O que deveria acontecer:** página retorna **404 (não encontrado)** — NÃO deve retornar 403 (forbidden) nem mostrar dados.
   **Anotar se der errado:** mostra dados = vazamento cross-tenant (bug P0 SEGURANÇA — repetir IDOR já resolvido em Fases 2A-2E).

3. **O que fazer:** repetir teste com outras entidades: contrato, fatura, cobrança (cada uma tem rotas próprias).
   **O que deveria acontecer:** todas retornam 404 quando ID pertence a outro tenant.
   **Anotar se der errado:** qualquer rota mostrar dados = bug P0.

### Bloco C — Headers HTTP de segurança

1. **O que fazer:** abrir DevTools do navegador → aba Network → recarregar página → clicar em qualquer requisição → ver "Response Headers".
   **O que deveria acontecer:** ver **6 headers**: `Helmet` defaults + `Strict-Transport-Security` (HSTS) + `Content-Security-Policy` (CSP).
   **Anotar se der errado:** headers ausentes = regressão Fase 2G.

### Critério de sucesso

✅ AuditLog cobre ações sensíveis + cross-tenant retorna 404 (não dados) + 6 headers seguros presentes.

---

## Fase 11 — Listas Concessionária (fluxo 9 estados — Sub-Fase 1 entregue M13)

**Pré-requisito:** cooperados COM_UC + contratos PENDENTE_ATIVACAO.

**Tempo estimado:** 40 min

> ℹ️ **Fluxo COMPLETO entregue em 18/05** (M10 + M12 + M13). 9 estados sequenciais. Cada transição muda **badge de cor** na lista.

### Estados (sequência)

```
RASCUNHO → VALIDADA → PRONTA_PARA_ENVIO → ENVIADA → PROTOCOLADA →
HOMOLOGADO_PARCIAL ou HOMOLOGADO_TOTAL (terminais positivos)
ou REJEITADA / CANCELADA (terminais negativos)
```

### Passos

1. **O que fazer:** ir em `/dashboard/usinas/listas` aba "Visão geral".
   **O que deveria acontecer:** tabela de usinas com botão "Gerar lista" + métricas (cooperados elegíveis, em lista atual).
   **Anotar se der errado:** botão ausente, ou tabela vazia mesmo com usinas cadastradas.

2. **O que fazer:** clicar "Gerar lista" pra uma usina. Vai pra `/dashboard/listas-concessionaria/novo?usinaId=X`.
   **O que deveria acontecer:** página dedicada (padrão UX Tipo B) mostra lista de cooperados elegíveis + filtros + botão "Criar envio".
   **Anotar se der errado:** abre Dialog apertado em vez de página dedicada (regressão padrão UX).

3. **O que fazer:** criar envio. **Badge = RASCUNHO** (cinza).
   **O que deveria acontecer:** novo envio em `/dashboard/listas-concessionaria/[id]` com timeline mostrando estado atual.
   **Anotar se der errado:** badge errado, timeline ausente.

4. **O que fazer:** transição 1 — clicar "Validar". Dialog pede confirmação.
   **O que deveria acontecer:** badge muda RASCUNHO → **VALIDADA** (amarelo). AuditLog gera entry.
   **Anotar se der errado:** badge não muda, ou transição permite voltar pra trás (não é permitido).

5. **O que fazer:** transição 2 — "Marcar pronta para envio". Badge → **PRONTA_PARA_ENVIO** (azul claro).

6. **O que fazer:** transição 3 — "Marcar enviado" (operacional Marcos envia manualmente CSV/PDF pra EDP via email/portal). Dialog pede data de envio. Badge → **ENVIADA** (azul).

7. **O que fazer:** transição 4 — "Registrar protocolo" (EDP devolveu número de protocolo). Dialog pede protocolo + data. Badge → **PROTOCOLADA** (roxo).

8. **O que fazer:** transição 5 — "Registrar homologação". Dialog mostra **lista de cooperados** com checkbox por cooperado (HOMOLOGADO / REJEITADO individual).
   **O que deveria acontecer:**
   - Marcar **todos** HOMOLOGADO → badge agrega **HOMOLOGADO_TOTAL** (verde).
   - Marcar **alguns** HOMOLOGADO + outros REJEITADO → badge agrega **HOMOLOGADO_PARCIAL** (verde claro).
   - **Para cada cooperado HOMOLOGADO**: trigger ativa contrato (PENDENTE_ATIVACAO → ATIVO + `dataAtivacao=now()`) + dispara WhatsApp + email automáticos.
   **Anotar se der errado:**
   - Contrato fica PENDENTE_ATIVACAO mesmo após homologação = trigger quebrado.
   - WhatsApp/email chega em contato banco = falha 3 camadas D-novo-N (bug P0).

9. **O que fazer:** verificar `Contrato.dataAtivacao` no detalhe do cooperado homologado.
   **O que deveria acontecer:** preenchido com data/hora da homologação.
   **Anotar se der errado:** `null` mesmo com contrato ATIVO.

### Critério de sucesso

✅ Todos os 5-7 transições funcionam + badge muda visualmente + AuditLog gerado + trigger ativação dispara contrato + comunicação automática chega em contatos override.

---

## Fase 12 — Realocação Multi-Usina (Sprint 8 / Bloco E entregue M14)

**Pré-requisito:** Fase 4 OK + classeGdAnotada populada em pelo menos 3 usinas.

**Tempo estimado:** 35 min

> ℹ️ **Sprint 8 entregue 18/05.** 3 abas + tela detalhe + cron mensal dia 5 03:00 BRT. Modo padrão = **Sugestão** (admin aprova caso-a-caso, Automático OFF — decisão C.1).

### Bloco A — Aba "Estado atual"

1. **O que fazer:** ir em `/dashboard/parceiro/alocacao` aba "Estado atual".
   **O que deveria acontecer:** tabela com 1 linha por usina + colunas: nome, capacidade (kWh/mês), ocupado, % concentração, distribuidora, classeGdAnotada (inline editável Tipo A).
   **Anotar se der errado:** coluna kWh sem indicação `/mês`, classeGdAnotada não editável inline.

2. **O que fazer:** clicar "Simular realocação" no header.
   **O que deveria acontecer:** dispara engine greedy + busca local → cria `AlocacaoOtima` com status `SIMULADA`. Redireciona pra detalhe ou notifica.
   **Anotar se der errado:** botão sem resposta, ou cria duplicado em clique repetido.

### Bloco B — Aba "Sugestões"

1. **O que fazer:** ir na aba "Sugestões".
   **O que deveria acontecer:** lista de `AlocacaoOtima` com filtro por status (SIMULADA / APROVADA / DESCARTADA / EXPIRADA).
   **Anotar se der errado:** filtro não filtra, ou lista vazia mesmo após Bloco A clicar Simular.

2. **O que fazer:** abrir detalhe de uma sugestão (`/dashboard/parceiro/alocacao/[id]`).
   **O que deveria acontecer:** tela detalhe Tipo B com:
   - Resumo da simulação (X realocações sugeridas, economia proxy projetada)
   - Lista de realocações com **checkbox por linha**
   - Botões "Aprovar selecionadas", "Aprovar todas", "Descartar"
   - Cada realocação mostra: cooperado, usina origem → usina destino, motivo (regra violada ou otimização)
   **Anotar se der errado:** checkbox ausente, descrição confusa do motivo, botão "Aprovar parcial" sem confirmar.

3. **O que fazer:** marcar 1-2 realocações + clicar "Aprovar selecionadas". AlertDialog pede confirmação.
   **O que deveria acontecer:** ao confirmar, realocações selecionadas são aplicadas (contratos migrados); restantes da mesma `AlocacaoOtima` mudam pra `APROVADA_PARCIAL` ou `DESCARTADA` conforme regra.
   **Anotar se der errado:** aplicação não persiste, ou aplica TODAS mesmo selecionando 2.

4. **O que fazer:** verificar que **4 validadores** funcionaram (catalogados M14):
   - Concentração ≤ 25% (D-30A)
   - Distribuidora compatível ANEEL (mesma da UC)
   - `classeGdAplicada` × `classeGdAnotada` (D-30B — bloqueia se ambos populados e diferentes; warning se um null)
   - Estabilidade 90 dias (cooperado migrado <90d não migra de novo)
   **O que deveria acontecer:** cada validador aparece no log do detalhe, com OK ✅ ou bloqueio ⚠️.
   **Anotar se der errado:** validador ausente, ou sugestão aplica mesmo com violação.

### Bloco C — Aba "Políticas"

1. **O que fazer:** ir na aba "Políticas".
   **O que deveria acontecer:** ver **3 políticas padrão SISGD** (Pequenos GD_II / Médios qualquer / Grandes GD_I — decisão C.6) + botão "Nova política".
   **Anotar se der errado:** menos de 3 políticas, ou padrões diferentes do catalogado.

2. **O que fazer:** clicar "Nova política". Dialog Tipo C (foco em ação).
   **O que deveria acontecer:** form pede faixa kWh (de/até), classe GD preferencial, distribuidora opcional, prioridade. Validação não permite faixas sobrepostas.
   **Anotar se der errado:** sobreposição de faixas permitida.

### Bloco D — Cron mensal (não testável visualmente — só por log)

1. **O que fazer:** ir nos logs PM2 (`pm2 logs cooperebr-backend --lines 200`) e procurar entry com `AlocacaoJob`.
   **O que deveria acontecer:** ver que cron está agendado pra `0 3 5 * *` (dia 5 do mês, 03:00 BRT). Última execução visível se já rodou.
   **Anotar se der errado:** cron ausente do agendador, ou último run com erro stack trace.

### Critério de sucesso

✅ 3 abas funcionam + simulação cria AlocacaoOtima + aprovação caso-a-caso aplica só selecionadas + 4 validadores ativos + 3 políticas padrão + cron agendado.

---

## Fase 13 — Regras inegociáveis catalogadas

**Pré-requisito:** Fases 0-12 rodadas (ou ao menos parcialmente).

**Tempo estimado:** 20 min

> ℹ️ **7 regras catalogadas em memória persistente.** Auditoria visual: você consegue **ver evidência** de que cada regra foi seguida nas últimas sessões.

### Auditoria por regra

#### Regra 1 — Contatos teste impreterível (14/05/2026)

**Como auditar:** voltar nos logs de `email_logs` da Fase 8 e confirmar que TODOS os disparos foram pra `lucbragatto+qaN@gmail.com` (override aplicado), nenhum pra contato banco.
**Onde está catalogada:** `~/.claude/projects/C--Users-Luciano-cooperebr/memory/regra_contato_teste_impreterivel.md`
**Status esperado:** ✅ se Fase 8 passou. ❌ se algum disparo vazou.

#### Regra 2 — Fechamento de sessão inegociável bilateral (13/05/2026)

**Como auditar:** listar arquivos em `docs/sessoes/` ordenados por data. **A última sessão Code precisa ter entry `docs/sessoes/YYYY-MM-DD-*.md`** correspondente.
**Onde está catalogada:** `regra_fechamento_sessao_inegociavel.md`
**Status esperado:** ✅ se o último commit em `git log` é `docs(sessao): fechamento ...`. Se há commits após o fechamento sem nova entry = ❌.

#### Regra 3 — Validação prévia (Decisão 23) e Fase 1 read-only obrigatória

**Como auditar:** abrir doc da última sessão (`docs/sessoes/`) e procurar evidência de **Fase 1 read-only** antes de qualquer Fase 2 mutação. Texto deve falar em "investigação read-only", "grep amplo", "SQL", "leitura completa", etc.
**Onde está catalogada:** `regra_validacao_previa_e_retomada.md` + `feedback_fase1_readonly_obrigatoria.md`
**Status esperado:** ✅ se sessão tem narrativa de Fase 1. ❌ se Code foi direto pra implementação.

#### Regra 4 — Não trabalhar paralelo com Code (17/05/2026)

**Como auditar:** rodar `git status --short`. Se aparecer arquivos `M` (modificados) que **não foram criados pela sessão Code atual**, é violação.
**Onde está catalogada:** `regra_nao_trabalhar_paralelo_com_code_17_05.md`
**Status esperado:** ✅ se working tree só tem `??` (untracked) catalogados. ❌ se tem `M` órfão.

#### Regra 5 — Convenção MENSAL oficial (17/05/2026)

**Como auditar:** abrir tela `/dashboard/usinas/<id>` (qualquer usina). Label de `capacidadeKwh` deve dizer **"kWh/mês"**. Em `ajustarKwh` (Fase 5), label de input também.
**Onde está catalogada:** `decisao_convencao_mensal_oficial_17_05.md`
**Status esperado:** ✅ se label mostra `/mês`. ❌ se mostra `/ano` ou só `kWh` sem indicação.

#### Regra 6 — Frase de retomada única (Decisão 24 — 13/05/2026)

**Como auditar:** abrir `docs/CONTROLE-EXECUCAO.md` e fazer busca por "FRASE DE RETOMADA". Deve aparecer **apenas UMA seção** com esse título (não duas).
**Onde está catalogada:** `decisao_24_frase_retomada_unica.md`
**Status esperado:** ✅ se busca acha 1 ocorrência. ❌ se acha 2+ (duplicação histórica).

#### Regra 7 — Decisão 23 aplicada na sessão (validação prévia rigorosa)

**Como auditar:** abrir última sessão e procurar evidência de "Decisão 23 aplicada", "pausa antes de fix", "Luciano confirmou antes de prosseguir".
**Onde está catalogada:** `regra_validacao_previa_e_retomada.md`
**Status esperado:** ✅ se sessão menciona pausa explícita antes de mutação crítica. ❌ se Code aplicou fix direto sem pausa.

### Bonus — Diretrizes inegociáveis técnicas (18/05/2026)

Verificar via grep no código (ou pedir ao Code rodar):
- **NUNCA `NODE_ENV` pra discriminar dev/prod** — buscar `NODE_ENV !==` em arquivos de listener/service. Esperado: 0 ocorrências (tudo migrado pra `isAmbienteReal()`).
- **3 camadas defense in depth** em todo listener/service de comunicação real — buscar `isAmbienteReal`, `cooperado.ambienteTeste`, `ehEmailFake`/`ehTelefoneFake` em arquivos `*-listener.ts` + `email.service.ts` + `whatsapp-sender.service.ts`. Esperado: as 3 camadas presentes em cada.

### Critério de sucesso

✅ Todas as 7 regras com evidência observável + diretrizes técnicas 18/05 confirmadas via grep.

---

## Modelo de registro de bug

Pra cada bug encontrado durante este checklist, criar **uma entry** no formato abaixo. Use uma planilha, doc separado ou commit num arquivo `docs/qa-bugs/BUG-AAAA-MM-DD.md`.

| Campo | Conteúdo |
|---|---|
| **Código** | `BUG-2026-MM-DD-###` (auto-incrementado por dia) |
| **Fase** | 0-13 |
| **Tela** | URL completa ou nome da tela (ex: `/dashboard/parceiro/alocacao` aba "Sugestões") |
| **Passos pra reproduzir** | Lista numerada — 1, 2, 3... |
| **O que era esperado** | 1 linha clara |
| **O que aconteceu** | 1 linha clara + evidência observada |
| **Gravidade** | `P0` (bloqueia produção) / `P1` (urgente, próxima sprint) / `P2` (sprint próximo) / `P3` (backlog) |
| **Evidência** | Screenshot + log + URL específica + texto da mensagem de erro |
| **Status** | `ABERTO` / `EM_CORREÇÃO` / `RESOLVIDO` / `DESCARTADO` |

### Exemplo preenchido

| Campo | Conteúdo |
|---|---|
| **Código** | `BUG-2026-05-19-001` |
| **Fase** | 4 (Usinas) |
| **Tela** | `/dashboard/usinas/nova` |
| **Passos pra reproduzir** | 1. Logar como Marcos. 2. Ir em /dashboard/usinas/nova. 3. Escolher `formaPagamentoDono = HIBRIDO`. |
| **O que era esperado** | Aparecer AMBOS os campos `valorFixoMensal` + `percentualRepasse`. |
| **O que aconteceu** | Só `valorFixoMensal` apareceu; `percentualRepasse` ficou escondido. |
| **Gravidade** | P1 |
| **Evidência** | Screenshot anexado + URL = `localhost:3001/dashboard/usinas/nova` + DevTools Console sem erro. |
| **Status** | ABERTO |

---

## Como reportar bug encontrado

Depois de fechar uma rodada de QA com `N` bugs encontrados:

1. **Consolidar** todos os bugs em arquivo único `docs/qa-bugs/BUGS-AAAA-MM-DD.md` (ou planilha).
2. **Priorizar** por gravidade: P0 → P1 → P2 → P3.
3. **Reportar pro Luciano** (no Claude Code com prompt tipo: *"Encontrei 5 bugs no QA de 19/05. Lista em docs/qa-bugs/BUGS-2026-05-19.md. Quer que eu invoque o subagent qa-funcional pra confirmar reprodutibilidade, ou abre Sprint Bug Fix direto?"*).
4. **Aguardar decisão Luciano** se vira sprint dedicado, fix incremental ou catalogar como débito.
5. **NUNCA implementar correção direto** sem OK explícito (regra Decisão 23).

---

## Próxima etapa sugerida

Após **Sprint 5a Neutro Fio B** (M15) fechar, rodar:

1. **Fase 7 Financeiro PRIMEIRO** — Sprint 5a vai mexer em cálculo de Fio B em cobranças (linha nova, percentual progressivo 60%/75%/90%/100% por ano). Validar visual antes de qualquer outra coisa.
2. **Fase 12 Realocação Multi-Usina LOGO DEPOIS** — Sprint 5a vai substituir o **custo proxy** do Engine de Otimização Sprint 8 por **R$ real**. Sugestões podem mudar drasticamente. Validar que sugestões fazem sentido financeiro.
3. **Fases 8 + 11** — confirmar que comunicação automática pós-homologação continua funcionando (regressão D-novo-N).

**Antes de onboarding Sinergia (próximo parceiro real):**
- Rodar **TODAS as 14 fases** (0-13) — não pular nenhuma.
- Atenção máxima em **Fase 10 Bloco B (multi-tenant)** — Sinergia é o primeiro parceiro real cross-tenant. Vazamento = incidente crítico LGPD.
- Aplicar `regra_contato_teste_impreterivel` reforçada em Fase 8 (cooperados de Sinergia são pessoas reais — zero erro tolerado).

---

## Histórico de revisões

| Data | Versão | Mudança | Origem |
|---|---|---|---|
| 2026-05-19 | v1.0 | Criação inicial — 13 fases + modelo bug + próxima etapa | Sugestão Codex (OpenAI) refinada pela claude.ai (5 melhorias) + execução Code 19/05 |

---

**Documento complementar ao subagent automatizado** `~/.claude/agents/cooperebr-qa-funcional.md` — manual humano × automatizado.
