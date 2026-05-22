# Fase 1 read-only — Sprint Bot Autoatendimento Bloco 4 (Atualizar Cadastro)

Data: 22/05/2026
Autor: Code (Fase 1 read-only, Decisão 23)
Status: relatório de investigação — **nenhum arquivo editado, nenhuma migração rodada, nenhum build, nenhum dado tocado**

---

## TL;DR (linguagem humana)

A boa notícia: o esqueleto do "Atualizar Cadastro" **já existe inteiro** no bot
**hardcoded** (`whatsapp-bot.service.ts`). Os 4 modelos de pergunta já estão no
banco desde o Bloco 2 (commit `1097f72`). O fluxo no seed já cabeia os 4
gatilhos certos.

A má notícia: o **motor dinâmico** (que é o que estamos transformando em fonte
única) NÃO consegue, do jeito que está hoje, executar uma ação que LÊ o texto
digitado pelo cooperado. As ações de hoje (Bloco 3) só rodam quando o cooperado
entra numa etapa — não conseguem capturar a resposta livre dele. Pra fazer
"Atualizar Cadastro" pelo motor dinâmico, vamos precisar de UMA mudança
arquitetural no motor: passar a processar o campo `Gatilho.acao` (que já existe
no schema mas é ignorado hoje) E passar o texto digitado pra ação executar.

Há também **3 decisões de produto** que precisam do seu OK antes da Fase 2 —
em especial uma sobre **trocar o telefone** que tem risco real de quebrar a
próxima conversa do cooperado com o bot.

**Estimativa revisada: 10-14h Code** (era 6-8h no plano original — aumento
justificado pelas mudanças arquiteturais no motor + tratamento P2002 + ViaCEP
backend opcional + ~15 specs novos).

---

## 1. ESTADO ATUAL DA OPÇÃO "ATUALIZAR CADASTRO"

### 1.1 Fluxo do bot (`backend/prisma/seeds/seed-fluxos-bot.mjs:88-96`)

```js
// Atualização de dados
{ id: 'f-atualizar-cadastro', nome: 'Atualizar Cadastro', ordem: 18,
  estado: 'ATUALIZACAO_CADASTRO', gatilhos: [
    { resposta: '1', proximoEstado: 'AGUARDANDO_NOVO_NOME' },
    { resposta: '2', proximoEstado: 'AGUARDANDO_NOVO_EMAIL' },
    { resposta: '3', proximoEstado: 'AGUARDANDO_NOVO_TELEFONE' },
    { resposta: '4', proximoEstado: 'AGUARDANDO_NOVO_CEP' },
]},
```

- Etapa `ATUALIZACAO_CADASTRO` JÁ existe no seed (ordem 18)
- 4 gatilhos cabeados corretamente (confirmou a pergunta da frase comandante:
  **3 = telefone**, **4 = CEP**)
- ⚠️ **As etapas-destino `AGUARDANDO_NOVO_*` NÃO estão definidas no seed**.
  Apenas os gatilhos apontam pra elas. No banco DEV elas provavelmente também
  não existem como FluxoEtapa ativa (precisa criar no Bloco 4).

### 1.2 Bot hardcoded (`whatsapp-bot.service.ts`)

O hardcoded JÁ tem TUDO funcionando:

- **Roteamento** (linhas 811-826): cooperado digita "3" no menu principal →
  bot envia menu de botões "Nome / Email / Telefone / Endereço (CEP)" via
  `enviarMenuComBotoes` e muda estado pra `ATUALIZACAO_CADASTRO`.

- **Despachante `handleAtualizacaoCadastro`** (linha 3752): captura a sub-opção
  e transiciona pra `AGUARDANDO_NOVO_NOME/EMAIL/TELEFONE/CEP` + envia pergunta
  hardcoded ("Digite seu novo nome completo:").

- **4 handlers concretos** (linhas 3793-3852): cada um valida o input e chama
  `prisma.cooperado.update` direto:

| Handler | Validação | Update |
|---|---|---|
| `handleAguardandoNovoNome` | `length < 3` → erro | `data: { nomeCompleto }` |
| `handleAguardandoNovoEmail` | regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | `data: { email }` |
| `handleAguardandoNovoTelefone` | só dígitos, `10 ≤ length ≤ 13` | `data: { telefone }` |
| `handleAguardandoNovoCep` | só dígitos, `length === 8` | `data: { cep }` (só o CEP, sem logradouro/bairro/cidade) |

⚠️ **Risco de segurança no hardcoded de hoje:** `prisma.cooperado.update({
where: { id: conversa.cooperadoId }, data: ... })` — **NÃO filtra por
cooperativaId**. Defense in depth ausente. Não é IDOR exploitável pelo
cooperado (cooperadoId vem da própria sessão dele), mas é débito de hardening.
Não vou catalogar isso como débito separado — o Bloco 4 ao migrar pro motor
dinâmico já corrige (padrão Bloco 3 com cooperativaId).

