# Inventário de Secrets — SISGD/CoopereBR

Catálogo de secrets do projeto pra visibilidade + auditoria + rotação
periódica. **NUNCA contém valores** — apenas metadados (existência, data,
owner, status, plano de rotação). Política de secrets em
[`docs/seguranca/regra-secrets-nao-memorizar.md`](./regra-secrets-nao-memorizar.md).

## Convenções

- **Cadência de rotação:** recomendação geral é rotacionar chaves master
  a cada **12 meses** ou imediatamente após qualquer suspeita de exposição.
- **Backups offline:** owner mantém **2 cópias offline** em mídias
  distintas (recomendação: papel num cofre + gerenciador de senhas
  local). Quando não houver gerenciador instalado ainda, 2 cópias em
  PAPEL em locais físicos distintos é mitigação aceita — ver D-novo-AK
  pra instalar gerenciador. Mais nenhuma cópia além do `.env` do servidor.
- **Rotação de chave de encryption** (ex: `GATEWAY_ENCRYPT_KEY`): exige
  re-encriptar TODOS os dados encrypted com a chave nova antes de
  descartar a antiga. Procedimento delicado — fazer com janela de
  manutenção e backup completo do banco antes.
- **Confirmação visual sem expor valor:** ao precisar verificar "essa é a
  chave certa?", usar tamanho + sufixo curto via
  `awk -F= '{print length($2)" chars, sufixo ****"substr($2,length($2)-3)}'`
  (4 chars finais não permitem reconstruir a chave).

## Inventário

| Nome | Tipo | Onde mora | Criado em | Owner | Backups offline | Cadência rotação | Próxima revisão | Status | Notas |
|---|---|---|---|---|---|---|---|---|---|
| `GATEWAY_ENCRYPT_KEY` | Chave master AES-256-GCM (32 bytes base64) | `.env` backend | 2026-05-26 | Luciano | ✅ 2 cópias em PAPEL (locais físicos distintos) | 12 meses | 2027-05-26 | 🟢 ativo | Criada pra Sub-Sprint Gateways de Pagamento Fatia F2. Encripta credenciais de gateways no `ConfigGateway.credenciais.__enc`. Perda = **R2 catastrófico** (todos gateways ilegíveis). Gerada com `openssl rand -base64 32`. Backup em gerenciador de senhas pendente — **D-novo-AK** catalogado pra instalar Bitwarden (ou similar) e migrar entrada. |
| `ASAAS_ENCRYPT_KEY` | Chave master AES-256-GCM (uso legado) | `.env` backend | desconhecido (anterior a 26/05/2026) | a confirmar | ❌ a auditar | a definir | **PRIORITÁRIO** — sessão dedicada D-novo-AJ.1 | 🟡 auditar | Usada por `AsaasService.encrypt/decrypt`. **Achado 26/05:** valor atual no `.env` tem 31 chars + sufixo `_key` — formato sugere placeholder textual, NÃO chave de 32 bytes. Pode ter sido configurada como string genérica e nunca rotacionada formalmente. Encripta `AsaasConfig.apiKey` de tenants reais. |
| `ASAAS_API_KEY` CoopereBR sandbox | API Key de gateway externo | `AsaasConfig.apiKey` (encrypted via `ASAAS_ENCRYPT_KEY`) | 2026-03-23 | Luciano | N/A (regenerável no portal Asaas) | conforme política Asaas | a revisar | 🟢 ativo | Sufixo `****dfe8` pra confirmação visual sem expor valor. Validada via webhook sandbox em 27/04/2026 (Sprint 12). Há divergência catalogada: `ConfigGateway.credenciais.apiKey` tem sufixo `****2776` em texto puro — Fatia F2 vai resolver com dual-write. |
| `ASAAS_WEBHOOK_TOKEN` | Token HMAC de webhook | `.env` backend | desconhecido | a confirmar | ❌ a auditar | a definir | 🟡 auditar | Configurar no painel Asaas e gravar em `AsaasConfig.webhookToken` por tenant (atualmente também aceita do `.env`). |
| `JWT_SECRET` | Secret de assinatura JWT | `.env` backend | desconhecido | a confirmar | ❌ a auditar | 6 meses (recomendação) | **PRIORITÁRIO** — auditar com `ASAAS_ENCRYPT_KEY` | 🟡 auditar | Assina tokens de sessão do app inteiro. Rotacionar invalida todos os tokens ativos (logout forçado de todos). |
| `SUPER_ADMIN_SECRET_KEY` | Secret pra criar SUPER_ADMIN | `.env` backend | desconhecido | a confirmar | ❌ a auditar | 12 meses | a auditar | Usada por endpoint protegido de criação de SUPER_ADMIN. |
| `SUPABASE_SERVICE_KEY` | Chave admin Supabase | `.env` backend | conforme provisão Supabase | a confirmar | ❌ a auditar | conforme política Supabase | a auditar | Acesso administrativo total ao banco — exposição = comprometimento total. |
| `BANESTES_PFX_SENHA` sandbox | Senha de certificado `.pfx` | `.env` backend (legado) **→** `ConfigGateway` após F3 | a definir | Luciano | a definir | conforme renovação cert Banestes (anual) | a definir | ⏳ pendente | Luciano vai obter no portal Banestes Developers. Fatia F3 já refatorou o `BanestesConfigService` pra ler de `ConfigGateway` — variáveis BANESTES_* marcadas `@deprecated` no `.env.example`. |
| `BANESTES_CLIENT_SECRET` sandbox | OAuth client secret | `.env` backend (legado) **→** `ConfigGateway` após F3 | a definir | Luciano | a definir | conforme política Banestes | a definir | ⏳ pendente | Idem acima. |
| `BANESTES_CLIENT_ID` sandbox | OAuth client_id | `.env` backend (legado) **→** `ConfigGateway` após F3 | a definir | Luciano | N/A (não-secret rigoroso mas tratamos como tal por defesa em profundidade) | conforme política Banestes | a definir | ⏳ pendente |
| `WHATSAPP_WEBHOOK_SECRET` | Secret entre backend e whatsapp-service | `.env` ambos serviços | desconhecido | a confirmar | ❌ a auditar | a definir | 🟡 auditar | Deve ser igual nos 2 serviços pra autenticação inter-process. |
| `EMAIL_PASS` SMTP CoopereBR | Senha de app SMTP | `.env` backend | desconhecido | Luciano | a confirmar | conforme política Gmail | a auditar | 🟡 auditar | Conta `contato@cooperebr.com` no Gmail. Senha de app (não senha do Gmail). |
| `IMAP_PASS` CoopereBR | Senha de app IMAP | `.env` backend | desconhecido | Luciano | a confirmar | conforme política Gmail | a auditar | 🟡 auditar | Conta `contato@cooperebr.com`. Pipeline OCR de faturas concessionária. |
| `ANTHROPIC_API_KEY` | API Key Claude | `.env` backend | desconhecido | Luciano | ❌ a auditar | conforme política Anthropic | a auditar | 🟡 auditar | Usada pelo `CoopereAI` bot + OCR de faturas (Claude). |
| `DATABASE_URL` + `DIRECT_URL` | Connection string Postgres Supabase | `.env` backend | conforme provisão Supabase | Luciano | inclusas no painel Supabase | conforme rotação senha DB | a auditar | 🟡 auditar | Contém senha do Postgres. Vazamento = acesso total ao banco. |

