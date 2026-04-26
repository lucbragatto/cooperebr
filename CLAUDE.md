# Instruções permanentes — Claude Code no CoopereBR

## Antes de qualquer tarefa, SEMPRE ler primeiro (nesta ordem)

1. `docs/COOPEREBR-ALINHAMENTO.md` — estado consolidado do projeto
2. `docs/MAPA-INTEGRIDADE-SISTEMA.md` — diagnóstico ponta a ponta dos 10 fluxos
3. `docs/sessoes/` — sessões recentes (os 3 arquivos mais novos)
4. `git log -5 --oneline` — últimos commits

## Mapa de Integridade (documento vivo)

`docs/MAPA-INTEGRIDADE-SISTEMA.md` é atualizado ao final de cada sprint.
Após fechar sprint, atualizar a matriz executiva (% pronto, gaps resolvidos).
Não criar versão nova com data — sobrescrever o mesmo arquivo.
Se precisar do histórico, git log mostra as versões anteriores.

Esses 3 em ordem garantem contexto completo em 5 minutos.

## Sobre o projeto em 5 linhas

CoopereBR é plataforma SaaS multi-tenant de Geração Distribuída.
Dono: Luciano (não programa).
Parceiros (cooperativas/consórcios/associações/condomínios) pagam Luciano pelo uso do sistema via FaturaSaas.
Membros dos parceiros pagam seus parceiros (não pagam Luciano).
**CoopereBR é UM parceiro entre vários possíveis, NÃO o dono do sistema.**

Detalhes em `docs/COOPEREBR-ALINHAMENTO.md`.

## Convenções de código

- Multi-tenant: toda query Prisma filtra por `cooperativaId`
- `npx prisma db push` em dev (nunca migrate)
- PowerShell: `;` em vez de `&&`
- Commits em português, pequenos, descritivos
- Valores monetários: `Math.round(x * 100) / 100`

## Como trabalhar com Luciano

- Luciano NÃO programa
- Explicar decisões em linguagem humana, sem jargão técnico
- Decisões técnicas puras (estrutura, libs, organização): decide você, comunica motivo
- Decisões de produto (regra de negócio, fluxo de usuário): pergunta antes de executar

## Quando Luciano pedir conteúdo de arquivo

- Execute `Get-Content <path>` e cole o output LITERAL
- NÃO resumir, NÃO interpretar
- Se arquivo > 500 linhas, avisar antes e perguntar se quer em partes

## Sprint atual

Sprints 5, 6, 7, 8A, 8B fechados (23/04/2026).

**Próximo: Sprint 9 — começa pelas 2 pendências do 8B:**

1. PDF cobrança: adicionar imagens QR PIX + código de barras (30 min)
2. Teste E2E real no sandbox Asaas (45 min)
3. Depois: ofertas Clube, rede showcase, ou Sicoob/BB adapters

## Módulo Clube + CooperToken

Especificação em `docs/especificacao-clube-cooper-token.md`.
Sprint 8 implementa MVP. Sprint 9 faz rede interna. Sprint 10+ rede
aberta (requer consulta advogado antes).

Princípio: token = desconto diferido. kWh constante. Cooperado escolhe
Desconto (imediato) ou Clube (acumular tokens).

Ferramentas configuráveis (ativáveis por parceiro):
- Expiração de tokens (prazo em meses)
- Desvalorização temporal (período graça + taxa + piso)

Regra de ouro: comunicação transparente ao cooperado. Curvas
sempre visíveis no portal. WhatsApp notifica antes de eventos.

Antes de implementar Sprint 8, investigar /cadastro público —
pode já ter partes do Clube.

## Gateways de pagamento

Novos gateways sempre via adapter pattern (`src/gateway-pagamento/`).
Nunca chamar AsaasService direto de fora do módulo asaas — usar
GatewayPagamentoService. Ver `docs/arquitetura/gateways.md`.

Exceção: `pix-excedente.service.ts` usa AsaasService direto (transferência PIX específica).

## Dados de teste

Todos os dados atualmente no banco dev são de teste. Quando encontrar
dados suspeitos (CPF/CNPJ fake padrão 1-2-3-4, nomes 'REMOVIDO', emails
@removido.invalid, domínios @test ou @invalid), pode deletar sem perguntar.
Apenas mostra a lista do que vai deletar e executa. Isso vale até o primeiro
parceiro real entrar em produção.

## Regra de atualização

Se estado mudar muito (muitos tickets fechados, novo sprint, schema grande),
re-gerar RAIO-X e atualizar `docs/COOPEREBR-ALINHAMENTO.md`. Avisar Luciano antes.

## Regras de segurança para migrations e alterações de schema

Qualquer alteração de schema que envolva os casos abaixo EXIGE auditoria
**prévia** dos dados afetados:

1. Mudança de tipo de campo (String → Enum, String → Int, etc)
2. Tornar campo obrigatório (NULL → NOT NULL)
3. Deletar campo existente
4. Alterar default value
5. Renomear campo com impacto em queries
6. Alterar unique/index constraints

### Checklist ANTES de aplicar qualquer dos casos acima

