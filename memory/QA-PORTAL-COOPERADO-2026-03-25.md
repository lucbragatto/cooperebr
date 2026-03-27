# QA — Portal do Cooperado (CoopereBR)
**Data:** 2026-03-25
**Escopo:** Análise estática completa do frontend (`web/app/portal/`) e backend (`cooperados/meu-perfil/*`)

---

## Resumo Executivo

| Categoria | Status |
|-----------|--------|
| Telas implementadas | 8/8 (login, início, conta, UCs, financeiro, documentos, indicações, desligamento) |
| Bugs críticos (bloqueantes) | **3** |
| Bugs altos | **2** |
| Bugs médios | **3** |
| Bugs baixos / melhorias | **5** |

---

## 1. BUGS CRÍTICOS (Bloqueantes)

### BUG-001: Upload de documentos não funciona — endpoint inexistente
- **Severidade:** CRÍTICA
- **Tela:** `/portal/documentos`
- **Frontend:** `POST /upload/documento` (documentos/page.tsx)
- **Backend:** Esse endpoint **não existe**. O único endpoint de upload é `POST /documentos/upload/:cooperadoId`, que requer role ADMIN/OPERADOR e cooperadoId no path.
- **Impacto:** Cooperado clica "Enviar", seleciona arquivo, submete → recebe erro 404 ou 401. Upload nunca completa.
- **Fix:** Criar endpoint `POST /cooperados/meu-perfil/documentos` (role COOPERADO) que resolve cooperadoId via JWT, ou adaptar o frontend para chamar endpoint existente com cooperadoId extraído do perfil.

### BUG-002: Tela de Indicações não carrega dados — relações não incluídas na query
- **Severidade:** CRÍTICA
- **Tela:** `/portal/indicacoes`
- **Frontend:** Chama `GET /cooperados/meu-perfil` e espera `indicacoesFeitas[]` e `beneficiosIndicacao[]`
- **Backend:** O método `meuPerfil()` em `cooperados.service.ts` faz include apenas de `ucs`, `contratos` e `documentos`. **Não inclui** `indicacoesFeitas` nem `beneficiosIndicacao`.
- **Impacto:** A lista "Seus indicados" ficará vazia. O cálculo de benefícios retornará R$ 0,00. O QR code e link de compartilhamento **funcionam** (usam `codigoIndicacao` que é campo direto do cooperado).
- **Fix:** Adicionar ao include do `meuPerfil`:
  ```typescript
  indicacoesFeitas: {
    include: { cooperadoIndicado: { select: { nomeCompleto: true, status: true } } }
  },
  beneficiosIndicacao: true,
  ```

### BUG-003: Tipo de documento PROCURACAO não existe no enum do Prisma
- **Severidade:** CRÍTICA
- **Tela:** `/portal/documentos`
- **Frontend:** Dropdown de upload inclui "Procuração" (`PROCURACAO`)
- **Backend:** `TipoDocumento` enum no schema.prisma contém apenas: `RG_FRENTE`, `RG_VERSO`, `CNH_FRENTE`, `CNH_VERSO`, `CONTRATO_SOCIAL`, `OUTROS`
- **Impacto:** Se o cooperado selecionar "Procuração" e submeter, o Prisma rejeitará com erro de validação.
- **Fix:** Adicionar `PROCURACAO` ao enum `TipoDocumento` no schema.prisma + gerar migration, OU remover do dropdown no frontend.

---

## 2. BUGS ALTOS

### BUG-004: Criação de ocorrência (Nova UC) pode falhar sem cooperadoId
- **Severidade:** ALTA
- **Tela:** `/portal/ucs` → modal "Adicionar Nova UC"
- **Frontend:** `POST /ocorrencias` com `{ tipo: 'SOLICITACAO', descricao: '...', prioridade: 'MEDIA' }` — **não envia `cooperadoId`**
- **Backend:** O campo `cooperadoId` é obrigatório na tabela `ocorrencias`. Se o controller/service não resolver automaticamente via JWT, a criação falhará com erro de constraint.
- **Impacto:** Cooperado não consegue solicitar inclusão de nova UC.
- **Fix:** O backend deve extrair `cooperadoId` do token JWT no `OcorrenciasService.create()`, ou o frontend deve buscar o cooperadoId do perfil e incluir no payload.

