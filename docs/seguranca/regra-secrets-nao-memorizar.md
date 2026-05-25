# Regra inegociável — agentes NUNCA memorizam secrets

> Catalogada em 26/05/2026 a partir de decisão Luciano, durante geração da
> `GATEWAY_ENCRYPT_KEY` no Sub-Sprint Gateways de Pagamento Fatia F2.

## Política

Nenhum agente que trabalha neste repo (orquestrador claude.ai, Claude
Code no VS Code, Cowork, sub-agents project-specific, agentes futuros)
deve **copiar, persistir, repetir ou referenciar VALORES de**:

- Chaves master de encryption (`GATEWAY_ENCRYPT_KEY`, `ASAAS_ENCRYPT_KEY`,
  futuras chaves master)
- Senhas de certificados `.pfx` (`BANESTES_PFX_SENHA`, etc)
- API Keys de gateways (Asaas, Banestes `CLIENT_ID/SECRET`, etc)
- Tokens (JWT secrets, webhook tokens, OAuth tokens, etc)
- Senhas de bancos de dados ou usuários administrativos
- Conteúdo de arquivos `.env` em qualquer ambiente
- Qualquer credencial sensível em geral

**Não em memórias persistentes. Não em prompts. Não em mensagens de
chat. Não em docs deste repo. Não em commits. Não em logs visíveis.**

## Forma correta

Sempre referenciar via env var pelo **NOME**, nunca pelo **VALOR**:

| ❌ Errado | ✅ Certo |
|---|---|
| "configure `GATEWAY_ENCRYPT_KEY=Y2hhdmVTZWN1cmFE...`" | "configure `GATEWAY_ENCRYPT_KEY` no `.env` do servidor — leia de `process.env.GATEWAY_ENCRYPT_KEY`" |
| hardcoded em qualquer arquivo do repo | `process.env.NOME` no service que precisa |
| incluir o valor literal em prompt Code | "leia de `process.env.NOME`" |

## Por quê

1. **Memória de agentes é persistente** e pode aparecer em logs, debug,
   contexto compartilhado entre sessões.
2. **Repos Git ficam pra sempre** — secrets vazados não voltam atrás. Ver
   lição do sistema legado SISGDSOLAR: `hibernate.cfg.xml` com credencial
   Azure SQL em texto puro + 5 `.pfx` commitados.
3. **Princípio do menor privilégio:** secrets devem ter o MÍNIMO de
   cópias possíveis.
4. **Cópias autorizadas:** servidor `.env` + 2 backups offline do owner
   (papel num cofre + gerenciador de senhas local). Mais nenhuma.

## Exceção

**Nenhuma.** Nem "só pra testar". Nem "só dessa vez". Nem "vou apagar
depois".

Se um agente precisar acessar o valor (improvável mas hipotético):
- Lê do `.env` na hora via Read
- Usa em runtime
- NUNCA persiste
- NUNCA inclui no contexto da conversa
- NUNCA inclui em commits

### Exceção controlada documentada

Há uma janela pontual e supervisionada: quando o **OWNER (Luciano)
precisa anotar pessoalmente** um valor recém-gerado pros backups
offline, o agente pode apresentar o valor UMA ÚNICA VEZ no terminal:

- Após exibir, instruir owner a anotar imediatamente
- Apagar qualquer arquivo temporário em /tmp
- Instruir owner a limpar o terminal (`clear` + Ctrl+Shift+K no VS Code)
- Nunca commitar, nunca colocar em doc, nunca persistir em memória
- Confirmação volta sem o valor (ex: "chave gerada, 2 backups feitos")

## Leitura segura de `.env` (sem expor valores)

Se um agente precisar verificar QUE chaves estão configuradas (sem
ler os valores), pode listar apenas as keys:

```bash
grep -oP '^[A-Z_]+(?==)' .env
```

Ou inspecionar tamanho + sufixo curto pra confirmação visual sem expor
o valor completo:

```bash
grep "^NOME_DA_KEY=" .env | awk -F= '{v=$2; print length(v)" chars, sufixo ****"substr(v,length(v)-3)}'
```

## Lições aprendidas

- **Sistema legado SISGDSOLAR (24-25/05/2026):** 5 `.pfx` de produção +
  senha master Azure SQL em texto puro foram commitados no Git por
  falta de inventário/política. Resultado: rotação forçada de tudo,
  Luciano teve que pedir ao time legado pra trocar todas as
  credenciais.

- **GATEWAY_ENCRYPT_KEY criada em 26/05/2026:** primeira chave master
  criada SOB esta política. Owner = Luciano, com 2 backups offline
  (papel + gerenciador de senhas local). Nenhum valor consta em
  memória de agente, doc do repo ou commit.

## Documentos relacionados

- `docs/seguranca/inventario-secrets.md` — catálogo (metadados, nunca valores)
- `docs/debitos-tecnicos.md` D-novo-AJ — revisão trimestral do inventário
- `CLAUDE.md` — regras gerais do projeto