**A.** Rodar SELECT que conta:
- Quantos registros têm valor não-nulo no campo
- Distribuição de valores (`SELECT valor, COUNT(*) GROUP BY`)
- Valores que não vão sobreviver à mudança

**B.** Reportar ao Luciano o que será perdido (se algo) e pedir
autorização explícita antes de executar.

**C.** Preferir migração em 2 passos quando possível:
- Passo 1: UPDATE pra normalizar valores existentes
- Passo 2: ALTER TABLE (tipo, NOT NULL, etc)

**D.** Evitar `prisma db push` cego em casos acima — preferir `migrate dev`
com review do SQL gerado. **Nunca** usar `--accept-data-loss` sem
auditoria prévia explícita.

**E.** Em scripts de normalização de dados: sempre dry-run primeiro,
mostrar ANTES/DEPOIS de cada registro, aguardar aprovação.

**F.** Se Luciano pedir "investigar relacionamentos antes de alterar",
auditar TODOS os campos afetados, não só o campo principal da solicitação.

Regra criada após incidente de 2026-04-26 (Sprint 11 Bloco 1): 96 valores
textuais de `Uc.distribuidora` foram perdidos em migration String → Enum
sem auditoria prévia. Registrado no MAPA-INTEGRIDADE-SISTEMA.md.

## Infraestrutura local — backend gerenciado por PM2

O backend roda sob **PM2** como `cooperebr-backend` (id 0). Não é processo
livre via `npm run start:dev`.

**Comandos corretos:**

| Ação | Comando |
|---|---|
| Ver status | `pm2 list` |
| Parar | `pm2 stop cooperebr-backend` |
| Subir (se stopped) | `pm2 start cooperebr-backend` |
| Reiniciar | `pm2 restart cooperebr-backend` |
| Ver logs | `pm2 logs cooperebr-backend --lines 30` |

**NUNCA usar `npm run start:dev` direto.** Mesmo que o usuário diga
"matei o backend", o PM2 pode ressuscitar o processo automaticamente,
criando processos zumbi e bloqueio do `query_engine_bg.wasm` (ou
`.dll.node` em versões antigas) do Prisma.

### Regras pra `prisma generate` / `db push`

**OBRIGATÓRIO** antes de `prisma generate` ou `prisma db push`:

1. `pm2 stop cooperebr-backend`
2. Confirmar porta 3000 livre: `netstat -ano | findstr :3000` (não deve
   ter `LISTENING`)
3. Rodar `prisma generate` / `db push`
4. `pm2 restart cooperebr-backend`

**Sem parar o PM2**, o engine Prisma fica lockado e o `EPERM` persiste
mesmo matando processo manualmente — PM2 respawna instantaneamente.

### REBUILD obrigatório quando muda código backend

PM2 roda `dist/src/main.js` (build compilado), **NÃO ts-node em modo watch**.
Mudanças em arquivos `.ts` **não chegam ao runtime** sem rebuild.

Sequência correta após qualquer mudança em `backend/src/`:
1. `pm2 stop cooperebr-backend` (libera locks)
2. `cd backend ; npm run build` (regenera `dist/`)
3. `pm2 restart cooperebr-backend`

Sintomas de "esqueci de rebuildar":
- 404 em endpoints novos
- Erros Prisma referenciando campos já deletados (`P2022 column 'X' does not exist`)
- Validação `tsc --noEmit` passa mas runtime falha

`scripts/` está excluído do build (`tsconfig.build.json`) — utilitários standalone
que rodam via `ts-node` direto, não vão pro `dist/`.

**Prisma v6** usa `query_engine_bg.wasm` (não mais `.dll.node`). Engine
binário antigo (`query_engine-windows.dll.node` de versões anteriores) é
**lixo no disco** e pode ser ignorado — verifique a data do `.wasm` pra
saber se o regenerate funcionou, não a do `.dll`.

Regra criada após sessão de 2026-04-25, onde 1h foi gasta debugando
erros 500 em `/ocorrencias` e `/contratos` que eram só engine Prisma
antigo carregado em memória pelo backend que o PM2 mantinha respawnado.

## Estado atual do projeto (atualizado 2026-04-25)

Sprint 10 concluído. Sprint 11 definido com foco em "Destravamento do Ciclo
de Ativação" (3 gaps P0 interconectados — ver MAPA-INTEGRIDADE-SISTEMA.md).

Conquistas históricas do Sprint 10:
- Primeiro email SMTP funcional da história (email_logs.status=ENVIADO
  passou de 0 para 1+)
- Primeiro WhatsApp automático pós-reativação do serviço
- LGPD compliance implementada (whitelist dev + flag ambienteTeste + 112
  registros mascarados)
- CADASTRO_V2 desbloqueado

Documentos vivos permanentes (ler ao iniciar sessão):
- docs/MAPA-INTEGRIDADE-SISTEMA.md (atualizar a cada sprint)
- docs/COOPEREBR-ALINHAMENTO.md
- docs/especificacao-clube-cooper-token.md
- docs/especificacao-contabilidade-clube.md
- docs/especificacao-modelos-cobranca.md
- CLAUDE.md (este arquivo)

Próximo passo: Sprint 11. Primeira tarefa: auditoria ampla da numeração
dupla de UC EDP.