### BUG-005: Upload de fatura na modal de Nova UC não é enviado
- **Severidade:** ALTA
- **Tela:** `/portal/ucs` → modal "Adicionar Nova UC"
- **Frontend:** O campo de upload de fatura existe na UI, mas o `handleAdicionarUc()` apenas cria uma ocorrência com texto. O arquivo selecionado **não é enviado** — não há FormData, não há upload real.
- **Impacto:** Cooperado acredita que enviou a fatura, mas ela se perde. A ocorrência é criada sem anexo.
- **Fix:** Implementar upload multipart no handler, ou remover o campo de upload da modal (e pedir envio posterior).

---

## 3. BUGS MÉDIOS

### BUG-006: Link WhatsApp na tela Início usa `perfil.id` em vez de `codigoIndicacao`
- **Severidade:** MÉDIA
- **Tela:** `/portal` (Início)
- **Frontend (page.tsx):**
  ```typescript
  const linkIndicacao = `${window.location.origin}/entrar?ref=${perfil?.id ?? ''}`
  ```
- **Tela Indicações (indicacoes/page.tsx):**
  ```typescript
  const linkConvite = `${window.location.origin}/entrar?ref=${dados?.codigoIndicacao ?? dados?.id ?? ''}`
  ```
- **Impacto:** O botão WhatsApp da home gera link com `id` do cooperado em vez do `codigoIndicacao`. A página `/entrar` busca por `codigoIndicacao`, então o link da home pode não vincular a indicação corretamente.
- **Fix:** Usar `perfil?.codigoIndicacao ?? perfil?.id` na tela Início (consistente com a tela de Indicações).

### BUG-007: Gráfico de consumo (UCs) busca todas as cobranças sem filtrar por UC
- **Severidade:** MÉDIA
- **Tela:** `/portal/ucs` → expansão do card de UC
- **Frontend:** `GET /cooperados/meu-perfil/cobrancas` retorna todas as cobranças do cooperado. O componente `UcChart` filtra por `c.contrato?.uc?.numero === uc.numero` — **funciona**, mas se o cooperado tiver muitas UCs, os dados de todas as UCs são baixados para exibir o gráfico de uma.
- **Impacto:** Performance degradada em cooperados com múltiplas UCs e muitas cobranças. Não é um bug funcional, mas gera tráfego desnecessário.
- **Fix ideal:** Criar endpoint `GET /cooperados/meu-perfil/ucs/:ucId/cobrancas` para buscar cobranças filtradas por UC.

### BUG-008: Sem proteção CSRF nos endpoints do portal
- **Severidade:** MÉDIA
- **Contexto:** Nenhum mecanismo CSRF está configurado no backend (app.module.ts). Os endpoints mutantes (PUT meu-perfil, POST solicitar-desligamento, POST ocorrencias) dependem exclusivamente do JWT Bearer.
- **Impacto:** Risco de CSRF em browsers que enviam cookies automaticamente (não se aplica se token está em cookie httpOnly, mas aqui o token está em cookie JavaScript acessível).
- **Fix:** Implementar CSRF token ou garantir que o token JWT seja enviado apenas via header Authorization (não cookie automático).

---

## 4. CONSISTÊNCIA DOS DADOS EXIBIDOS

### 4.1 Tela Início (`/portal`)
| Campo | Fonte Backend | Exibição Frontend | Status |
|-------|--------------|-------------------|--------|
| Nome | `cooperado.nomeCompleto` | Primeiro nome (split) | ✅ OK |
| Desconto Atual | `contratoAtivo.percentualDesconto` | `X%` ou `—` | ✅ OK |
| Próx. Vencimento | `proximaCobranca.dataVencimento` | DD/MM/YYYY ou `—` | ✅ OK |
| Status | `cooperado.status` | Badge colorido | ✅ OK |
| kWh Alocados | `cooperado.cotaKwhMensal` | Número formatado | ✅ OK |
| Docs Pendentes | `documentos.length` (PENDENTE/REPROVADO) | Badge vermelho | ✅ OK |
| Faturas Pendentes | `cobrancas` (PENDENTE/VENCIDO) | Badge vermelho | ✅ OK |

### 4.2 Tela Minha Conta (`/portal/conta`)
| Campo | Editável? | Validação | Status |
|-------|-----------|-----------|--------|
| Nome completo | Sim | Required | ✅ OK |
| CPF | Não (disabled) | — | ✅ OK |
| Email | Sim | Required | ✅ OK |
| Telefone | Sim | Opcional | ✅ OK |
| Senha atual | Sim | Required | ✅ OK |
| Nova senha | Sim | Min 6 chars | ✅ OK |
| Confirmar senha | Sim | Deve coincidir | ✅ OK |

