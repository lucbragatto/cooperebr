# Auditoria IDOR Onda B — Infra/Gateways/WhatsApp/Notificações (30/05/2026)

> Dynamic Workflow (BQ.7 Onda B) — 45 subagentes, 31 IDORs confirmados de 73 endpoints (33 seguros).
> Fecha o quadro completo de IDOR do backend. Complementa relatórios núcleo + Onda A.

## Resumo

| Métrica | Valor |
|---|---|
| Endpoints mapeados | 73 |
| Seguros | 33 |
| IDORs confirmados | 31 |
| CRITICO | 7 |
| ALTO | 16 |
| MEDIO | 8 |

**TOTAL SISTEMA: 68 IDORs** = 18 núcleo (corrigidos BQ.1-BQ.4) + 19 Onda A + 31 Onda B (pendentes).

## CRITICO (7)

### PATCH /notificacoes/:id/ler
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/notificacoes/notificacoes.service.ts:controller L29-32; service L44-48`
- **Query:** `prisma.notificacao.update({ where: { id } })`
- **Problema:** IDOR confirmado em duas camadas sem refutação possível.

Controller (`notificacoes.controller.ts` L29-32): `@Patch(':id/ler')` chama `marcarComoLida(@Param('id') id: string)` — o `@CurrentUser()` não é injetado, o `user` não é passado ao service.

Service (`notificacoes.service.ts` L44-48): `marcarComoLida(id: string)` executa `prisma.notificacao.update({ where: { id }, data: { lida: true } })` — sem nenhum filtro de `cooperativaId`, `cooperadoId` ou `adminId`. Qualquer usuário autenticado de qualquer tenant que conheça um UUID válido de notificação de outro tenant pode marcá-la como lida.

Re
- **Fix:** No controller, injetar `@CurrentUser()` e repassar o `user` ao service:

```typescript
// notificacoes.controller.ts L29-32
@Patch(':id/ler')
marcarComoLida(@Param('id') id: string, @CurrentUser() user: Usuario) {
  return this.notificacoesService.marcarComoLida(id, user);
}
```

No service, adicionar verificação de posse antes do update usando o mesmo `buildWhere` já existente:

```typescript
//

### POST /asaas/cobrancas/:asaasId/cancelar
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/asaas/asaas.service.ts:controller:89-97 / service:345-358`
- **Query:** `asaasCobranca.updateMany({ where: { asaasId } }) — sem cooperativaId`
- **Problema:** Vulnerabilidade confirmada nas duas camadas. Controller (`asaas.controller.ts:89-97`): repassa `req.user?.cooperativaId` ao service, correto. Service (`asaas.service.ts:345-358`): usa `cooperativaId` APENAS para selecionar o API client Asaas (`getApiClient`), mas o update local é `prisma.asaasCobranca.updateMany({ where: { asaasId } })` sem filtro de `cooperativaId` nem de `cooperadoId`. O modelo `AsaasCobranca` (schema linha 1508-1532) não possui campo `cooperativaId` — o único elo de tenant é indireto via `cooperadoId → Cooperado → cooperativaId`. Isso significa que o Prisma não pode filtrar
- **Fix:** Em `asaas.service.ts`, método `cancelarCobranca` (e identicamente em `buscarStatusCobranca`): adicionar verificação de posse antes de qualquer ação. Como `AsaasCobranca` não tem `cooperativaId` direto, o lookup deve ser via JOIN com `cooperado`: `const cobranca = await this.prisma.asaasCobranca.findFirst({ where: { asaasId, cooperado: { cooperativaId } } })`. Se `!cobranca`, lançar `NotFoundExcept

