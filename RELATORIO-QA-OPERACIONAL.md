# RELATÓRIO DE QA — MÓDULO OPERACIONAL

**Projeto:** COOPERE-BR
**Data:** 2026-03-20
**Módulos analisados:** Notificações, Ocorrências, Documentos, Auth, Config-Tenant, Facial
**Arquivos analisados:** 25+

---

## 1. BUGS IDENTIFICADOS

### BUG-OP-001 — Registro público permite criar ADMIN/SUPER_ADMIN
- **Arquivo:** `backend/src/auth/auth.controller.ts:11-25`
- **Severidade:** CRÍTICA
- **Descrição:** O endpoint `POST /auth/register` é `@Public()` e aceita `perfil` no body. Qualquer pessoa pode se registrar como `SUPER_ADMIN` ou `ADMIN` enviando `{ perfil: "SUPER_ADMIN" }`. Embora o service aplique `?? COOPERADO` como default (auth.service.ts:64), se o campo for enviado, o valor é aceito sem validação.
- **Impacto:** Escalação de privilégios total — atacante obtém acesso administrativo completo.

### BUG-OP-002 — JWT secret hardcoded "changeme"
- **Arquivo:** `backend/src/auth/auth.module.ts:14`, `backend/src/auth/jwt.strategy.ts:12`
- **Severidade:** CRÍTICA
- **Descrição:** O fallback `process.env.JWT_SECRET ?? 'changeme'` aparece em dois lugares. Se a variável de ambiente não estiver definida, todos os tokens são assinados com segredo previsível. Um atacante pode forjar tokens JWT arbitrários.
- **Impacto:** Bypass completo de autenticação.

### BUG-OP-003 — marcarComoLida sem verificação de propriedade
- **Arquivo:** `backend/src/notificacoes/notificacoes.service.ts:43-47`, `notificacoes.controller.ts:25-28`
- **Severidade:** MÉDIA
- **Descrição:** O endpoint `PATCH /notificacoes/:id/ler` não verifica se a notificação pertence ao usuário autenticado. Qualquer usuário autenticado pode marcar qualquer notificação como lida, bastando conhecer o ID.
- **Impacto:** Manipulação de estado de notificações alheias; em cenário adverso, um cooperado pode silenciar alertas de outro.

### BUG-OP-004 — Cooperado acessando ocorrências de outros cooperados
- **Arquivo:** `backend/src/ocorrencias/ocorrencias.controller.ts:18-28`
- **Severidade:** MÉDIA
- **Descrição:** Os endpoints `GET /ocorrencias/:id` e `GET /ocorrencias/cooperado/:cooperadoId` são acessíveis por `COOPERADO`, mas não validam se o cooperado autenticado é dono da ocorrência/cooperadoId consultado. Um cooperado pode ver ocorrências de qualquer outro.
- **Impacto:** Vazamento de dados entre cooperados.

### BUG-OP-005 — Cooperado pode criar ocorrência em nome de outro
- **Arquivo:** `backend/src/ocorrencias/ocorrencias.controller.ts:31-43`
- **Severidade:** MÉDIA
- **Descrição:** O `POST /ocorrencias` aceita `cooperadoId` no body sem validar que é o mesmo do usuário autenticado. Um cooperado pode forjar ocorrências em nome de outro.
- **Impacto:** Spoofing de identidade em ocorrências.

### BUG-OP-006 — Dummy where `{ id: '__none__' }` para cooperado não encontrado
- **Arquivo:** `backend/src/notificacoes/notificacoes.service.ts:69-70`
- **Severidade:** BAIXA
- **Descrição:** Quando um COOPERADO autenticado não tem registro na tabela `cooperado`, o filtro retorna `{ id: '__none__' }`. Se um CUID legítimo fosse `__none__` (improvável mas tecnicamente possível), retornaria dados indevidos. O correto é retornar `{ id: { equals: undefined } }` ou lançar exceção.
- **Impacto:** Baixo risco real, mas padrão frágil.

### BUG-OP-007 — Conflito de rotas: `GET /ocorrencias/cooperado/:cooperadoId` vs `GET /ocorrencias/:id`
- **Arquivo:** `backend/src/ocorrencias/ocorrencias.controller.ts:19-28`
- **Severidade:** BAIXA
- **Descrição:** A rota `GET /ocorrencias/cooperado/:cooperadoId` deve vir ANTES de `GET /ocorrencias/:id` para não ser engolida pelo parâmetro `:id`. O NestJS resolve na ordem de declaração, e aqui `findOne` (linha 19) vem antes de `findByCooperado` (linha 24). Uma chamada a `GET /ocorrencias/cooperado` pode cair em `findOne(id='cooperado')`.
- **Impacto:** Requisições `GET /ocorrencias/cooperado/xxx` retornam `null` em vez da lista de ocorrências.