### 4.3 Tela UCs (`/portal/ucs`)
| Campo | Fonte Backend | Exibição Frontend | Status |
|-------|--------------|-------------------|--------|
| Número UC | `uc.numero` | "UC XXXX" | ✅ OK |
| Endereço | `uc.endereco + cidade + estado` | MapPin icon | ✅ OK |
| Distribuidora | `uc.distribuidora` | Building2 icon | ✅ OK |
| Desconto | `contrato.percentualDesconto` | `X%` | ✅ OK |
| Status contrato | `contrato.status` | Badge | ✅ OK |
| Consumo médio | `faturasProcessadas.mediaKwhCalculada` | kWh | ✅ OK |

### 4.4 Tela Financeiro (`/portal/financeiro`)
| Campo | Fonte Backend | Exibição Frontend | Status |
|-------|--------------|-------------------|--------|
| Total Economizado | Soma `valorDesconto` (status PAGO) | R$ formatado | ✅ OK |
| Próx. Vencimento | Primeira cobrança PENDENTE | DD/MM/YYYY | ✅ OK |
| Último Pagamento | Primeira cobrança PAGO | DD/MM/YYYY | ✅ OK |
| Ref. (mês/ano) | `mesReferencia/anoReferencia` | MM/YYYY | ✅ OK |
| Valor Líquido | `valorLiquido` | R$ formatado | ✅ OK |
| Status | `status` | Badge colorido | ✅ OK |
| Boleto/Link | `asaasCobrancas[0].boletoUrl` | Download button | ✅ OK |

**Campos na API mas não exibidos:**
- `valorBruto`, `valorDesconto`, `percentualDesconto` — não mostrados individualmente por cobrança
- `kwhEntregue`, `kwhConsumido`, `kwhCompensado`, `kwhSaldo` — não exibidos no financeiro
- `valorMulta`, `valorJuros`, `valorAtualizado` — não exibidos
- **Sugestão:** Adicionar seção expandível em cada cobrança com detalhamento (valor bruto → desconto → líquido)

### 4.5 Tela Documentos (`/portal/documentos`)
| Campo | Fonte Backend | Exibição Frontend | Status |
|-------|--------------|-------------------|--------|
| Tipo | `tipo` | Label traduzido | ✅ OK |
| Status | `status` | Ícone + cor | ✅ OK |
| Motivo rejeição | `motivoRejeicao` | Texto vermelho | ✅ OK |
| Download | `url` | Botão | ✅ OK |
| Contratos | `contratos` (endpoint separado) | Cards com info | ✅ OK |

---

## 5. FLUXOS MOBILE-FIRST

### 5.1 Arquitetura de Layout
- ✅ `max-w-lg` (448px) centralizado — bom para mobile
- ✅ Bottom nav fixo com 5 tabs + safe-area-bottom
- ✅ Header fixo com botão logout
- ✅ `pb-20` no main para não cobrir conteúdo
- ✅ Skeleton loading em todas as telas

### 5.2 Modais (Bottom Sheet)
- ✅ `flex items-end sm:items-center` — bottom sheet no mobile, centro no desktop
- ✅ Overlay semitransparente com click para fechar
- ✅ Botão X visível
- ✅ `max-w-md` para evitar modais muito largos

### 5.3 Problemas de Usabilidade Mobile

| # | Issue | Tela | Severidade |
|---|-------|------|------------|
| M-001 | Desligamento acessível apenas via link no rodapé (abaixo do nav), fácil de perder | layout.tsx | BAIXA |
| M-002 | Sem feedback háptico ao copiar link de indicação | indicacoes | BAIXA |
| M-003 | Gráfico de consumo (Recharts) pode não renderizar bem em telas < 320px | ucs | BAIXA |
| M-004 | Upload drag & drop pouco útil em mobile — funciona via click, mas área de drop é confusa | documentos, ucs | BAIXA |
| M-005 | Sem pull-to-refresh em nenhuma tela — usuário precisa recarregar a página | todas | MÉDIA |

### 5.4 Feedbacks de Erro
- ✅ Mensagens de erro em caixas vermelhas (bg-red-50, text-red-700)
- ✅ Mensagens de sucesso em caixas verdes
- ✅ Estados de loading com skeleton
- ✅ Botões desabilitados durante submissão
- ✅ Textos de loading ("Entrando...", "Salvando...", "Enviando...", "Alterando...")
- ⚠️ Sem toast/snackbar global — erros podem não ser vistos se o form for longo