### POST /integracao-bancaria/cobrancas/:id/cancelar
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/integracao-bancaria/integracao-bancaria.service.ts:controller:70-73 / service:172-196`
- **Query:** `cobrancaBancaria.findUnique({ where: { id } }) — sem cooperativaId; update({ where: { id } }) — sem cooperativaId`
- **Problema:** IDOR confirmado em ambas as camadas. Controller (linha 69-72, integracao-bancaria.controller.ts): o endpoint POST /integracao-bancaria/cobrancas/:id/cancelar recebe apenas o :id de rota, não extrai cooperativaId do JWT (sem @CurrentUser() / @Request()), e repassa só o id ao service. Service (linhas 172-196, integracao-bancaria.service.ts): cancelarCobranca(id) chama this.findOne(id) que faz cobrancaBancaria.findUnique({ where: { id } }) sem filtro de cooperativaId (linha 162); o update subsequente (linha 192) também usa apenas { where: { id } }. O RolesGuard (roles.guard.ts) checa exclusivamen
- **Fix:** 1. Injetar o usuário autenticado no controller via @CurrentUser() e passar cooperativaId ao service:
   cancelarCobranca(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) { return this.service.cancelarCobranca(id, user.cooperativaId); }

2. No service, substituir findOne por uma busca que valide a posse antes de agir:
   const cobranca = await this.prisma.cobrancaBancaria.findFirst

### POST /integracao-bancaria/config
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/integracao-bancaria/integracao-bancaria.service.ts:controller:116-135 / service:21-37`
- **Query:** `configuracaoBancaria.create({ data }) — cooperativaId vem diretamente do body sem validação contra JWT`
- **Problema:** Confirmado em duas camadas. Controller (linha 131): `cooperativaId?: string` vem do body sem extração de `req.user`. Service (linha 36): `prisma.configuracaoBancaria.create({ data })` persiste o objeto inteiro sem sobrescrever `cooperativaId`. Não há `@Request() req`, interceptor, nem middleware que injete ou sobreescreva o campo. O guard global JwtAuthGuard+RolesGuard valida role (ADMIN) mas não vincula cooperativaId ao tenant do JWT. Um ADMIN do Tenant A pode criar ConfiguracaoBancaria (com clientId, clientSecret, certificadoPfx, webhookSecret) apontando para cooperativaId do Tenant B. Adici
- **Fix:** No controller, injetar `@Request() req` no handler `criarConfig` e passar `cooperativaId: req.user.cooperativaId` explicitamente para o service, ignorando qualquer `cooperativaId` do body (SUPER_ADMIN pode receber override explícito como parâmetro separado). No service, remover `cooperativaId` do tipo do parâmetro de `criarConfig` e recebê-lo como argumento obrigatório separado vindo do JWT. Em `a

### PATCH /integracao-bancaria/config/:id
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/integracao-bancaria/integracao-bancaria.service.ts:controller:137-141 / service:39-41`
- **Query:** `configuracaoBancaria.update({ where: { id } }) — sem cooperativaId; nenhuma verificação de posse anterior`
- **Problema:** Confirmed IDOR after reading both layers. Controller (`integracao-bancaria.controller.ts` line 137-141): `@Roles(SUPER_ADMIN, ADMIN)` — ADMIN of any tenant can reach this endpoint. No `@Request()` / `@CurrentUser()` decorator is used; `cooperativaId` is never extracted from the JWT. Service (`integracao-bancaria.service.ts` line 39-41): `atualizarConfig(id, data)` does `prisma.configuracaoBancaria.update({ where: { id }, data })` — a bare primary-key update with no ownership pre-check (`findFirst id+cooperativaId`) and `data: any` (no DTO). Global guards (`app.module.ts` lines 129-131) apply `
- **Fix:** 1. In the controller, inject `@Request() req` and pass `req.user.cooperativaId` to the service (SUPER_ADMIN passes `undefined` to skip the filter, consistent with existing platform conventions). 2. In `atualizarConfig`, add a prior ownership check: `const existing = await this.prisma.configuracaoBancaria.findFirst({ where: cooperativaId ? { id, cooperativaId } : { id } }); if (!existing) throw new

### DELETE /whatsapp/modelos/:id
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/whatsapp/modelo-mensagem.service.ts:49`
- **Query:** `prisma.modeloMensagem.delete({ where: { id } })`
- **Problema:** Confirmado lendo as duas camadas. Controller (whatsapp-fatura.controller.ts linha 483-487): DELETE /whatsapp/modelos/:id está decorado com @Roles(SUPER_ADMIN, ADMIN), mas o handler deletarModelo não injeta @Req() nem extrai cooperativaId do JWT — só recebe @Param('id'). Service (modelo-mensagem.service.ts linha 49-51): delete(id) executa prisma.modeloMensagem.delete({ where: { id } }) sem nenhum filtro de cooperativaId. Resultado: qualquer usuário com role ADMIN (de qualquer tenant) pode deletar modelos de outros tenants ou modelos globais (cooperativaId=null). A função findByNome (linhas 22-3
- **Fix:** No service, adicionar verificação de posse antes de executar delete e update. Para delete: (1) buscar o modelo com findUnique({ where: { id } }); (2) se modelo não existe, lançar NotFoundException; (3) se modelo.cooperativaId === null (global), exigir que o chamador seja SUPER_ADMIN; (4) se modelo.cooperativaId !== null e !== cooperativaId do JWT, lançar ForbiddenException; (5) só então executar o

### POST /whatsapp/disparar-cobrancas
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/whatsapp/whatsapp-cobranca.service.ts:60`
- **Query:** `prisma.cobranca.findMany({ where: { cooperativaId: opcoes.parceiroId } })`
- **Problema:** O controller em whatsapp-fatura.controller.ts linha 404 passa `body.parceiroId` diretamente para o service sem validar se o caller possui aquele tenant. O service em whatsapp-cobranca.service.ts linhas 60-61 usa `opcoes.parceiroId` como `cooperativaId` no where do Prisma quando `modo === 'parceiro'`, ignorando completamente o `cooperativaId` extraido do JWT. Resultado: um ADMIN do tenant A pode enviar `{ modo: 'parceiro', parceiroId: '<id-tenant-B>' }` e o sistema disparara mensagens WhatsApp de cobrança com dados financeiros (valor, PIX copia-e-cola, link Asaas) para todos os cooperados do te
- **Fix:** No controller (whatsapp-fatura.controller.ts, metodo dispararCobrancas, linha ~403-409): validar que `body.parceiroId`, quando presente, so pode ser diferente de `cooperativaId` se o caller for SUPER_ADMIN. Implementacao sugerida:

```typescript
const cooperativaId = req.user?.cooperativaId;
const perfil = req.user?.perfil;
const parceiroIdEfetivo = (perfil === 'SUPER_ADMIN' && body.parceiroId)

## ALTO (16)

### POST /email/reenviar/:cooperadoId
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/email/email.service.ts:controller L14-37`
- **Query:** `prisma.cooperado.findUnique({ where: { id: cooperadoId } }) — sem cooperativaId; prisma.cobranca.findFirst({ where: { contrato: { cooperadoId } } }) — sem coope`
- **Problema:** Confirmado lendo controller (L14-38) e service. O handler `POST /email/reenviar/:cooperadoId` recebe apenas `@Param('cooperadoId')` — nunca extrai `req.user.cooperativaId` do JWT. A query Prisma em L17-20 é `findUnique({ where: { id: cooperadoId } })` sem filtro de tenant. A query de cobrança (L25-28) usa apenas `{ contrato: { cooperadoId } }`, também sem cooperativaId. O endpoint está acessível a ADMIN e OPERADOR (roles com escopo de tenant), não apenas SUPER_ADMIN. O guard global (APP_GUARD JwtAuthGuard, confirmado em app.module.ts L129) autentica o request mas NÃO aplica isolamento de tenan
- **Fix:** No controller, injetar `@Request() req` no handler e extrair `cooperativaId = req.user.cooperativaId`. Converter o `findUnique` em `findFirst` com filtro composto: `prisma.cooperado.findFirst({ where: { id: cooperadoId, cooperativaId } })`. Adicionar o mesmo filtro na query de cobrança: `prisma.cobranca.findFirst({ where: { contrato: { cooperadoId, cooperativaId } }, status: { in: ['PENDENTE', 'A_

### GET /asaas/cobrancas/:cooperadoId
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/asaas/asaas.service.ts:controller:84-87 / service:361-365`
- **Query:** `asaasCobranca.findMany({ where: { cooperadoId } }) — sem cooperativaId`
- **Problema:** Controller em asaas.controller.ts:84-86 recebe :cooperadoId via @Param mas não passa req.user.cooperativaId ao service. Service em asaas.service.ts:361-365 executa prisma.asaasCobranca.findMany({ where: { cooperadoId } }) sem nenhum filtro de tenant. O modelo AsaasCobranca não possui coluna cooperativaId própria, e não existe guard global nem middleware que injete isolamento. Um ADMIN do tenant A que conheça o UUID de um cooperado do tenant B pode listar todas as cobranças desse cooperado — valor, status, linkPagamento, boletoUrl, pixCopiaECola — cruzando tenants. Não há proteção SUPER_ADMIN-o
- **Fix:** No service, adicionar cooperativaId como parâmetro e filtrar via relação: prisma.asaasCobranca.findMany({ where: { cooperadoId, cooperado: { cooperativaId } }, orderBy: { createdAt: 'desc' } }). No controller, passar req.user.cooperativaId para o service (SUPER_ADMIN pode receber cooperativaId de query param). Arquivos: backend/src/asaas/asaas.controller.ts linha 85-86 e backend/src/asaas/asaas.se

### POST /integracao-bancaria/cobrancas
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/integracao-bancaria/integracao-bancaria.service.ts:controller:29-45 / service:59-135`
- **Query:** `configuracaoBancaria.findFirst({ where: { ativo: true } }) — sem cooperativaId do JWT; cooperativaId da cobrança vem da config ativa global`
- **Problema:** Ambas as camadas confirmadas. Controller (linha 30-45): POST /integracao-bancaria/cobrancas permite ADMIN e OPERADOR de qualquer tenant; req não é injetado, cooperativaId do JWT nunca é extraído nem repassado ao service. Service emitirCobranca (linha 68): getConfigAtiva busca ConfiguracaoBancaria WHERE ativo=true SEM filtro de cooperativaId — retorna a config "ativa global" (pode ser de outro tenant). Linha 69-72: cooperado.findUnique sem filtro de cooperativaId — ADMIN do tenant A pode passar cooperadoId do tenant B. Linha 85: o registro CobrancaBancaria recebe cooperativaId = config.cooperat
- **Fix:** 1. Injetar Request no controller e extrair cooperativaId do JWT em emitirCobranca, passando-o ao service: adicionar @Request() req ao handler e incluir cooperativaId: req.user.cooperativaId no objeto passado a service.emitirCobranca. 2. No service, filtrar getConfigAtiva por cooperativaId: WHERE { ativo: true, cooperativaId } — nunca buscar config global. 3. Validar posse do cooperado: trocar coop

### POST /integracao-bancaria/cobrancas/:id/reemitir
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/integracao-bancaria/integracao-bancaria.service.ts:controller:75-79 / service:200-218`
- **Query:** `findOne (findUnique por id sem cooperativaId) + emitirCobranca sem validação de tenant`
- **Problema:** Vulnerabilidade IDOR real confirmada em duas camadas. Controller (linha 77): recebe :id, não injeta req.user nem cooperativaId. Service reemitirCobranca (linha 201): chama findOne(id) que faz findUnique({ where: { id } }) sem cooperativaId (linha 162) — qualquer UUID resolve independente do tenant. Sequência de dano: (1) ADMIN do tenant A chama /cobrancas/:id_do_tenant_B/reemitir; (2) findOne retorna cobrança do tenant B sem bloqueio; (3) cancelarCobranca altera status e chama API bancária do tenant B (linha 186-189), modificando registros financeiros de outro tenant; (4) emitirCobranca reemit
- **Fix:** 1. Injetar @Request() req no controller e passar req.user.cooperativaId para o service em todos os endpoints com :id. 2. Em findOne: trocar findUnique({ where: { id } }) por findFirst({ where: { id, cooperativaId } }) — lançar NotFoundException se não encontrar (não vaza existência de registros de outros tenants). 3. Em cancelarCobranca e reemitirCobranca: receber cooperativaId como parâmetro e re