### BUG-OP-008 — Upload sem validação de tipo/tamanho de arquivo
- **Arquivo:** `backend/src/documentos/documentos.service.ts:90-99`
- **Severidade:** MÉDIA
- **Descrição:** O upload de documentos aceita qualquer tipo de arquivo e qualquer tamanho. Não há filtro por mimetype (ex: apenas PDF, JPG, PNG) nem limite de tamanho (o Multer está configurado com `memoryStorage` sem `limits` em documentos.module.ts).
- **Impacto:** Upload de arquivos executáveis, DoS por upload de arquivos gigantes.

### BUG-OP-009 — `tipo as any` no Prisma sem validação contra enum
- **Arquivo:** `backend/src/documentos/documentos.service.ts:105,114`
- **Severidade:** BAIXA
- **Descrição:** O tipo do documento é aceito como `string` e convertido via `as any` para o Prisma. Se um valor fora do enum `TipoDocumento` for enviado, o Prisma lança erro de banco não tratado (500 genérico).
- **Impacto:** Erro 500 não amigável; bypass do constraint unique `[cooperadoId, tipo]` com valores inválidos.

### BUG-OP-010 — Facial: URL parsing frágil para download de foto
- **Arquivo:** `backend/src/auth/facial/facial.service.ts:71`
- **Severidade:** MÉDIA
- **Descrição:** O código faz `usuario.fotoFacialUrl.split('/fotos-faciais/')[1]` para extrair o path do storage. Se o formato da URL do Supabase mudar ou contiver `/fotos-faciais/` em outra parte, o parsing falha silenciosamente.
- **Impacto:** Falha na verificação facial sem mensagem de erro clara.

### BUG-OP-011 — Facial: threshold 0.6 é inseguro para reconhecimento facial
- **Arquivo:** `backend/src/auth/facial/facial.service.ts:88`
- **Severidade:** ALTA
- **Descrição:** O algoritmo compara imagens por distância euclidiana de pixels normalizados (64x64 grayscale), não usa detecção de face real nem embeddings neurais. O threshold de 0.6 nesse método é extremamente permissivo — duas fotos genéricas de rosto podem facilmente atingir 60% de similaridade pixel-a-pixel.
- **Impacto:** Autenticação facial bypassável com foto genérica; falso positivo muito alto.

### BUG-OP-012 — Prioridade "CRITICA" ausente no formulário de nova ocorrência
- **Arquivo:** `web/app/dashboard/ocorrencias/nova/page.tsx:29-33`
- **Severidade:** BAIXA
- **Descrição:** O array `PRIORIDADES` lista apenas `ALTA`, `MEDIA` e `BAIXA`. O enum no backend e no Prisma inclui `CRITICA`, mas o frontend não permite selecioná-la na criação.
- **Impacto:** Impossível criar ocorrência com prioridade CRITICA pelo frontend.

### BUG-OP-013 — `GET /config-tenant/:chave` retorna `null` sem 404
- **Arquivo:** `backend/src/config-tenant/config-tenant.service.ts:14-16`
- **Severidade:** BAIXA
- **Descrição:** Quando uma chave não existe, o endpoint retorna `null` com status 200 em vez de 404. O consumidor precisa verificar se o body é null.
- **Impacto:** Comportamento inesperado para clientes da API; dificulta debugging.

---

## 2. DADOS AUSENTES

### DA-OP-001 — Notificação sem campo `destinatarioId` explícito
- **Arquivo:** `backend/prisma/schema.prisma:312-326`
- **Descrição:** O modelo `Notificacao` tem `cooperadoId` e `adminId` opcionais, mas não há garantia de que pelo menos um está preenchido. Uma notificação pode ser criada sem destinatário (ambos `null`), ficando "órfã" no filtro admin (`adminId: null` aparece para TODOS os admins).

### DA-OP-002 — Ocorrência sem campo `resolvidoPor` e `dataResolucao`
- **Arquivo:** `backend/prisma/schema.prisma:247-262`
- **Descrição:** O modelo `Ocorrencia` tem `resolucao` (texto) mas não registra quem resolveu nem quando foi resolvida. O `updatedAt` serve como proxy, mas é atualizado em qualquer mudança (ex: mudança de prioridade).

