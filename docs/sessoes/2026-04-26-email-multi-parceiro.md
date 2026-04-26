# Email multi-parceiro — arquitetura completa

**Data:** 2026-04-26
**Sprint:** 11 Dia 3 (paralelo à Fase D, antes de começar)

## Contexto

Cada parceiro do SISGD precisa ter:
1. Seu próprio email pra **receber faturas da concessionária** (IMAP)
2. Seu próprio email pra **enviar comunicados aos cooperados** (SMTP)

Antes desta sessão:
- `EmailService` lia direto de `process.env.EMAIL_*` (global, único pra todo o sistema)
- `email-monitor.service.ts` (IMAP) já lia de `ConfigTenant` com fallback `.env`
- Resultado: SMTP era global; IMAP era multi-tenant mas ainda não tinha UI nem endpoint

## Entregue nesta sessão

### Backend

**1. `EmailConfigService`** (`backend/src/email/email-config.service.ts`)
- Helper centralizado pra ler/escrever configs SMTP+IMAP por `cooperativaId`
- Tipos `SmtpConfig` e `ImapConfig` com flag `fonte: tenant | env | default`
- Fallback inteligente: se tenant não tem `host+user+pass`, cai no `.env`
- Senha armazenada em base64 (mesma convenção da CoopereVerde existente)
- Helper `tryDecodeBase64`: detecta heuristicamente se é base64 e decodifica; senão preserva
- Método `getConfigSeguro`: omite senhas, retorna `passDefinida: boolean`

**2. `EmailService` refatorado** (`backend/src/email/email.service.ts`)
- `enviarEmail(to, subject, html, text?, cooperativaId?)` — 5º parâmetro novo
- Cache de transporters por tenant (Map). Evita recriar `nodemailer.createTransport` a cada envio
- `invalidateTransporterCache(cooperativaId?)` — chamado após salvar config nova
- Métodos `enviarFatura`, `enviarBoasVindas` etc. propagam `cooperado.cooperativaId`
- Sem `cooperativaId` (chamadas de sistema): usa `.env` como antes

**3. `EmailConfigController`** (`backend/src/email/email-config.controller.ts`)
- `GET /configuracoes/email` — retorna SMTP+IMAP do tenant atual (sem senhas)
- `PUT /configuracoes/email/smtp` — atualiza SMTP. Senha vazia mantém atual.
- `PUT /configuracoes/email/imap` — atualiza IMAP
- `POST /configuracoes/email/testar-smtp` — envia email teste pro próprio admin
- `POST /configuracoes/email/testar-imap` — conecta IMAP e retorna pastas + total INBOX (não baixa nada)
- Roles: `SUPER_ADMIN`, `ADMIN`. Tenant-isolated: cada admin só edita configs da própria cooperativa

**4. Callers atualizados** — 7 invocações de `enviarEmail` agora propagam `cooperado.cooperativaId`:
- `cobrancas.job.ts:98` (lembretes D-3/D-1)
- `faturas.service.ts:826` (relatório mensal)
- `motor-proposta.job.ts:73` (lembrete proposta 24h)
- `motor-proposta.service.ts:868, 1361, 1471, 1569` (proposta aceita, análise docs, link assinatura, cópia assinada)

Selects do Prisma ajustados pra incluir `cooperativaId` quando faltava.

### Frontend

**`web/app/dashboard/configuracoes/email/page.tsx`** — tela admin com:
- 2 cards (SMTP + IMAP) com formulários completos
- Badge de fonte (tenant/env) — admin sabe se está usando config própria ou fallback global
- Indicador "passDefinida" — senha vazia não sobrescreve a atual
- Botão **Testar SMTP** com input pra destino opcional (default = email do admin)
- Botão **Testar IMAP** que retorna lista de pastas + total INBOX
- Caixa de instrução com link pra `myaccount.google.com/apppasswords` (App Password Google)
- Mensagens de erro/sucesso vinculadas a cada operação

### Testes

**14/14 passando** em `email-config.service.spec.ts`:
- Fallback `.env` quando sem `cooperativaId`
- Fonte `tenant` quando configs completas no banco
- Decodificação base64 da senha
- Senha não-base64 preservada como está
- `pass=''` não sobrescreve (mantém atual)
- `setSmtpConfig` parcial (só os campos enviados)
- `getConfigSeguro` omite senhas
- Isolamento entre tenants (cada `cooperativaId` consulta separado)

**Zero regressão**: 72/72 passando em todos os specs de email/faturas.

## Decisões técnicas

1. **Cache de transporter por tenant** — performance: criar `nodemailer.Transporter` é caro (handshake TLS). Cache evita recriação a cada envio. Invalidado quando admin salva config nova via endpoint.
2. **Senha em base64 (não criptografia forte)** — mesmo padrão usado na CoopereVerde antes desta sessão. Trade-off conhecido: protege contra olhar casual, não contra vazamento de banco. Migração futura pra `nestjs/config` + secrets manager fica como débito P2.
3. **Endpoint de teste manual** — `testar-smtp` e `testar-imap` permitem ao admin validar credenciais antes de operação real. `testar-smtp` reaproveita whitelist de dev (não envia pra externos em ambiente local sem autorização).
4. **`invalidateTransporterCache` explícito após PUT** — sem isso, próximo envio usaria transporter velho com credenciais antigas.

## TODO arquitetural — próximos sprints

- **Tenant resolver via JWT, não via parâmetro** — hoje cada caller passa `cooperativaId`. Alternativa: middleware injeta automaticamente via `req.user`. Reduz risco de esquecer.
- **Templates de email por parceiro** — hoje tudo usa `templateBoasVindas` etc. com texto "CoopereBR" hardcoded. Trocar por `{{nome_parceiro}}` resolvido via tenant.
- **Quotas de envio** — Gmail SMTP tem limite de 500/dia. Se um parceiro estourar, alertar admin antes que afete envios.
- **Criptografia real das senhas** — substituir base64 por libsodium ou similar.

## Estado da CoopereBR após esta sessão

```
ConfigTenant onde cooperativaId = cmn0ho8bx0000uox8wu96u6fd:

SMTP (envio):
  email.smtp.host = smtp.gmail.com
  email.smtp.port = 465
  email.smtp.secure = true
  email.smtp.user = contato@cooperebr.com.br
  email.smtp.pass = *** (24 chars b64)
  email.smtp.from = CoopereBR <contato@cooperebr.com.br>

IMAP (recebimento — busca faturas EDP):
  email.monitor.host = imap.gmail.com
  email.monitor.port = 993
  email.monitor.user = contato@cooperebr.com.br
  email.monitor.pass = *** (28 chars b64)
  email.monitor.ativo = true
```

`fonte = tenant` em ambos. Próximo envio/busca usa essas configs (não cai mais no `.env`).

## Validação imediata sugerida

1. `pm2 restart cooperebr-backend` (carrega controller + módulo novo)
2. Frontend: acessar `/dashboard/configuracoes/email` logado como admin CoopereBR
3. Verificar que campos vêm preenchidos corretamente
4. Clicar **Testar envio** → email teste pra `lucbragatto@gmail.com` (admin atual)
5. Clicar **Testar conexão** → ver lista de pastas + total INBOX