## Próximas entradas (a preencher conforme aparecer)

- `BANESTES_PFX_SENHA` produção — quando Luciano rotacionar o `.pfx` de
  produção do legado (que foi vazado no Git SISGDSOLAR)
- `BANESTES_CLIENT_SECRET` produção — idem
- Eventuais Sicoob/BB/outros gateways quando adapters reais existirem
- Eventuais credenciais Azure Key Vault quando Sinergia entrar (D-novo-AG
  + D-novo-AI futuro)

## Como atualizar este inventário

1. **Toda vez que um secret novo for criado, configurado ou rotacionado**
   no sistema, adicionar/atualizar linha aqui SEM o valor.
2. **Owner do secret** é responsável por manter os backups offline em 2
   lugares distintos.
3. **Cadência de revisão geral:** trimestral (ver `D-novo-AJ` em
   `docs/debitos-tecnicos.md`).
4. **Triggers de rotação ad-hoc:**
   - Suspeita de exposição → rotação imediata
   - Saída de membro do time → revisar quais secrets ele conhecia
   - Onboarding de novo parceiro real → revisar policy de backup com ele

## Status do inventário

**Última auditoria completa:** 2026-05-26 (criação inicial). Achados:

- 1 secret com backup offline confirmado (`GATEWAY_ENCRYPT_KEY`)
- 10+ secrets em estado 🟡 "auditar" — sem confirmação formal de backup
  offline. Maioria pre-existente, configurada antes desta política
  existir.
- `ASAAS_ENCRYPT_KEY` em estado suspeito: 31 chars com sufixo `_key` no
  `.env` sugere placeholder textual, não chave AES-256 (que seria 32
  bytes hex/base64 = 44 ou 64 chars). **Risco: dados criptografados em
  `AsaasConfig.apiKey` (sufixo `****dfe8`, 390 chars no DB) podem estar
  encrypted com uma chave que não respeita o tamanho ideal.** Catalogado
  como D-novo-AJ.1 — sessão dedicada pra rotacionar com backup adequado.

## Lições aprendidas

- **Sistema legado SISGDSOLAR (24-25/05/2026):** 5 `.pfx` de produção +
  senha master Azure SQL em texto puro foram commitados no Git por
  falta de inventário/política. Resultado: rotação forçada de tudo.
  Este inventário existe pra não repetirmos.

- **GATEWAY_ENCRYPT_KEY (26/05/2026):** primeira chave master criada SOB
  a política `regra-secrets-nao-memorizar.md`. Modelo de referência pra
  rotações futuras (gerar com `openssl rand -base64 32`, anotar
  imediatamente em backup offline, único registro permanente é o `.env`
  do servidor). Mitigação real do dia: 2 cópias em PAPEL em locais
  físicos distintos enquanto Luciano não instala gerenciador de senhas
  (D-novo-AK).