### DA-OP-003 — DocumentoCooperado sem campo `aprovadoPor`
- **Arquivo:** `backend/prisma/schema.prisma:62-77`
- **Descrição:** Quando um documento é aprovado/reprovado, não há registro de qual operador/admin tomou a ação. Importante para auditoria.

### DA-OP-004 — Ocorrência sem histórico de mudanças de status
- **Arquivo:** `backend/src/ocorrencias/ocorrencias.service.ts:40-48`
- **Descrição:** O `update` sobrescreve campos diretamente. Não há log de transição de status (ex: ABERTA → EM_ANDAMENTO → RESOLVIDA) com timestamps e responsável.

### DA-OP-005 — ConfigTenant sem `alteradoPor`
- **Arquivo:** `backend/prisma/schema.prisma:328-337`
- **Descrição:** Configurações do tenant podem ser alteradas sem registro de quem fez a alteração. Para um sistema multi-admin, falta auditoria.

### DA-OP-006 — Usuario sem campo `ativo`/`bloqueado`
- **Arquivo:** `backend/prisma/schema.prisma:11-24`
- **Descrição:** Não há flag para desabilitar login de um usuário sem deletá-lo do banco. Não é possível suspender um operador que saiu da cooperativa.

### DA-OP-007 — Notificações sem tipo para Ocorrência
- **Arquivo:** `backend/src/ocorrencias/ocorrencias.service.ts`
- **Descrição:** Ao criar ou atualizar uma ocorrência, nenhuma notificação é disparada. O cooperado não é notificado quando sua ocorrência muda de status, e admins não são alertados de novas ocorrências.

### DA-OP-008 — Facial DTOs sem validação
- **Arquivo:** `backend/src/auth/facial/dto/cadastrar-facial.dto.ts`, `verificar-facial.dto.ts`
- **Descrição:** Os DTOs não usam decorators de validação (`@IsString`, `@IsNotEmpty`, `@IsUUID`). Um body vazio ou com campos errados não é rejeitado antes de chegar ao service.

---

## 3. REGRAS DE NEGÓCIO AUSENTES

### RN-OP-001 — Sem rate limiting em endpoints de autenticação
- **Arquivo:** `backend/src/auth/auth.controller.ts`
- **Descrição:** Os endpoints `POST /auth/login` e `POST /auth/register` não têm rate limiting. Permite ataques de brute-force de senha e criação em massa de contas.

### RN-OP-002 — Sem fluxo de "esqueci minha senha"
- **Arquivo:** `backend/src/auth/`
- **Descrição:** Não existe endpoint de recuperação de senha. Um cooperado que esqueça a senha fica completamente travado.

### RN-OP-003 — Sem validação de formato de CPF/email/telefone no registro
- **Arquivo:** `backend/src/auth/auth.service.ts:24-34`
- **Descrição:** O registro aceita qualquer string como CPF ou telefone. Não valida formato (11 dígitos para CPF, dígito verificador, formato de telefone).

### RN-OP-004 — Sem SLA/tempo máximo para resolução de ocorrências
- **Arquivo:** `backend/src/ocorrencias/`
- **Descrição:** Ocorrências não têm prazo para resolução baseado na prioridade (ex: CRITICA = 4h, ALTA = 24h). Não há alerta de SLA estourado.

### RN-OP-005 — Sem workflow de transição de status em ocorrências
- **Arquivo:** `backend/src/ocorrencias/ocorrencias.service.ts:40-48`
- **Descrição:** Qualquer transição de status é permitida (ex: CANCELADA → ABERTA, RESOLVIDA → ABERTA). Não há máquina de estados validando transições.

### RN-OP-006 — Sem limpeza/expiração de notificações antigas
- **Arquivo:** `backend/src/notificacoes/notificacoes.service.ts`
- **Descrição:** Notificações acumulam indefinidamente. O backend limita a 50 por query (`take: 50`), mas não há job para arquivar ou excluir notificações antigas (ex: > 90 dias).

### RN-OP-007 — Sem notificação ao cooperado quando ocorrência muda de status
- **Arquivo:** `backend/src/ocorrencias/ocorrencias.service.ts:40-48`
- **Descrição:** Quando um operador atualiza uma ocorrência para RESOLVIDA ou EM_ANDAMENTO, o cooperado não recebe notificação. O cooperado só descobre checando manualmente.

### RN-OP-008 — Cooperado não pode fazer upload de seus próprios documentos
- **Arquivo:** `backend/src/documentos/documentos.controller.ts:12`
- **Descrição:** O controller de documentos restringe TODAS as rotas a `ADMIN` e `OPERADOR` (decorator de classe, linha 12). O cooperado não consegue enviar seus próprios documentos (RG, CNH, etc.) — depende de um admin fazer upload para ele.