### GET /integracao-bancaria/config
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/integracao-bancaria/integracao-bancaria.service.ts:controller:109-113 / service:43-47`
- **Query:** `configuracaoBancaria.findMany() — sem cooperativaId, retorna todos os registros de todos os tenants`
- **Problema:** IDOR real confirmado em duas camadas. Controller (`C:/Users/Luciano/cooperebr/backend/src/integracao-bancaria/integracao-bancaria.controller.ts`, linha 109-113): endpoint `GET /integracao-bancaria/config` usa `@Roles(SUPER_ADMIN, ADMIN)` — ADMIN é papel por-tenant, não global. Service (`C:/Users/Luciano/cooperebr/backend/src/integracao-bancaria/integracao-bancaria.service.ts`, linha 43-47): `configuracaoBancaria.findMany()` sem nenhum filtro de `cooperativaId`. O guard global (`APP_GUARD` JwtAuthGuard + RolesGuard) autentica e verifica papel, mas NÃO injeta isolamento de tenant na query — conf
- **Fix:** Quatro correções necessárias no service, todas requerem passar `cooperativaId` do JWT via request (injetar `@Request() req` no controller e propagar ao service): (1) `listarConfigs(cooperativaId: string)` — adicionar `where: { cooperativaId }` ao `findMany()`; SUPER_ADMIN recebe `cooperativaId = undefined` e vê tudo. (2) `atualizarConfig(id, data, cooperativaId)` — trocar `update({ where: { id } }

### PUT /whatsapp/listas/:id
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/whatsapp/whatsapp-fatura.controller.ts:320`
- **Query:** `prisma.listaContatos.update({ where: { id }, data })`
- **Problema:** Confirmado pela leitura de ambas as camadas. No controller (linha 309-321 de whatsapp-fatura.controller.ts), o método `atualizarLista` não recebe `@Req() req` e não extrai `cooperativaId` do JWT. A query Prisma na linha 320 é `prisma.listaContatos.update({ where: { id }, data })` sem nenhum filtro de tenant. Um ADMIN do tenant A, conhecendo o UUID de uma `listaContatos` do tenant B, pode atualizar `nome`, `descricao`, `telefones` e `cooperadoIds` dessa lista sem restrição. Não há guard SUPER_ADMIN-only, nem verificação prévia de posse, nem filtro cooperativaId no where. O contraste com o métod
- **Fix:** Em `whatsapp-fatura.controller.ts`, linha 309-321, adicionar `@Req() req: any` ao método `atualizarLista` e incluir `cooperativaId` no `where` da query Prisma com verificação prévia de posse:

```typescript
@Roles(SUPER_ADMIN, ADMIN)
@Put('listas/:id')
async atualizarLista(
  @Param('id') id: string,
  @Req() req: any,
  @Body() body: { nome?: string; descricao?: string; telefones?: string[]; coop

### DELETE /whatsapp/listas/:id
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/whatsapp/whatsapp-fatura.controller.ts:325`
- **Query:** `prisma.listaContatos.delete({ where: { id } })`
- **Problema:** IDOR confirmado. O handler `deletarLista` (linha 323-327 de whatsapp-fatura.controller.ts) não recebe `@Req()` e não extrai `cooperativaId` do JWT. A query Prisma é `listaContatos.delete({ where: { id } })` — sem filtro de tenant. Qualquer ADMIN autenticado em qualquer tenant pode deletar a `ListaContatos` de outro tenant enviando o UUID correto. Os guards globais (`JwtAuthGuard`, `RolesGuard` via `APP_GUARD` no `app.module.ts` linhas 129-131) garantem apenas autenticação e perfil ADMIN, não isolamento de tenant. O próprio GET de listas (linha 279-288) faz o isolamento correto com `where.coope
- **Fix:** No handler `deletarLista` (linha 323), adicionar `@Req() req: any` como parâmetro e implementar verificação de posse antes do delete. Para ADMIN, usar `prisma.listaContatos.deleteMany({ where: { id, cooperativaId: req.user.cooperativaId } })` (que retorna count=0 sem erro se não pertencer ao tenant, prevenindo information leakage) ou fazer `findFirst({ where: { id, cooperativaId } })` e lançar `No

### PUT /whatsapp/modelos/:id
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/whatsapp/modelo-mensagem.service.ts:46`
- **Query:** `prisma.modeloMensagem.update({ where: { id }, data })`
- **Problema:** Confirmado nas duas camadas. Controller (whatsapp-fatura.controller.ts linha 474-481): endpoint PUT /whatsapp/modelos/:id tem @Roles(SUPER_ADMIN, ADMIN) mas NÃO passa req.user.cooperativaId para o service — chama apenas this.modeloMensagem.update(id, body). Service (modelo-mensagem.service.ts linha 45-47): executa prisma.modeloMensagem.update({ where: { id }, data }) sem nenhum filtro de cooperativaId. Não há verificação prévia de posse (findFirst com id+cooperativaId). Um ADMIN do tenant A pode modificar qualquer modeloMensagem — incluindo modelos globais (cooperativaId=null, que funcionam co
- **Fix:** No service modelo-mensagem.service.ts, alterar a assinatura de update para receber cooperativaId opcional e adicionar verificação de posse antes do update:

async update(id: string, data: Partial<...>, cooperativaId?: string) {
  if (cooperativaId) {
    const modelo = await this.prisma.modeloMensagem.findFirst({
      where: { id, cooperativaId },
    });
    if (!modelo) throw new NotFoundExcept

### PUT /whatsapp/fluxos/:id
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/whatsapp/modelo-mensagem.service.ts:110`
- **Query:** `prisma.fluxoEtapa.update({ where: { id }, data })`
- **Problema:** Vulnerabilidade confirmada nas duas camadas. Controller (whatsapp-fatura.controller.ts linha 546): PUT /whatsapp/fluxos/:id decorado com @Roles(SUPER_ADMIN, ADMIN) chama this.modeloMensagem.updateFluxo(id, body) sem passar req.user.cooperativaId. Service (modelo-mensagem.service.ts linha 110): prisma.fluxoEtapa.update({ where: { id }, data }) sem qualquer filtro de cooperativaId. O schema mostra que FluxoEtapa.cooperativaId é String? (nullable) — registros com cooperativaId=null são etapas globais de plataforma que afetam todos os tenants. Um ADMIN de tenant A pode: (1) alterar FluxoEtapa de t
- **Fix:** No controller (whatsapp-fatura.controller.ts linha 531-547): passar req.user para o service — adicionar @Req() req: any e chamar this.modeloMensagem.updateFluxo(id, body, req.user). No service (modelo-mensagem.service.ts linha 99-111): receber o user como parâmetro. Se perfil !== SUPER_ADMIN, fazer verificação de posse prévia com prisma.fluxoEtapa.findFirst({ where: { id, cooperativaId: user.coope

### GET /whatsapp/historico
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/whatsapp/whatsapp-fatura.controller.ts:254`
- **Query:** `prisma.mensagemWhatsapp.findMany({ where: {} }) — sem cooperativaId`
- **Problema:** GET /whatsapp/historico (lines 239-265 in whatsapp-fatura.controller.ts) and GET /whatsapp/historico/:telefone (lines 267-275) both lack tenant isolation. Neither handler has a @Req() parameter, so cooperativaId from the JWT is never read. The where clause is built only from the optional query params telefone and direcao — an ADMIN of any tenant can call GET /whatsapp/historico with no filters and receive all MensagemWhatsapp rows from every tenant. The MensagemWhatsapp model does have cooperativaId String? (schema line 1770), confirming the field exists and filtering is feasible but simply no
- **Fix:** In both handlers, inject @Req() req: any and apply cooperativaId filtering from req.user.

For GET /whatsapp/historico (line 241):
  async getHistorico(@Req() req: any, @Query(...) ...) {
    const cooperativaId = req.user?.cooperativaId;
    const perfil = req.user?.perfil;
    const where: any = {};
    if (perfil !== 'SUPER_ADMIN' && cooperativaId) {
      where.cooperativaId = cooperativaId;

### GET /whatsapp/historico/:telefone
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/whatsapp/whatsapp-fatura.controller.ts:271`
- **Query:** `prisma.mensagemWhatsapp.findMany({ where: { telefone: { contains: telefoneNorm } } })`
- **Problema:** Confirmado IDOR real. O endpoint GET /whatsapp/historico/:telefone (linha 267-275, C:/Users/Luciano/cooperebr/backend/src/whatsapp/whatsapp-fatura.controller.ts) não extrai @Req() e portanto nunca usa cooperativaId do JWT. A query Prisma filtra apenas por telefone: `prisma.mensagemWhatsapp.findMany({ where: { telefone: { contains: telefoneNorm } } })`, sem qualquer restrição de tenant. O modelo MensagemWhatsapp tem campo `cooperativaId String?` (linha 1770 do schema.prisma), portanto o isolamento é possível mas não implementado. Qualquer ADMIN autenticado de qualquer tenant pode chamar GET /wh
- **Fix:** Em getHistoricoContato (linha 268), adicionar @Req() req: any, extrair cooperativaId e perfil do JWT, e aplicar a mesma lógica de guarda do sibling: se perfil !== 'SUPER_ADMIN', verificar que uma ConversaWhatsapp com { telefone, cooperativaId } existe antes de retornar mensagens. Depois, adicionar cooperativaId ao filtro do findMany quando disponível: `where: { telefone: { contains: telefoneNorm }

### POST /whatsapp/disparar-convites-indicacao
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/whatsapp/whatsapp-mlm.service.ts:42`
- **Query:** `prisma.cooperado.findMany({ where: { cooperativaId: targetCooperativaId } })`
- **Problema:** IDOR real confirmado em ambas as camadas. Controller (whatsapp-fatura.controller.ts linha 424): endpoint acessível a ADMIN (perfil por-tenant), não apenas SUPER_ADMIN. Extrai cooperativaId do JWT corretamente (linha 435) mas repassa body.parceiroId ao serviço sem nenhuma validação de posse (linha 441). Service (whatsapp-mlm.service.ts linhas 42-44): quando modo='parceiro', targetCooperativaId é definido diretamente como opcoes.parceiroId (vindo do body), ignorando completamente o cooperativaId do JWT. Sem nenhuma verificação de que parceiroId pertence ao tenant do solicitante. A query resultan
- **Fix:** No service (whatsapp-mlm.service.ts), antes de usar parceiroId como targetCooperativaId, adicionar verificação de posse: se o solicitante não for SUPER_ADMIN, rejeitar qualquer parceiroId diferente do cooperativaId do JWT. Opção mais simples e segura: remover o suporte a modo='parceiro' para ADMIN — apenas SUPER_ADMIN pode especificar um parceiroId arbitrário. Implementação: no service, receber ta

### GET /whatsapp/cooperados-para-disparo
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/whatsapp/whatsapp-fatura.controller.ts:350`
- **Query:** `prisma.cooperado.findMany({ where: { cooperativaId: parceiroId } })`
- **Problema:** IDOR confirmado em duas camadas (controller inline, sem service separado). Arquivo: C:/Users/Luciano/cooperebr/backend/src/whatsapp/whatsapp-fatura.controller.ts, linhas 339-378. O endpoint GET /whatsapp/cooperados-para-disparo tem @Roles(ADMIN, SUPER_ADMIN). Dentro do handler, a lógica nas linhas 350-353 substitui o cooperativaId do JWT pelo parceiroId vindo do query param, sem nenhuma validacao de que o caller seja SUPER_ADMIN nem de que o parceiroId pertenca ao tenant do caller. Um ADMIN de tenant A pode passar ?parceiroId=<uuid-tenant-B> e receber nome, telefone e status de contrato de tod
- **Fix:** Restringir o uso de parceiroId exclusivamente a SUPER_ADMIN. Substituir a logica de linhas 350-354 por: if (parceiroId && req.user?.perfil === PerfilUsuario.SUPER_ADMIN) { where.cooperativaId = parceiroId; } else { where.cooperativaId = cooperativaId; } Dessa forma, um ADMIN sempre recebe apenas os cooperados do proprio tenant (cooperativaId do JWT), enquanto SUPER_ADMIN continua podendo filtrar p

### POST /monitoramento-usinas/:usinaId/config
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/monitoramento-usinas/monitoramento-usinas.service.ts:34-37 (controller) | 305-312 (service createConfig)`
- **Query:** `prisma.usinaMonitoramentoConfig.create({ data: { usinaId, ...dataPreparada } }) — sem cooperativaId no where nem validação de posse prévia`
- **Problema:** Confirmado em ambas as camadas. Controller (linha 33-37 de monitoramento-usinas.controller.ts): não injeta @Req(), portanto cooperativaId do JWT nunca é extraído nem repassado ao service. Service (linhas 305-312 de monitoramento-usinas.service.ts): createConfig() chama prisma.usinaMonitoramentoConfig.create({ data: { usinaId, ...dataPreparada } }) sem nenhuma verificação prévia de posse da usina — não há findFirst com cooperativaId na tabela Usina. O global RolesGuard (roles.guard.ts linha 37) só valida user.perfil (ADMIN/SUPER_ADMIN), não isolamento de tenant. Resultado: um ADMIN de tenant A
- **Fix:** 1. No controller, injetar @Req() req: Request em createConfig, updateConfig e verificarAgora e passar req.user.cooperativaId para o service. 2. No service, adicionar verificação de posse antes de qualquer escrita: const usina = await this.prisma.usina.findFirst({ where: { id: usinaId, cooperativaId } }); if (!usina) throw new NotFoundException('Usina não encontrada'); — ignorar esse check quando o

### PATCH /monitoramento-usinas/:usinaId/config
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/monitoramento-usinas/monitoramento-usinas.service.ts:45-49 (controller) | 319-331 (service updateConfig)`
- **Query:** `prisma.usinaMonitoramentoConfig.update({ where: { usinaId }, data: dataPreparada }) — where contém apenas usinaId, sem cooperativaId`
- **Problema:** Controller `PATCH /monitoramento-usinas/:usinaId/config` (linha 45-49) exige apenas `@Roles(SUPER_ADMIN, ADMIN)` e repassa `usinaId` direto ao service sem extrair `cooperativaId` do JWT. O service `updateConfig` (linhas 319-331) executa `prisma.usinaMonitoramentoConfig.update({ where: { usinaId }, data: dataPreparada })` — o `where` contém exclusivamente `usinaId`, sem nenhum filtro de `cooperativaId`. O modelo `UsinaMonitoramentoConfig` tem campo `cooperativaId String?` mas ele nunca é incluído na cláusula de guarda. Não há verificação prévia de posse (`findFirst({ where: { usinaId, cooperati
- **Fix:** No service, antes do `prisma.usinaMonitoramentoConfig.update`, adicionar verificação de posse: (1) receber `cooperativaId` do JWT (passar como parâmetro pelo controller via `@Req() req` ou `@CurrentUser()`); (2) fazer `findFirst({ where: { usinaId, cooperativaId } })` e lançar `NotFoundException` se null (evita leak de existência de dados de outro tenant); (3) incluir `cooperativaId` no `where` do

### GET /monitoramento-usinas
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/monitoramento-usinas/monitoramento-usinas.service.ts:12-16 (controller) | 238-268 (service getStatusAtual)`
- **Query:** `prisma.usinaMonitoramentoConfig.findMany({ where: { habilitado: true } }) — sem cooperativaId; retorna todas as usinas habilitadas de todos os tenants`
- **Problema:** O endpoint GET /monitoramento-usinas permite que ADMIN e OPERADOR de qualquer tenant vejam dados de monitoramento de usinas de todos os outros tenants. O controller (linha 12-16 de monitoramento-usinas.controller.ts) define @Roles(SUPER_ADMIN, ADMIN, OPERADOR) mas nao extrai cooperativaId do JWT. O service getStatusAtual() (linhas 238-268 de monitoramento-usinas.service.ts) executa prisma.usinaMonitoramentoConfig.findMany({ where: { habilitado: true } }) sem nenhum filtro de cooperativaId, retornando configs de todos os tenants. O campo cooperativaId existe no modelo UsinaMonitoramentoConfig n
- **Fix:** No controller, adicionar @Request() req ao metodo getStatusAtual() e passar req.user.cooperativaId ao service. No service, adicionar o parametro cooperativaId: string e filtrar: prisma.usinaMonitoramentoConfig.findMany({ where: { habilitado: true, usina: { cooperativaId } } }) — usando a relacao usina para filtrar pelo cooperativaId da Usina, ou adicionando cooperativaId direto na UsinaMonitoramen

## MEDIO (8)

### GET /email/logs
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/email/email.service.ts:controller L40-43; service L267-278`
- **Query:** `prisma.emailLog.findMany({ orderBy: { criadoEm: 'desc' }, skip, take }) — sem cooperativaId`
- **Problema:** O endpoint GET /email/logs permite que qualquer ADMIN autenticado (perfil de tenant específico) leia logs de email de TODOS os tenants. Confirmado em duas camadas: (1) controller L40-43 em `email.controller.ts` permite @Roles ADMIN além de SUPER_ADMIN e não extrai cooperativaId do JWT; (2) service L267-278 em `email.service.ts` executa `prisma.emailLog.findMany({ orderBy: {...}, skip, take })` sem nenhum filtro de tenant. O model EmailLog no schema Prisma não possui campo cooperativaId (confirmado: campos são id, destinatario, assunto, status, tipo, erro, cooperadoId, valorExtraido, nomeRemete
- **Fix:** 1. Adicionar campo cooperativaId ao model EmailLog no schema Prisma: `cooperativaId String?` + relação com Cooperativa. Rodar `prisma db push` (dev) ou migration. 2. Atualizar o método privado `registrarLog` em `email.service.ts` para receber e persistir cooperativaId. 3. Atualizar `buscarLogs(page, limit, cooperativaId?: string)` para filtrar: se cooperativaId fornecido (ADMIN de tenant), adicion

### POST /email-monitor/processar
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/email-monitor/email-monitor.service.ts:controller L16-19; service L98-103`
- **Query:** `criarClientePorCooperativa: fallback para ENV se chaves do tenant ausentes (processarCaixaDeEntrada usa cooperativaId para filtrar cooperados e UCs, mas o própr`
- **Problema:** Vulnerabilidade real de isolamento multi-tenant confirmada em duas camadas. Controller (L17): `req.user?.cooperativaId` usa optional chaining — SUPER_ADMIN sem cooperativaId associado passa `undefined` para `processarManual`. RolesGuard (roles.guard.ts L35): SUPER_ADMIN bypassa qualquer verificação de perfil e chega ao handler sem restrição. Service `criarClientePorCooperativa` (L55-77): quando `cooperativaId` é `undefined`, o `findFirst({ where: { chave, cooperativaId: undefined } })` do Prisma ignora o filtro por tenant (Prisma descarta campos `undefined` no `where`), podendo retornar creden
- **Fix:** Três correções necessárias, em ordem de prioridade: (1) **Controller — validar cooperativaId obrigatório** (C:/Users/Luciano/cooperebr/backend/src/email-monitor/email-monitor.controller.ts L16-19): adicionar guard ou validação explícita — se `cooperativaId` for `undefined` (SUPER_ADMIN sem tenant), retornar `400 Bad Request` com mensagem "cooperativaId obrigatório para disparar monitor de e-mail m

### POST /whatsapp/listas/:id/usar
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/whatsapp/whatsapp-fatura.controller.ts:332`
- **Query:** `prisma.listaContatos.findUnique({ where: { id } })`
- **Problema:** IDOR real confirmado em ambas as camadas. O endpoint POST /whatsapp/listas/:id/usar (controller linha 330-335, arquivo C:/Users/Luciano/cooperebr/backend/src/whatsapp/whatsapp-fatura.controller.ts) executa `prisma.listaContatos.findUnique({ where: { id } })` sem qualquer filtro de cooperativaId. O decorator `@Roles(SUPER_ADMIN, ADMIN)` garante apenas autenticação e verificação de perfil — o RolesGuard (roles.guard.ts) não aplica nenhum isolamento de tenant. O handler não injeta `@Req()`, portanto o cooperativaId do JWT é completamente ignorado. O modelo ListaContatos tem o campo cooperativaId
- **Fix:** Injetar @Req() no handler e verificar posse antes de retornar dados. Substituir o findUnique por findFirst com filtro composto, ou fazer uma verificação prévia e retornar 404 se o tenant não bater. Exemplo mínimo: `async usarLista(@Param('id') id: string, @Req() req: any) { const cooperativaId = req.user?.cooperativaId; const perfil = req.user?.perfil; const where: any = { id }; if (perfil !== 'SU

### POST /whatsapp/modelos/:id/testar
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/whatsapp/whatsapp-fatura.controller.ts:495`
- **Query:** `prisma.modeloMensagem.findUnique({ where: { id } })`
- **Problema:** O endpoint POST /whatsapp/modelos/:id/testar (linha 490-499 de whatsapp-fatura.controller.ts) usa `prisma.modeloMensagem.findUnique({ where: { id } })` sem nenhum filtro de cooperativaId. O schema confirma que ModeloMensagem tem `cooperativaId String?` — ou seja, registros são tenant-scoped (cooperativaId preenchido) ou globais (null). Um ADMIN de tenant A pode fornecer o UUID de um modelo pertencente ao tenant B, ler seu conteúdo (`modelo.conteudo`), e em seguida disparar esse conteúdo via `WhatsAppSenderService.enviarMensagem(body.telefone, texto)` para qualquer número de telefone informado
- **Fix:** No controller, extrair cooperativaId do JWT e adicionar verificação de posse antes do disparo. Arquivo: C:/Users/Luciano/cooperebr/backend/src/whatsapp/whatsapp-fatura.controller.ts, linha 495. Substituir:
  const modelo = await this.prisma.modeloMensagem.findUnique({ where: { id } });
por:
  const cooperativaId = req.user?.cooperativaId;
  const modelo = await this.prisma.modeloMensagem.findFirst

### POST /monitoramento-usinas/:usinaId/verificar-agora
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/monitoramento-usinas/monitoramento-usinas.service.ts:51-55 (controller) | 334-346 (service verificarAgora)`
- **Query:** `prisma.usinaMonitoramentoConfig.findUnique({ where: { usinaId }, include: { usina: true } }) — sem cooperativaId; em seguida chama verificarUsina() que usa cred`
- **Problema:** IDOR confirmado em duas camadas. Controller (`monitoramento-usinas.controller.ts:51-55`) expõe POST `/monitoramento-usinas/:usinaId/verificar-agora` com `@Roles(SUPER_ADMIN, ADMIN, OPERADOR)` — ou seja, qualquer ADMIN ou OPERADOR autenticado pode chamar o endpoint. O service (`monitoramento-usinas.service.ts:334-346`) executa `prisma.usinaMonitoramentoConfig.findUnique({ where: { usinaId } })` sem nenhum filtro de `cooperativaId`. Não existe verificação prévia de posse (findFirst com id+cooperativaId), nem filtro no update. O `RolesGuard` apenas verifica perfil, não isola tenant. Não há middle
- **Fix:** No service, adicionar verificação de posse antes de executar a ação. Passar `cooperativaId` do JWT até o service e filtrar:

```typescript
// controller: injetar @Req() req e extrair cooperativaId
@Post(':usinaId/verificar-agora')
verificarAgora(@Param('usinaId') usinaId: string, @Req() req: any) {
  return this.service.verificarAgora(usinaId, req.user.cooperativaId, req.user.perfil);
}

// servic

### GET /monitoramento-usinas/:usinaId/historico
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/monitoramento-usinas/monitoramento-usinas.service.ts:18-25 (controller) | 270-276 (service getHistorico)`
- **Query:** `prisma.usinaLeitura.findMany({ where: { usinaId, timestamp: { gte: desde } } }) — sem cooperativaId`
- **Problema:** Confirmado em ambas as camadas. Controller em `monitoramento-usinas.controller.ts:18-25` passa `usinaId` diretamente do path param sem extrair `cooperativaId` do JWT. Service em `monitoramento-usinas.service.ts:270-276` executa `prisma.usinaLeitura.findMany({ where: { usinaId, timestamp: { gte: desde } } })` sem nenhum filtro de tenant. Roles `SUPER_ADMIN, ADMIN, OPERADOR` confirmam que qualquer usuário autenticado — inclusive ADMIN e OPERADOR de qualquer cooperativa — pode passar o UUID de uma usina de outro tenant e receber seu histórico completo de leituras de potência/energia. Não há verif
- **Fix:** No service, antes de retornar dados, verificar posse da usina pelo tenant do usuário autenticado. Passar `cooperativaId` do JWT para o método e adicionar verificação prévia: `const usina = await this.prisma.usina.findFirst({ where: { id: usinaId, cooperativaId } }); if (!usina) throw new NotFoundException();`. Depois manter a query de `usinaLeitura` como está. Alternativamente, fazer o join direto

### GET /monitoramento-usinas/:usinaId/alertas
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/monitoramento-usinas/monitoramento-usinas.service.ts:27-30 (controller) | 278-282 (service getAlertas)`
- **Query:** `prisma.usinaAlerta.findMany({ where: { usinaId } }) — sem cooperativaId`
- **Problema:** Confirmado nas duas camadas. Controller (linha 27-31, monitoramento-usinas.controller.ts): não extrai cooperativaId do JWT, passa apenas usinaId para o service. Service (linha 278-283, monitoramento-usinas.service.ts): executa prisma.usinaAlerta.findMany({ where: { usinaId } }) sem nenhum filtro de cooperativaId. Roles ADMIN e OPERADOR têm acesso — não é SUPER_ADMIN-only. UsinaAlerta tem campo cooperativaId no schema (linha 1134) e Usina tem cooperativaId (linha 375), mas nenhum dos dois é usado na query. Um ADMIN de tenant A pode fornecer o usinaId de qualquer usina de outro tenant e receber
- **Fix:** No controller, injetar Request e extrair cooperativaId do JWT para usuários não-SUPER_ADMIN, repassando ao service: @Get(':usinaId/alertas') getAlertas(@Param('usinaId') usinaId: string, @Req() req) { const cooperativaId = req.user.perfil === 'SUPER_ADMIN' ? undefined : req.user.cooperativaId; return this.service.getAlertas(usinaId, cooperativaId); }. No service, adicionar filtro de tenant: async

### GET /monitoramento-usinas/:usinaId/config
- **Service:** `C:/Users/Luciano/cooperebr/backend/src/monitoramento-usinas/monitoramento-usinas.service.ts:39-43 (controller) | 289-298 (service getConfig)`
- **Query:** `prisma.usinaMonitoramentoConfig.findUnique({ where: { usinaId } }) — sem cooperativaId; retorna sungrowUsuario, sungrowAppKey, sungrowPlantId (senha mascarada)`
- **Problema:** Vulnerabilidade confirmada lendo controller (linhas 39-43) e service (linhas 289-298). O controller extrai apenas `usinaId` do path param e não injeta `req.user` nem `cooperativaId`. O service faz `prisma.usinaMonitoramentoConfig.findUnique({ where: { usinaId } })` sem qualquer filtro de tenant. O schema confirma que `UsinaMonitoramentoConfig` possui campo `cooperativaId` (schema.prisma linha 1099) e `Usina` também tem `cooperativaId` (linha 375), mas nenhum dos dois é usado na query de leitura. O endpoint aceita roles SUPER_ADMIN, ADMIN e OPERADOR — portanto qualquer usuário autenticado de qu
- **Fix:** No controller, injetar `@Request() req` e extrair `cooperativaId` e `perfil` do JWT. No service, alterar `getConfig` para receber `cooperativaId` e `isSuperAdmin`: se SUPER_ADMIN, manter query atual; caso contrário, fazer `prisma.usinaMonitoramentoConfig.findFirst({ where: { usinaId, cooperativaId } })` (usando `findFirst` com filtro composto em vez de `findUnique`). Alternativamente, fazer join v