---

## 6. INTEGRAÇÃO FRONTEND ↔ BACKEND

### 6.1 Campos na API mas NÃO exibidos no portal

| Campo | Endpoint | Observação |
|-------|----------|------------|
| `tipoPessoa` | meu-perfil | Não exibido em "Minha Conta" |
| `tipoCooperado` | meu-perfil | Não exibido em nenhuma tela |
| `termoAdesaoAceito` | meu-perfil | Não exibido |
| `dataInicioCreditos` | meu-perfil | Poderia aparecer no Início |
| `protocoloConcessionaria` | meu-perfil | Poderia aparecer nas UCs |
| `valorBruto` / `valorDesconto` | cobrancas | Só valorLiquido é mostrado por cobrança |
| `kwhEntregue` / `kwhConsumido` / `kwhCompensado` | cobrancas | Não exibidos no financeiro |
| `tamanhoBytes` | documentos | Não exibido no card do documento |
| `representanteLegalNome/Cpf/Cargo` | meu-perfil | Não exibido para PJ |
| `cep`, `bairro` | ucs | Não exibidos no card da UC |

### 6.2 Campos no frontend sem correspondência direta

| Campo Frontend | Tela | Observação |
|----------------|------|------------|
| "Pagamento automático (em breve)" | financeiro | Placeholder, sem endpoint |
| Upload de fatura (Nova UC) | ucs | Campo visual existe, upload não implementado |

### 6.3 Endpoints disponíveis mas NÃO usados pelo portal

| Endpoint | Módulo | Potencial uso |
|----------|--------|---------------|
| `GET /indicacoes/minhas` | indicacoes | Lista de indicados (deveria ser usado em vez de meu-perfil) |
| `GET /indicacoes/beneficios` | indicacoes | Benefícios detalhados |
| `GET /indicacoes/meu-link` | indicacoes | Link + contadores (totalIndicados, indicadosAtivos) |
| `GET /notificacoes` | notificacoes | Sino de notificações no portal |

---

## 7. CASOS EXTREMOS

### 7.1 Cooperado sem UC
- **Início:** kWh alocados = 0, desconto = `—`, próx. vencimento = `—` ✅
- **UCs:** Empty state correto ("Nenhuma UC vinculada") com CTA para adicionar ✅
- **Financeiro:** Lista vazia, KPIs mostram R$ 0,00 e `—` ✅
- **Documentos:** Lista vazia permitida, upload funcional (exceto BUG-001) ⚠️

### 7.2 Cooperado sem cobranças
- **Financeiro:** Total economizado = R$ 0,00, sem cards de cobrança ✅
- **Desligamento:** Checklist "Sem faturas em aberto" = ✅ (0 pendentes) ✅
- **UCs (gráfico):** "Sem dados de consumo ainda" ✅

### 7.3 Cooperado sem indicações
- **Indicações:** QR code e link funcionam ✅, lista "Nenhuma indicação ainda" ✅
- **Benefícios:** R$ 0,00 ✅

### 7.4 Cooperado recém-cadastrado (status PENDENTE)
- **Início:** Status "Pendente" em amarelo ✅
- **Alertas:** Podem aparecer se documentos estão pendentes ✅
- **Potencial issue:** Cooperado PENDENTE pode acessar todas as telas normalmente — não há restrição por status. Considerar bloquear funcionalidades para cooperados não-ATIVO.

### 7.5 Cooperado SUSPENSO ou ENCERRADO
- **Início:** Status exibido corretamente ✅
- **Issue:** Cooperado ENCERRADO consegue navegar normalmente, ver dados, fazer upload, solicitar desligamento. Não há lógica de bloqueio por status no portal.

---

## 8. QR CODE E LINK DE INDICAÇÕES

### 8.1 QR Code
- **Implementação:** `QRCodeSVG` do pacote `qrcode.react`
- **Tamanho:** 140x140, nível de correção M
- **Valor:** `${window.location.origin}/entrar?ref=${codigoIndicacao}`
- **Status:** ✅ Funciona corretamente (gera SVG válido)