### RN-OP-009 — Sem validação de complexidade de senha
- **Arquivo:** `backend/src/auth/auth.service.ts:24-30`
- **Descrição:** A senha é passada diretamente ao Supabase sem validar comprimento mínimo, caracteres especiais, etc. O Supabase tem regras próprias, mas o backend não valida antes.

### RN-OP-010 — Sem refresh token / renovação de sessão
- **Arquivo:** `backend/src/auth/auth.service.ts:114-116`, `web/lib/auth.ts`
- **Descrição:** O JWT expira em 7 dias e não há mecanismo de refresh. Após 7 dias, o usuário é deslogado abruptamente sem aviso.

### RN-OP-011 — Sem logout no backend
- **Arquivo:** `backend/src/auth/auth.controller.ts`
- **Descrição:** O logout é apenas client-side (remoção de cookie em `web/lib/auth.ts:15-18`). O token JWT continua válido até expirar. Não há blacklist de tokens.

### RN-OP-012 — Facial sem anti-spoofing
- **Arquivo:** `backend/src/auth/facial/facial.service.ts`
- **Descrição:** A verificação facial compara pixels sem liveness detection. Uma foto impressa ou na tela do celular passaria na verificação.

---

## 4. REGRAS DE NEGÓCIO DEFEITUOSAS

### RD-OP-001 — Filtro de notificações admin mostra notificações de cooperado sem adminId
- **Arquivo:** `backend/src/notificacoes/notificacoes.service.ts:60-63`
- **Descrição:** O `buildWhere` para admins retorna `OR: [{ adminId: null }, { adminId: user.id }]`. Notificações criadas para cooperados com `adminId: null` (que são a maioria — ex: DOCUMENTO_APROVADO) também aparecem para admins. Isso mistura notificações destinadas a cooperados na inbox do admin.
- **Impacto:** Admins veem notificações irrelevantes como "Seu documento RG foi aprovado" — que deveriam ser exclusivas do cooperado.

### RD-OP-002 — Notificação NOVO_DOCUMENTO enviada ao cooperado, não ao admin
- **Arquivo:** `backend/src/documentos/documentos.service.ts:117-123`
- **Descrição:** Quando um documento é enviado (pelo admin, inclusive), a notificação é criada com `cooperadoId` — ou seja, é enviada ao cooperado. Deveria alertar os admins que um novo documento está pendente de aprovação.
- **Impacto:** Admins não são notificados de documentos pendentes; cooperado recebe notificação desnecessária de upload feito pelo admin.

### RD-OP-003 — Verificação facial por pixels não é reconhecimento facial
- **Arquivo:** `backend/src/auth/facial/facial.service.ts:82-90`
- **Descrição:** O algoritmo reduz a imagem a 64x64 grayscale e compara distância euclidiana de pixels normalizados. Isso não é reconhecimento facial — é comparação de histograma de brilho. Variações de iluminação, ângulo, ou enquadramento podem causar falha mesmo com a pessoa correta, enquanto fotos similares de pessoas diferentes podem passar.
- **Impacto:** Feature de segurança que dá falsa sensação de proteção mas não fornece segurança real.

### RD-OP-004 — Notificação de documento aprovado/reprovado com link para página de admin
- **Arquivo:** `backend/src/documentos/documentos.service.ts:59,84`
- **Descrição:** O link nas notificações de documento aprovado/reprovado aponta para `/dashboard/cooperados/${cooperadoId}`, que é uma página administrativa. Se o cooperado clicar, acessará uma página que pode não ter permissão para ver (ou que mostra dados de forma não ideal para ele).

### RD-OP-005 — `remove` de config-tenant sem proteção contra chaves críticas
- **Arquivo:** `backend/src/config-tenant/config-tenant.service.ts:27-29`
- **Descrição:** Qualquer ADMIN pode deletar qualquer config do tenant, incluindo chaves críticas do sistema. Não há proteção contra remoção acidental de configurações essenciais.

---

## 5. MELHORIAS

### ML-OP-001 — Paginação no backend para ocorrências
- **Arquivo:** `backend/src/ocorrencias/ocorrencias.service.ts:8-12`
- **Descrição:** `findAll()` retorna TODAS as ocorrências com relations incluídas. Para cooperativas com centenas de ocorrências, isso impacta performance. Implementar `skip/take` com parâmetros de query.

### ML-OP-002 — Filtros na listagem de ocorrências (frontend)
- **Arquivo:** `web/app/dashboard/ocorrencias/page.tsx`
- **Descrição:** A listagem não oferece filtros por status, prioridade, tipo ou data. Operadores precisam percorrer toda a lista manualmente.

