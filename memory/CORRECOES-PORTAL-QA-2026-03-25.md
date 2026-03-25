# Correções QA Portal do Cooperado — 2026-03-25

## BUG-001 (CRÍTICO): Upload de documentos — endpoint inexistente
- **Problema**: Frontend chamava POST `/upload/documento` que não existia
- **Fix backend**: Criado `POST /cooperados/meu-perfil/documentos` com role COOPERADO
  - `cooperados.controller.ts`: Novo endpoint com `@UseInterceptors(FileInterceptor('file'))`
  - `cooperados.service.ts`: Método `uploadMeuDocumento()` com upload Supabase + upsert DocumentoCooperado
  - `cooperados.module.ts`: Registrado `MulterModule` com memoryStorage
- **Fix frontend**: `portal/documentos/page.tsx` alterado para chamar `/cooperados/meu-perfil/documentos`

## BUG-002 (CRÍTICO): Indicações — relações não incluídas no meuPerfil
- **Problema**: `meuPerfil()` não retornava indicacoesFeitas nem beneficiosIndicacao
- **Fix**: Adicionado ao include do findFirst em `cooperados.service.ts`:
  - `indicacoesFeitas` com include cooperadoIndicado (nomeCompleto, status, createdAt)
  - `beneficiosIndicacao` filtrado por status APLICADO, select valorCalculado

## BUG-003 (CRÍTICO): PROCURACAO não existe no enum TipoDocumento
- **Problema**: Frontend listava "Procuração" no dropdown mas enum não tem PROCURACAO
- **Fix**: Removido `PROCURACAO: 'Procuração'` de `TIPO_LABEL` e do filtro `docsOutros` em `portal/documentos/page.tsx`

## BUG-004 (ALTA): Nova UC — cooperadoId ausente no POST /ocorrencias
- **Problema**: POST /ocorrencias sem cooperadoId falhava (campo obrigatório)
- **Fix**: `portal/ucs/page.tsx`:
  - Página agora busca meu-perfil para obter cooperadoId
  - Modal `ModalNovaUc` recebe e envia cooperadoId no payload

## BUG-006 (MÉDIA): Link WhatsApp usa id em vez de codigoIndicacao
- **Problema**: Link de indicação usava `perfil?.id` (UUID interno) em vez de `codigoIndicacao`
- **Fix**: `portal/page.tsx`:
  - Interface MeuPerfil com campo `codigoIndicacao?`
  - Link alterado para `perfil?.codigoIndicacao ?? perfil?.id`

## Arquivos alterados
- `backend/src/cooperados/cooperados.controller.ts`
- `backend/src/cooperados/cooperados.service.ts`
- `backend/src/cooperados/cooperados.module.ts`
- `web/app/portal/documentos/page.tsx`
- `web/app/portal/ucs/page.tsx`
- `web/app/portal/page.tsx`