### 8.2 Link WhatsApp
- **Formato:** `https://wa.me/?text=${encodeURIComponent(mensagem)}`
- **Mensagem (indicações):** `"Olá! Quer economizar na conta de luz com energia solar? Cadastre-se na cooperativa: {link}"`
- **Mensagem (início):** `"Olá! Quer economizar na conta de luz? Participe da nossa cooperativa de energia solar! Acesse: {link}"`
- **Status:** ✅ Formato correto para wa.me (sem número = escolhe contato)
- **Issue:** Ver BUG-006 — link da home usa `id` em vez de `codigoIndicacao`

### 8.3 Fluxo de indicação ponta a ponta
1. Cooperado compartilha link ✅
2. Pessoa acessa `/entrar?ref=CODIGO` ✅
3. Página `/entrar` lê `ref` via searchParams ✅
4. Busca nome do indicador via `GET /publico/convite/:codigo` ✅
5. Submete cadastro com `codigoRef` via `POST /publico/iniciar-cadastro` ✅
6. **Resultado:** Fluxo de captação completo e funcional

---

## 9. SOLICITAÇÃO DE DESLIGAMENTO

### 9.1 Checklist de pré-requisitos
- **Sem faturas em aberto:** Filtra cobranças PENDENTE/VENCIDO → correto ✅
- **Sem geração ativa:** Verifica se há cobrança no mês/ano atual com kwhEntregue > 0 → correto ✅
- **Bloqueio:** Botão desabilitado se checklist não passa ✅

### 9.2 Criação da ocorrência
- **Endpoint:** `POST /cooperados/meu-perfil/solicitar-desligamento`
- **Backend cria:** Ocorrência tipo=DESLIGAMENTO, status=ABERTA, prioridade=ALTA ✅
- **Validação:** Verifica se já existe desligamento ABERTA/EM_ANDAMENTO → BadRequestException ✅
- **Notificação:** Cria notificação para admin com link `/dashboard/ocorrencias` ✅
- **Protocolo:** Retorna `ocorrencia.id` como protocolo ✅
- **UI de sucesso:** Mostra card verde com número do protocolo em monospace ✅

### 9.3 Issues no desligamento
- **Sem confirmação adicional:** Não há modal de confirmação "Tem certeza?" antes de submeter. O checkbox de confirmação mitiga parcialmente.
- **Sem listagem de pendências:** Se houver faturas abertas, o cooperado vê apenas "Sem faturas em aberto ✗" — não mostra quais faturas precisa pagar.

---

## 10. RECOMENDAÇÕES DE MELHORIA (Não-bloqueantes)

1. **Notificações no portal:** Endpoint `GET /notificacoes` existe no backend mas não é usado. Adicionar ícone de sino no header.
2. **Detalhamento de cobrança:** Mostrar valorBruto → desconto → líquido em cada card de cobrança (expandível).
3. **Bloqueio por status:** Cooperados ENCERRADO/SUSPENSO não deveriam ter acesso completo ao portal.
4. **Dados de kWh no financeiro:** Exibir kwhEntregue, kwhConsumido, kwhCompensado por cobrança.
5. **Pull-to-refresh:** Implementar para melhor UX mobile.
6. **Representante legal PJ:** Exibir campos de representante legal em "Minha Conta" quando tipoPessoa = PJ.
7. **Histórico de desligamento:** Mostrar status da solicitação após envio (acompanhamento).
8. **Token em cookie:** Mover token JWT para cookie httpOnly para mitigar XSS.

---

## 11. MATRIZ DE PRIORIDADE

| ID | Descrição | Severidade | Esforço | Prioridade |
|----|-----------|------------|---------|------------|
| BUG-001 | Upload documentos — endpoint inexistente | CRÍTICA | Médio | P0 |
| BUG-002 | Indicações — relações não incluídas na query | CRÍTICA | Baixo | P0 |
| BUG-003 | PROCURACAO — enum ausente no Prisma | CRÍTICA | Baixo | P0 |
| BUG-004 | Nova UC — cooperadoId ausente no payload | ALTA | Baixo | P1 |
| BUG-005 | Upload fatura (Nova UC) — não implementado | ALTA | Médio | P1 |
| BUG-006 | WhatsApp home — usa id em vez de codigoIndicacao | MÉDIA | Baixo | P2 |
| BUG-007 | Gráfico UC — baixa todas as cobranças | MÉDIA | Médio | P2 |
| BUG-008 | Sem CSRF protection | MÉDIA | Médio | P2 |

---

*Relatório gerado por análise estática de código em 2026-03-25.*