### 1.3 Motor dinâmico (`whatsapp-fluxo-motor.service.ts:321-358`)

```typescript
private async executarAcao(acao: string, conversa: {...}, _dados: any) {
  switch (acao) {
    case 'CRIAR_LEAD':            // só log (placeholder)
    case 'GERAR_PROPOSTA':        // só log (placeholder)
    case 'NOTIFICAR_EQUIPE':      // só log (placeholder)
    case 'ENVIAR_LINK_INDICACAO': // R5 (20/05)
    case 'CONSULTAR_SALDO_CREDITOS': // Bloco 3 (21/05)
    case 'CONSULTAR_PROXIMA_FATURA': // Bloco 3 (21/05)
    default:                       // logger.warn "Acao desconhecida"
  }
}
```

- **ZERO ações ATUALIZAR_***. Confirmado o gap.
- O 3º parâmetro é `_dados: any` (underscore = "não usado"). Em
  `processarComFluxoDinamico` (linhas 120, 232) o motor passa
  `conversa.dadosTemp` — o campo Json da `ConversaWhatsapp` que carrega
  estado temporário do fluxo. **O motor NÃO passa o texto digitado pelo
  cooperado pra ação.**

---

## 2. LÓGICA DE ATUALIZAÇÃO DE COOPERADO QUE JÁ EXISTE

### 2.1 `atualizarMeuPerfil(usuario, dto)` — `cooperados.service.ts:211`

```typescript
async atualizarMeuPerfil(usuario: { id, email, cpf? }, dto: any) {
  const cooperado = await this.findCooperadoByUsuario(usuario); // busca por email OR cpf
  const dadosPermitidos: any = {};
  if (dto.nomeCompleto) dadosPermitidos.nomeCompleto = dto.nomeCompleto;
  if (dto.email)        dadosPermitidos.email = dto.email;
  if (dto.telefone)     dadosPermitidos.telefone = dto.telefone;
  return this.prisma.cooperado.update({ where: { id: cooperado.id }, data: dadosPermitidos });
}
```

- Usado pelo portal/auto-atendimento web (cooperado logado via JWT).
- **Apenas 3 campos:** nomeCompleto / email / telefone. **NÃO inclui CEP/endereço.**
- Identifica via `usuario.email/cpf` (JWT). **Sem cooperativaId** —
  identificação por unique constraint global.
- **O bot NÃO pode chamar isto diretamente** — exige `usuario.email/cpf` do
  JWT, que o cooperado não digita no WhatsApp.

### 2.2 `update(id, data, cooperativaId?)` — `cooperados.service.ts:668`

```typescript
async update(id: string, data: Partial<{
  nomeCompleto, email, telefone, status, ..., 
  cep, logradouro, numero, complemento, bairro, cidade, estado, // ENDEREÇO INCLUÍDO
  ...
}>, cooperativaId?: string) {
  // Fix IDOR Fase 2I: bloqueia cross-tenant quando cooperativaId vem do JWT
  const anterior = await this.prisma.cooperado.findFirst({
    where: cooperativaId ? { id, cooperativaId } : { id },
    select: { status, ambienteTeste },
  });
  if (!anterior) throw new NotFoundException(...);
  // ... guard ATIVO+UC (não relevante pro Bloco 4)
  return this.prisma.cooperado.update({ where: { id }, data: prismaData });
}
```

- Método admin com **26 campos editáveis** (incluindo CEP/endereço).
- **Já tem fix IDOR multi-tenant** — quando `cooperativaId` é passado, filtra.
- Tem guard de ativação (status=ATIVO precisa UC com numeroUC) — **não dispara
  pelos nossos updates** (não vamos mexer em status).
- Ativação em cascata de contratos — **não dispara** pelos nossos updates.
- **Recomendação:** o motor do Bloco 4 deve chamar este método (ou usar
  `prisma.cooperado.update` direto seguindo o padrão Bloco 3 com cooperativaId
  defense in depth). Considerando que o `update` carrega lógica admin
  específica (guard ATIVO+UC, cascata), recomendo `prisma.cooperado.update`
  direto no motor — mesma decisão dos Blocos 3.

### 2.3 `UpdateCooperadoDto` — `dto/update-cooperado.dto.ts`

```typescript
@IsOptional() @IsString()   nomeCompleto?
@IsOptional() @IsEmail()    email?
@IsOptional() @IsString()   telefone?
@IsOptional() @IsEnum(...)  status?
... (mais 14 campos)
```

- **NÃO inclui** `cep / logradouro / numero / complemento / bairro / cidade /
  estado`. O DTO admin (do PATCH `/cooperados/:id`) **não aceita endereço**
  via REST, embora o `update()` service aceite.
- **Débito latente** (não vou catalogar separadamente — não bloqueia Bloco 4).
- Pro Bloco 4 NÃO usaremos esse DTO (motor não passa por controller).

---

