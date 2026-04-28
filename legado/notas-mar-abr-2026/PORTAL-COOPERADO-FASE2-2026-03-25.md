# Portal do Cooperado — Fase 2 (2026-03-25)

## Resumo
Fase 2 implementa 5 novas seções do portal do cooperado, acessíveis via bottom nav e rodapé.

## Páginas criadas

### 1. Minhas UCs (`/portal/ucs`)
- Lista UCs vinculadas (número, endereço, distribuidora, consumo médio, desconto, status)
- Card vazio elegante se sem UCs
- Botão "Nova UC" → modal com número + upload fatura (cria ocorrência tipo SOLICITACAO)
- Gráfico de barras (recharts) com consumo/geração últimos meses (expansível ao clicar na UC)

### 2. Financeiro (`/portal/financeiro`)
- KPI cards: total economizado, próximo vencimento, último pagamento
- Card "Cartão de crédito" com badge "Em breve"
- Lista de cobranças com status (PAGO/PENDENTE/VENCIDO), botão download boleto (via Asaas)

### 3. Documentos (`/portal/documentos`)
- Seção "Documentos Pessoais" (RG/CNH) com status + botão trocar
- Seção "Contratos" com lista e status
- Seção "Outros" (contrato social, procuração)
- Modal upload com drag & drop

### 4. Indicações (`/portal/indicacoes`)
- QR code do link de convite (qrcode.react)
- Botão "Compartilhar pelo WhatsApp" (wa.me pre-preenchido)
- Botão copiar link
- Card benefício total por indicações
- Tabela de indicados (nome, data, status)

### 5. Desligamento (`/portal/desligamento`)
- Acessível via link discreto no rodapé do layout (não no nav)
- Aviso com regras (30 dias, pendências)
- Checklist automático: sem faturas abertas, sem geração ativa
- Formulário: motivo (select) + observação + confirmação
- POST /cooperados/meu-perfil/solicitar-desligamento → cria ocorrência DESLIGAMENTO + notifica admin
- Retorna protocolo

## Backend — Novos endpoints
- `GET /cooperados/meu-perfil/ucs` — UCs do cooperado logado
- `GET /cooperados/meu-perfil/cobrancas` — cobranças (últimas 24, com Asaas boleto)
- `GET /cooperados/meu-perfil/documentos` — todos os documentos
- `GET /cooperados/meu-perfil/contratos` — contratos com UC, usina, plano
- `POST /cooperados/meu-perfil/solicitar-desligamento` — cria ocorrência + notifica

## Prisma
- Adicionado `DESLIGAMENTO` ao enum `TipoOcorrencia`
- Adicionado `FALHA_USINA` ao type `TipoOcorrencia` no frontend

## Layout
- Link "Solicitar desligamento" adicionado no rodapé do layout (antes do bottom nav)
- Bottom nav já tinha os 5 itens: Início, UCs, Financeiro, Documentos, Indicações

## Refatoração
- `findCooperadoByUsuario()` extraído como helper privado no service (evita repetição)