### ML-OP-003 — Feedback visual de erros mais específico no login
- **Arquivo:** `web/app/login/page.tsx:26`
- **Descrição:** Todos os erros de login mostram a mesma mensagem genérica. Diferenciar "usuário não encontrado" de "senha incorreta" (respeitando boas práticas de segurança, mantendo mensagem genérica é aceitável).

### ML-OP-004 — Uso de DTOs com class-validator no backend
- **Arquivo:** Todos os controllers do módulo operacional
- **Descrição:** Nenhum controller usa DTOs com decorators `class-validator`. Bodies são tipados inline como interfaces TypeScript, que não validam em runtime. Implementar `ValidationPipe` + DTOs com `@IsString()`, `@IsEnum()`, `@MinLength()` etc.

### ML-OP-005 — Extrair clients Supabase para um serviço compartilhado
- **Arquivo:** `backend/src/auth/auth.service.ts:14-17`, `backend/src/documentos/documentos.service.ts:32-35`, `backend/src/auth/facial/facial.service.ts:20-23`
- **Descrição:** O `createClient()` do Supabase é instanciado em 3 services diferentes. Deveria ser um `SupabaseService` injetável único.

### ML-OP-006 — Painel de ocorrências com indicadores (dashboard)
- **Arquivo:** `web/app/dashboard/ocorrencias/page.tsx`
- **Descrição:** A página lista ocorrências em tabela sem resumo executivo. Cards de resumo (total aberta, por prioridade, SLA estourado) ajudariam na gestão.

### ML-OP-007 — Página de configurações do tenant no frontend
- **Arquivo:** Frontend (não existe)
- **Descrição:** O backend tem CRUD completo de `config-tenant`, mas não existe interface no frontend para gerenciar. Admins precisariam usar API diretamente.

### ML-OP-008 — Notificações em tempo real (WebSocket/SSE)
- **Arquivo:** `web/app/dashboard/notificacoes/page.tsx`
- **Descrição:** Notificações são carregadas por polling manual (reload da página). Não há mecanismo push para alertar em tempo real.

### ML-OP-009 — Token armazenado em cookie sem httpOnly
- **Arquivo:** `web/lib/auth.ts:11`
- **Descrição:** O token JWT é salvo com `js-cookie` (cookie acessível via JavaScript). Um ataque XSS pode roubar o token. Deveria usar cookie `httpOnly` setado pelo backend.

### ML-OP-010 — Ocorrência sem anexo de evidências
- **Arquivo:** `backend/prisma/schema.prisma:247-262`
- **Descrição:** O modelo `Ocorrencia` não permite anexar fotos, prints ou documentos como evidência. Cooperados relatando problemas de medição ou fatura precisam descrever textualmente.

---

## 6. RESUMO EXECUTIVO — TOP 5 PRIORIDADES

| # | Item | Severidade | Módulo | Impacto |
|---|------|-----------|--------|---------|
| 1 | **BUG-OP-001** — Registro público permite criar SUPER_ADMIN | CRÍTICA | Auth | Qualquer pessoa na internet pode obter acesso administrativo completo ao sistema. Correção: validar que `@Public` register só permite `COOPERADO`, ou remover `perfil` do body público. |
| 2 | **BUG-OP-002** — JWT secret "changeme" hardcoded | CRÍTICA | Auth | Se `JWT_SECRET` não estiver no env, tokens podem ser forjados. Correção: lançar erro na inicialização se `JWT_SECRET` não estiver definido — nunca usar fallback. |
| 3 | **RN-OP-008** — Cooperado não pode enviar próprios documentos | ALTA | Documentos | O fluxo fundamental de onboarding está quebrado — cooperado depende de admin para upload de RG/CNH. Correção: adicionar rota `@Roles(COOPERADO)` para upload próprio com validação de `cooperadoId`. |
| 4 | **RD-OP-001/002** — Notificações com destinatários trocados | ALTA | Notificações | Admins veem notificações de cooperados; cooperado recebe alerta de upload feito pelo admin; admin não é avisado de documentos pendentes. Correção: separar lógica de destinatário e adicionar notificação admin-only para documentos pendentes. |
| 5 | **BUG-OP-004/005** — Cooperado acessa/cria ocorrências de outros | MÉDIA | Ocorrências | Vazamento de dados entre cooperados e spoofing de identidade. Correção: validar `cooperadoId` no controller contra o usuário autenticado. |

---

*Relatório gerado automaticamente em 2026-03-20. Nenhuma alteração foi feita no código.*