## 3. TRAVAS E VALIDAÇÕES DOS CAMPOS

### 3.1 Email — unique constraint GLOBAL

```prisma
model Cooperado {
  email String @unique
  ...
}
```

- **Constraint é GLOBAL**, não por tenant. Se cooperado A da CoopereBR tentar
  usar email de cooperado B da Sinergia, Prisma lança `P2002`.
- Hoje o hardcoded **NÃO trata** esse erro — chama `prisma.update` direto. A
  exceção sobe e cai no catch genérico do `processarMensagem` (linha 607-609)
  que envia mensagem de erro técnica. UX horrível.
- **Decisão de produto (a):** ver §6 abaixo.

### 3.2 CEP / Endereço — sem ViaCEP no backend

- **Backend NÃO tem integração ViaCEP.** Único hit em
  `faturas.service.ts` é palavra "cep" em contexto não relacionado.
- **Frontend tem ViaCEP** em 4 lugares (todos via `fetch` direto):
  - `web/app/cadastro/page.tsx`
  - `web/app/dashboard/cooperados/[id]/page.tsx:2042` — `fetch('https://viacep.com.br/ws/${raw}/json/')` + população dos campos
  - `web/app/dashboard/parceiros/configurar/steps/Step1Empresa.tsx`
  - `web/app/dashboard/parceiros/novo/steps/Step1Dados.tsx`
- Hardcoded do bot **só salva o CEP digitado** (`data: { cep: novoCep }`) — não
  popula logradouro/bairro/cidade/estado.
- **Decisão de produto (b):** ver §6 abaixo.

### 3.3 Telefone — RISCO CRÍTICO (item 3 do prompt)

**O telefone DA SESSÃO do WhatsApp É a chave de identificação:**

```prisma
model ConversaWhatsapp {
  telefone      String @unique  // chave primária da sessão
  cooperadoId   String?         // populado em outro momento via match
  cooperativaId String?
  ...
}
model Cooperado {
  telefone String?  // SEM unique
  ...
}
```

**O que acontece se cooperado pedir pra trocar o telefone:**

1. ✅ **Sessão atual não quebra** — `msg.telefone` vem do header do WhatsApp,
   não do banco. O cooperado continua falando com o bot até o fim do fluxo.

2. ❌ **PRÓXIMA SESSÃO QUEBRA.** Quando ele mandar a próxima mensagem do mesmo
   WhatsApp (número antigo), o motor vai resolver `conversa.cooperadoId` por
   match telefone (busca em algum lugar). Se `Cooperado.telefone` agora é o
   número NOVO, o match falha → bot trata o cooperado como **lead novo
   anônimo**. Ele perdeu o reconhecimento.

3. ❌ **Notificações automáticas vão pro número errado.** Cobranças, lembretes,
   NPS, follow-ups — tudo dispara pra `Cooperado.telefone` (novo). O cooperado
   continua olhando o WhatsApp antigo e recebe nada. Vira "fantasma operacional".

4. ❌ **`ConversaWhatsapp` antiga fica órfã.** Tem `cooperadoId` certo mas
   ninguém mais ativa essa sessão.

**Recomendação técnica forte:** **REMOVER a opção "3 Telefone" do menu do bot.**
Manter a opção só no portal (web) ou no admin, onde é uma operação consciente
com confirmação visual e o cooperado tem chance de entender o impacto. Se você
quiser MANTER a opção, ver decisão (c) em §6.

### 3.4 Identificação cooperado/tenant na sessão (Área 4 do prompt)

O motor recebe na conversa:

```typescript
conversa: {
  id: string,
  telefone: string,
  estado: string,
  cooperadoId?: string | null,
  cooperativaId?: string | null,
  dadosTemp?: any,
}
```

Os campos `cooperadoId` e `cooperativaId` são POPULADOS em outro service
(provavelmente `whatsapp.service.ts` no momento que recebe a mensagem, fazendo
match `Cooperado.telefone = msg.telefone` + lendo `Cooperado.cooperativaId`).
**Não preciso confirmar o lugar exato pra Fase 2** — o que importa é que o
motor LÊ os 2 campos e o padrão Bloco 3 já usa AMBOS no defense in depth:

```typescript
const where: { id: string; cooperativaId?: string } = { id: conversa.cooperadoId };
if (conversa.cooperativaId) where.cooperativaId = conversa.cooperativaId;
const cooperado = await this.prisma.cooperado.findFirst({ where, ... });
```

**Bloco 4 vai seguir mesmo padrão.**

---

## 5. PADRÃO BLOCO 3 (referência de implementação)

`executarConsultarSaldoCreditos` (linha 459) e `executarConsultarProximaFatura`
(linha 570) seguem a mesma forma:

```typescript
private async executarConsultarX(conversa: {id, telefone, cooperadoId?, cooperativaId?}): Promise<void> {
  // 1. Guard cooperadoId
  if (!conversa.cooperadoId) {
    await this.sender.enviarMensagem(conversa.telefone, 'Pra X você precisa ser cooperado...');
    this.logger.log('X: telefone X nao e cooperado');
    return;
  }
  
  // 2. Multi-tenant defense in depth
  const cooperativaId = conversa.cooperativaId ?? undefined;
  const where = { ...campos, cooperativaId? };
  
  // 3. Queries Prisma com where defensivo
  const dado = await this.prisma.X.findFirst({ where, ... });
  
  // 4. Busca modelo do banco (não hardcode!)
  const modelo = await this.prisma.modeloMensagem.findFirst({
    where: { nome: 'X_resultado', ...this.filtroTenantSomenteLeitura(cooperativaId) },
  });
  if (!modelo) { this.logger.warn('modelo X nao encontrado'); return; }
  
  // 5. Monta vars com fallback (linhas que somem se dado ausente)
  const vars: Record<string, string> = { ... };
  
  // 6. Render + rodapé universal + enviar
  const texto = this.anexarRodape(this.renderizarTemplate(modelo.conteudo, vars));
  await this.sender.enviarMensagem(conversa.telefone, texto);
  
  // 7. Increment uso do modelo
  await this.modeloMensagem.incrementarUso(modelo.id);
  
  // 8. Log com detalhes
  this.logger.log('X: enviado para Y (cooperado=Z, ..., tenant=W)');
}
```

**Try/catch:** wrapado no `executarAcao` pai (não precisa repetir em cada ação).
**`simular()`:** NÃO chama `executarAcao` — ações rodam só no bot real.

---

## 4. CAVEAT ARQUITETURAL CRÍTICO (descoberto na Fase 1)

### O problema

O padrão Bloco 3 é de **1 turno**:
- Cooperado digita "1" → motor transiciona → ação dispara **na entrada da
  etapa-destino** → ação responde tudo. Não precisa do texto do cooperado pra
  nada.

O Bloco 4 é de **2 turnos** (no mínimo):
- **Turno 1:** cooperado digita "1" no `ATUALIZACAO_CADASTRO` → motor
  transiciona pra `AGUARDANDO_NOVO_NOME` → bot envia pergunta "Qual seu nome
  atualizado?" (modelo `aguardando_novo_nome` do Bloco 2).
- **Turno 2:** cooperado digita "João Silva" → motor está em
  `AGUARDANDO_NOVO_NOME` → **PRECISA capturar o texto digitado, validar,
  atualizar o banco, confirmar.**

### O que o motor faz hoje

`processarComFluxoDinamico` (linha 54-125):
1. Detecta comando universal (INÍCIO/SAIR/MENU) — precedência.
2. Busca etapa atual via `buscarEtapa(estado, cooperativaId)`.
3. Avalia gatilhos: `avaliarGatilhos(corpo, etapa.gatilhos)`.
4. Se retornou `proximoEstado`: transiciona, renderiza modelo da etapa-destino,
   dispara `acaoAutomatica` da etapa-destino (linhas 116-121).

`avaliarGatilhos` (linha 296-311):

```typescript
for (const gatilho of gatilhos) {
  const resposta = (gatilho.resposta ?? '').toUpperCase().trim();
  if (resposta === '*') {
    if (corpoUpper.length > 0) return gatilho.proximoEstado;  // WILDCARD!
  } else if (corpoUpper === resposta) {
    return gatilho.proximoEstado;
  }
}
```

**Boa notícia:** o motor JÁ suporta wildcard `*` que casa qualquer texto não
vazio. Resolve a transição do turno 2.

**Má notícia 1:** `gatilho.acao` existe no schema mas o motor IGNORA. Decisão
catalogada na memória `sprint_bot_autoatendimento_20_05.md`:
> "Decisão recomendada: cada opção vira transição pra um estado com
> acaoAutomatica (padrão atual do motor) — NÃO passar a processar
> Gatilho.acao."

**Má notícia 2:** `executarAcao` recebe `_dados: any` (= `conversa.dadosTemp`),
**NÃO recebe o `corpo` do cooperado**. Sem `corpo`, ação não tem como saber
"João Silva".

### As 3 soluções possíveis

**Opção 1 — Passar `corpo` no `executarAcao` (cirúrgica)**

```typescript
private async executarAcao(
  acao: string,
  conversa: {...},
  dados: any,
  corpo: string,   // <-- NOVO
): Promise<void>
```

- Motor passa `corpo` ao chamar (linhas 120, 232).
- Ações antigas ignoram (`corpo` não usado).
- Ações novas (Bloco 4) usam `corpo` direto.
- **Vantagem:** mínimo de mudança no motor, não mexe na decisão da Decisão 20/05.
- **Desvantagem:** ainda precisa de mecanismo pra disparar a ação ANTES de
  renderizar o modelo da etapa-destino (porque a ação atualiza + manda
  confirmação, não queremos modelo da etapa-destino + confirmação duplicados).
  Solução: a ação chama `prisma.conversaWhatsapp.update({estado: 'MENU_COOPERADO'})`
  no final E o motor, ao detectar que a ação já mudou o estado, NÃO dispara
  acaoAutomatica do estado novo (precisa lógica de "ação dona da transição").

**Opção 2 — Reverter decisão e processar `Gatilho.acao` (estrutural)**

- Em `processarComFluxoDinamico` linha 84-94: quando gatilho casa, ANTES de
  transicionar, executar `gatilho.acao` (passando `corpo` + `conversa`). A
  ação faz o trabalho. Depois (ou dentro da ação) transiciona pra
  `proximoEstado` definido no gatilho.
- **Vantagem:** mais geral, abre porta pro Bloco 5 (Atualizar Contrato), 6
  (Cadastro Proxy), 7 (NPS), 8 (Menu Fatura) que também são fluxos 2 turnos.
  Alinhado com Iniciativa Fluxos Customizáveis (D-novo-T).
- **Desvantagem:** revisão dos gatilhos cabeados hoje (vários têm `acao` com
  valor mas o motor ignora — não disparam acidentalmente?). Vou checar isso
  agora rapidamente:

> grep no seed: gatilhos atuais com campo `acao` populado (sem incluir os do
> Bloco 3 que NÃO usam `acao`):
>
> ```
> seed-fluxos-bot.mjs:97: ATUALIZACAO_CONTRATO → MENU_COOPERADO + acao: SOLICITAR_AUMENTO_KWH
> seed-fluxos-bot.mjs:98+: outros 3 do mesmo bloco — SOLICITAR_DIMINUIR_KWH, SOLICITAR_SUSPENDER, SOLICITAR_ENCERRAR
> ```
>
> **Estes são placeholders do Bloco 5.** Se o motor passar a processar
> `gatilho.acao`, esses 4 vão tentar executar ações que ainda não existem em
> `executarAcao()` (cairiam no `default: logger.warn`). Risco baixo
> (só log), mas exige cuidado: ou (a) limpar esses placeholders agora, ou
> (b) garantir que o motor processa `gatilho.acao` E ignora se a ação não
> existe (já é o comportamento padrão atual).

**Opção 3 — Estado intermediário com `dadosTemp` (overengineering)**

- Wildcard transiciona pra `PROCESSANDO_NOME` que tem `acaoAutomatica:
  ATUALIZAR_NOME_COOPERADO`. Antes de transicionar, motor armazena `corpo` em
  `dadosTemp.inputUsuario`. Ação lê de `dadosTemp.inputUsuario`.
- **Desvantagem:** 4 estados a mais (PROCESSANDO_*), mais complexo,
  invenção que não é o caminho natural pro futuro.

### Minha recomendação

**Opção 2 (processar `Gatilho.acao`).** Justificativas:

1. Pré-paga os Blocos 5/6/7/8 (todos são 2 turnos).
2. Resolve o débito documentado da Iniciativa Fluxos Customizáveis sem
   pré-implementá-la.
3. O esforço de revisão dos placeholders existentes é pequeno (4 gatilhos do
   Bloco 5).
4. Quando vier o Bloco 5, vai estar pronto — só precisa implementar a ação.

**Custo:** ~2-3h adicionais sobre o plano original. Justifica a estimativa
revisada de 10-14h pro Bloco 4 inteiro.

---

## 6. DECISÕES DE PRODUTO PRO LUCIANO

### (a) Email novo conflitando com unique constraint global

**Comportamento técnico real:** `email String @unique` (escopo global, não por
tenant). Prisma lança `P2002` ("Unique constraint failed on the fields:
(`email`)"). Hoje o hardcoded NÃO trata — erro genérico ao cooperado.

**Opções pro Bloco 4:**

- **(a1) Erro+cancela com sugestão `+suffix`:** capturar `P2002`, enviar
  mensagem amigável "Esse email já está cadastrado no sistema. Você pode tentar
  outro endereço, ou usar o padrão `seuemail+coopereBR@gmail.com` (o Gmail
  entrega na mesma caixa).", volta pra MENU_COOPERADO sem persistir.

- **(a2) Erro+cancela simples:** "Esse email já está em uso. Tente outro.",
  volta pra AGUARDANDO_NOVO_EMAIL pra cooperado tentar de novo.

- **(a3) Aceitar `+suffix` mas só se base for igual:** se cooperado digitou
  `joao@email.com` e já existe `joao@email.com`, sugerir `joao+coopereBR@email.com`
  automaticamente. **Não recomendo** — mistura demais a UX.

**Recomendação:** **(a1)** — sugere `+suffix` mas deixa o cooperado decidir.
A regra `regra_contato_teste_impreterivel.md` (14/05) já documenta `+suffix`
como padrão Gmail RFC-compliant. Cooperado lê e escolhe.

### (b) CEP inválido / ViaCEP fora

**Cenário hoje:** hardcoded só valida `length === 8` após `.replace(/\D/g, '')`
e salva o CEP. NÃO chama ViaCEP. Endereço completo (logradouro/bairro/cidade/
estado) NÃO é coberto pelo bot — fica como estava (provavelmente vazio se
nunca foi preenchido pelo admin/portal).

**Opções pro Bloco 4:**

- **(b1) Manter como hardcoded (mínimo):** só CEP validado por length 8,
  salva, não tenta ViaCEP. Endereço fica desatualizado. Custo: 0h adicional.

- **(b2) Integrar ViaCEP no backend com fallback:** ação tenta
  `fetch('https://viacep.com.br/ws/${cep}/json/')`. Se responde OK, popula
  `cep + logradouro + bairro + cidade + estado` (numero/complemento ficam de
  fora do bot — cooperado teria que ir no portal pra isso). Se ViaCEP fora do
  ar ou retorna erro: salva só o CEP digitado (degradação graciosa). Custo:
  ~1-2h adicionais.

- **(b3) Bloquear se ViaCEP fora:** rejeita atualização. **Não recomendo** —
  ViaCEP cai eventualmente, cooperado fica preso.

**Recomendação:** **(b2)** — entrega valor real (endereço completo atualizado)
com fallback robusto. ViaCEP é endpoint público estável, sem auth, sem rate
limit prático em volume baixo. Frontend já tem chamada de referência.

### (c) Telefone — RISCO CRÍTICO

Ver §3.3 acima pra detalhamento. Resumo do risco:

- Mudar `Cooperado.telefone` no banco quebra a próxima sessão do bot e desvia
  notificações pro número novo enquanto o cooperado continua usando o
  WhatsApp antigo.

**Opções pro Bloco 4:**

- **(c1) REMOVER a opção telefone do bot (recomendado):** alterar o gatilho
  "3" da etapa `ATUALIZACAO_CADASTRO` no seed E no banco, transformando-o em
  outra coisa útil (ex: "3 — Endereço completo (logradouro/numero)") ou
  simplesmente reduzir o menu pra 3 opções (Nome / Email / CEP). Cooperado
  que precisa trocar telefone vai pelo portal web ou pede pra equipe.

- **(c2) MANTER mas avisar EXPLICITAMENTE:** antes de aceitar o telefone
  novo, bot envia confirmação obrigatória: "⚠️ Atenção: mudar seu telefone
  significa que os bots e notificações automáticas vão pro número NOVO. Se
  você quer continuar conversando aqui no seu WhatsApp atual, **NÃO** mude.
  Digite SIM pra confirmar ou QUALQUER OUTRA COISA pra cancelar."

- **(c3) MANTER sem aviso:** copia hardcoded. **NÃO RECOMENDO** — risco real
  de "fantasma operacional".

**Recomendação:** **(c1)** — remover. O telefone do WhatsApp É a chave de
identificação operacional, mexer nele pelo próprio WhatsApp tem
contraintuitivo. Portal web é o caminho certo.

---

## 7. PROPOSTA DE DESENHO DO BLOCO 4

### 7.1 Mudança arquitetural (cumulativa pros Blocos 5-8)

`processarComFluxoDinamico` em `whatsapp-fluxo-motor.service.ts:54-125`:

- Quando `avaliarGatilhos` retorna gatilho que casou, **antes de transicionar**:
  - Se `gatilho.acao` existe E está no switch de `executarAcao`: chamar
    `executarAcao(gatilho.acao, conversa, dadosTemp, corpo)` (passando o texto
    digitado).
  - A ação faz o trabalho (validar + atualizar + confirmar) E ela própria
    transiciona o estado se necessário (`prisma.conversaWhatsapp.update`).
  - Motor DETECTA que a ação já mudou o estado (verificando antes vs depois
    da execução) e PULA o passo de "renderizar modelo da etapa-destino +
    disparar acaoAutomatica" do fluxo padrão.

- `executarAcao` ganha 4º parâmetro `corpo: string`.

### 7.2 Banco — script idempotente novo

`backend/scripts/fix-bloco-4-atualizar-cadastro.ts` (padrão Bloco 3):

- **INSERT 4 etapas globais** (ordens 52-55):
  - `AGUARDANDO_NOVO_NOME` → modeloMensagemId aponta pra `aguardando_novo_nome`
  - `AGUARDANDO_NOVO_EMAIL` → idem `aguardando_novo_email`
  - `AGUARDANDO_NOVO_CEP` → idem `aguardando_novo_cep`
  - (opcional decisão c) `AGUARDANDO_NOVO_TELEFONE` → idem `aguardando_novo_telefone`
  - `acaoAutomatica`: null (a ação dispara via `gatilho.acao` do wildcard)

- **INSERT 1 gatilho wildcard `*` em cada etapa AGUARDANDO_NOVO_*:**
  - `AGUARDANDO_NOVO_NOME`: `{ resposta: '*', proximoEstado: 'MENU_COOPERADO',
    acao: 'ATUALIZAR_NOME_COOPERADO' }`
  - idem pros outros 3 (ou 2 se telefone removido)

- **REVISAR gatilhos do `ATUALIZACAO_CADASTRO`:** se decisão (c1) — remover
  telefone — mudar gatilho "3" pra outra coisa OU deletar e renumerar
  (1=Nome, 2=Email, 3=CEP).

- **Modelos `aguardando_novo_*` JÁ EXISTEM** no banco (Bloco 2, commit
  `1097f72`). Confirmar `cooperativaId=null + ativo=true` na Fase 2 (read-only
  check, 1 query).

### 7.3 4 ações novas em `executarAcao()` (ou 3 se telefone removido)

Cada ação segue padrão Bloco 3 com adaptações:

```typescript
private async executarAtualizarNomeCooperado(
  conversa: {...},
  corpo: string,
): Promise<void> {
  // 1. Guard cooperadoId
  if (!conversa.cooperadoId) {
    await this.sender.enviarMensagem(conversa.telefone, 'Pra atualizar seu cadastro você precisa ser cooperado...');
    return;
  }
  
  // 2. Validar input (espelhar regras hardcoded)
  const novoNome = corpo.trim();
  if (novoNome.length < 3) {
    await this.sender.enviarMensagem(conversa.telefone, 'Nome muito curto. Digite o nome completo.');
    // NÃO transiciona — cooperado tenta de novo no mesmo estado
    return;
  }
  
  // 3. Update com defense in depth multi-tenant
  const cooperativaId = conversa.cooperativaId ?? undefined;
  try {
    await this.prisma.cooperado.update({
      where: cooperativaId 
        ? { id: conversa.cooperadoId, cooperativaId } as any
        : { id: conversa.cooperadoId },
      data: { nomeCompleto: novoNome },
    });
  } catch (err) {
    // Específico do email: P2002 unique violation
    // (para nome/CEP isso não acontece — só log + mensagem genérica)
    this.logger.error(`ATUALIZAR_NOME falhou: ${err.message}`);
    await this.sender.enviarMensagem(conversa.telefone, 'Não consegui atualizar agora. Tente de novo em alguns minutos.');
    return;
  }
  
  // 4. Confirmar + transicionar pra MENU_COOPERADO
  await this.sender.enviarMensagem(conversa.telefone, `✅ Nome atualizado para *${novoNome}*!`);
  await this.prisma.conversaWhatsapp.update({
    where: { id: conversa.id },
    data: { estado: 'MENU_COOPERADO' },
  });
  
  this.logger.log(`ATUALIZAR_NOME: cooperado ${conversa.cooperadoId} -> "${novoNome}" (tenant=${cooperativaId ?? 'global'})`);
}
```

**Variações por ação:**

- `ATUALIZAR_EMAIL_COOPERADO`: validar regex, **tratar P2002 explicitamente**
  com mensagem decisão (a1). Trim + toLowerCase no email.

- `ATUALIZAR_CEP_COOPERADO`: validar length 8 dígitos. **Se decisão (b2)**:
  tentar `fetch('https://viacep.com.br/ws/${cep}/json/')` com timeout 3s. Se
  responde `{cep, logradouro, bairro, localidade (cidade), uf (estado)}` sem
  erro: salvar todos. Se falha/timeout: salvar só CEP. Log do fallback.

- `ATUALIZAR_TELEFONE_COOPERADO` (só se decisão c2 ou c3): validar dígitos
  10-13. Se (c2): exigir confirmação SIM antes — vai precisar de mais um
  estado intermediário ou usar `dadosTemp.confirmando` flag. **Mais 1-2h se
  c2.** Se (c1): NÃO criar esta ação.

### 7.4 Modelos de banco — `*_resultado` (opcional)

O Bloco 3 usa modelos do banco pras respostas finais (`saldo_creditos_resultado`,
`proxima_fatura_resultado`). Pro Bloco 4 a mensagem de confirmação é muito
curta e simples ("✅ Nome atualizado para *X*!"). Decisão:

- **(d1) Hardcoded na ação:** mensagem direta no `enviarMensagem`. Custo: 0.
  Desvantagem: admin não edita mensagem pelo painel.
- **(d2) Modelo do banco:** criar `cadastro_atualizado_nome`, `_email`, `_cep`
  (3 modelos novos) + renderizar. Custo: ~30 min. Admin edita.

**Recomendação:** **(d1)** pro Bloco 4 (consistência com D-novo-V já catalogado
— Bloco 3 também tem hardcode nas linhas condicionais). Quando D-novo-V virar
engine de template, refatoramos todos juntos.

### 7.5 Specs novos (estimativa)

Padrão `whatsapp-fluxo-motor.service.spec.ts`. ~15 specs novos:

- `executarAtualizarNomeCooperado`: 4 cenários (sem cooperadoId, nome curto,
  sucesso, erro Prisma)
- `executarAtualizarEmailCooperado`: 5 cenários (sem cooperadoId, regex
  inválido, sucesso, **P2002 capturado**, multi-tenant)
- `executarAtualizarCepCooperado`: 4 cenários (length inválido, sucesso só
  CEP, sucesso com ViaCEP, fallback ViaCEP fora)
- `processarComFluxoDinamico` com gatilho.acao: 2 cenários (com ação
  cabeada, sem ação cabeada — comportamento antigo preservado)
- (se c2 telefone) 4 cenários do telefone com confirmação

Total: 19 cenários se incluir telefone com confirmação, 15 se telefone for
removido.

---

## 8. ESTIMATIVA REVISADA

| Item | Custo |
|---|---|
| Mudança arquitetural processar `Gatilho.acao` + passar `corpo` em executarAcao | 2-3h |
| 3 ou 4 ações novas (nome/email/cep/telefone) | 3-4h |
| Tratamento P2002 email (decisão a1) | 0.5h |
| Integração ViaCEP backend (decisão b2) | 1-2h |
| Telefone com confirmação SIM (se decisão c2) | 1-2h |
| Script idempotente banco (etapas + gatilhos wildcard) | 1h |
| Specs (15-19 cenários) | 2-3h |
| Smoke real banco DEV + ajustes | 1h |
| **Total** | **10-14h** (era 6-8h no plano) |

Se decisão (c1) telefone removido: -1.5h → **8.5-12.5h**.
Se decisão (b1) CEP sem ViaCEP: -1.5h → **7-10.5h**.

---

## 9. CHECKLIST DECISÕES PENDENTES PRO LUCIANO (PASSO 3)

Pra eu fechar a Fase 1 e poder começar a Fase 2 (escrita) preciso de OK
explícito em:

1. **Mudança arquitetural** — processar `Gatilho.acao` + adicionar parâmetro
   `corpo` no `executarAcao`. (recomendação minha: SIM, abre porta pros
   Blocos 5-8)

2. **Decisão (a) email duplicado** — (a1) erro+cancela com sugestão `+suffix` /
   (a2) erro+cancela simples / (a3) `+suffix` automático. (recomendação: a1)

3. **Decisão (b) CEP/ViaCEP** — (b1) só CEP digitado / (b2) ViaCEP backend com
   fallback / (b3) bloquear se ViaCEP fora. (recomendação: b2)

4. **Decisão (c) telefone — CRÍTICO** — (c1) REMOVER do bot / (c2) MANTER com
   confirmação SIM / (c3) MANTER sem aviso (hardcoded copy). (recomendação:
   c1)

5. **Decisão (d) modelos de confirmação no banco** — (d1) hardcoded na ação /
   (d2) modelos `cadastro_atualizado_*` no banco. (recomendação: d1)

6. **Limpeza dos placeholders do Bloco 5** — Mudança arquitetural (1) faria
   o motor processar `Gatilho.acao` que hoje está cabeado em 4 gatilhos do
   `ATUALIZACAO_CONTRATO` (SOLICITAR_AUMENTO_KWH, _DIMINUIR_KWH, _SUSPENDER,
   _ENCERRAR) — essas ações ainda não existem, vão cair no `default:
   logger.warn`. (recomendação: deixar o warn passar — comportamento default
   atual do motor — e implementar Bloco 5 em sprint futuro)

Aguardando OK em cada um pra empacotar prompt da Fase 2.

---

## 10. CONFIRMAÇÕES TÉCNICAS A FAZER NA FASE 2 (read-only check rápido)

- [ ] Modelos `aguardando_novo_*` confirmados no banco DEV com
  `cooperativaId=null + ativo=true` (1 query SELECT).
- [ ] Etapas `AGUARDANDO_NOVO_*` confirmadas como NÃO existentes no banco DEV
  (1 query SELECT — esperado: 0 rows).
- [ ] Em que lugar `whatsapp.service.ts` (ou similar) popula
  `ConversaWhatsapp.cooperadoId` / `cooperativaId` via match telefone —
  irrelevante pro Bloco 4 mas bom saber.

---

## Diretrizes aplicadas nesta Fase 1

- ✅ **Decisão 23** — Fase 1 read-only OBRIGATÓRIA. Zero edits, zero builds,
  zero schema/banco.
- ✅ **Decisão 14** — grep amplo confirmou estado atual antes de propor.
- ✅ **Padrão Bloco 3** — referência direta pro desenho proposto.
- ✅ **Multi-tenant defense in depth** — cooperativaId em todas as queries
  propostas.
- ✅ **NÃO trabalhar paralelo com claude.ai** — Code 100% direto.
- ✅ **Sem suposições** — caveat arquitetural foi descoberto na investigação,
  não assumido.

---

## Próximo passo

Aguardar OKs do Luciano nos 6 itens do §9. Depois empacotar prompt da Fase 2
e implementar.
