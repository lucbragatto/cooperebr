# Investigação /dashboard/cooperados/[id] — 21/04/2026

## HEAD
```
1ed82de47065e354c31ff732dc46d56c507a0d44
```

---

## Parte 1 — Navegação real da tela

### 1.1 Serviços

Não foi possível manter backend/frontend em background nesta sessão CLI (processos morrem ao sair do foreground). Investigação feita via código estático + banco.

### 1.2 Como se chega na tela

**Menu lateral (layout.tsx):**
```
web\app\dashboard\layout.tsx:69:  { href: '/dashboard/cooperados', label: '__MEMBROS__', icon: Users },
web\app\dashboard\layout.tsx:100: { href: '/dashboard/cooperados', label: '__MEMBROS__', icon: Users },
```

Menu leva a `/dashboard/cooperados` (lista). De lá, clicar no nome de um cooperado leva a `/dashboard/cooperados/[id]`:

```
web\app\dashboard\cooperados\page.tsx:287:  <Link href={`/dashboard/cooperados/${c.id}`} ...>{c.nomeCompleto}</Link>
```

Também acessível via dropdown de ações na lista:
```
web\app\dashboard\cooperados\page.tsx:123:  <Link href={`/dashboard/cooperados/${cooperado.id}`} ...>
web\app\dashboard\cooperados\page.tsx:126:  <Link href={`/dashboard/cooperados/${cooperado.id}?aba=proposta`} ...>
web\app\dashboard\cooperados\page.tsx:129:  <Link href={`/dashboard/cooperados/${cooperado.id}?aba=cobranca`} ...>
```

### 1.3 Links de outras telas para /dashboard/cooperados/[id]

```
web\app\dashboard\contratos\[id]\page.tsx:163:       <Link href={`/dashboard/cooperados/${contrato.cooperadoId}`} ...>
web\app\dashboard\ocorrencias\[id]\page.tsx:153:      <Link href={`/dashboard/cooperados/${ocorrencia.cooperadoId}`} ...>
web\app\dashboard\cooperativas\[id]\page.tsx:486:     <Link href={`/dashboard/cooperados/${m.id}`} ...>
web\app\dashboard\cobrancas\[id]\page.tsx:160:        <Link href={`/dashboard/cooperados/${...}`} ...>
web\app\dashboard\usinas\[id]\page.tsx:454:           <Link href={`/dashboard/cooperados/${i.cooperadoId}`} ...>
web\app\dashboard\usinas\[id]\page.tsx:585:           <Link href={`/dashboard/cooperados/${c.cooperadoId}`} ...>
web\app\dashboard\usinas\[id]\page.tsx:652:           <Link href={`/dashboard/cooperados/${c.cooperadoId}`} ...>
web\app\dashboard\usinas\[id]\page.tsx:774:           <Link href={`/dashboard/cooperados/${c.cooperadoId}`} ...>
web\app\dashboard\ucs\[id]\page.tsx:125:              <Link href={`/dashboard/cooperados/${uc.cooperadoId}`} ...>
web\app\dashboard\parceiros\[id]\page.tsx:153:        <Link href={`/dashboard/cooperados/${m.id}`} ...>
web\app\dashboard\condominios\[id]\page.tsx:261:      <Link href={`/dashboard/cooperados/${u.cooperado.id}`} ...>
web\app\dashboard\cooperados\[id]\fatura-mensal\page.tsx:251: router.push(`/dashboard/cooperados/${id}`)
web\app\dashboard\cooperados\[id]\fatura\page.tsx:30:          router.push(`/dashboard/cooperados/${id}`)
web\app\dashboard\cooperados\[id]\documentos\page.tsx:290:     router.push(`/dashboard/cooperados/${id}`)
web\app\dashboard\cooperados\novo\steps\Step7Alocacao.tsx:342: router.push(`/dashboard/cooperados/${cooperadoId}`)
```

**Conclusão:** Tela é amplamente linkada — aparece em 11+ telas diferentes. É a "ficha do cooperado" central do painel admin.

---

## Parte 2 — Uso histórico

### 2.1 Logs de /motor-proposta/aceitar

pm2 não disponível nesta sessão. Sem arquivos .log encontrados.

### 2.2 Contratos últimos 6 meses

```json
{
  "total": "73",
  "sem_plano": "0",
  "com_plano": "73",
  "contrato_mais_antigo": "2026-03-18 01:09:59.6",
  "contrato_mais_recente": "2026-03-30 00:22:49.206"
}
```

**Todos os 73 contratos têm `planoId` preenchido** (no contrato). O `planoId` veio do fallback no `aceitar()` (linha 586-588: se `dto.planoId` é null, busca `findFirst({ where: { ativo: true } })`).

### Propostas aceitas últimos 6 meses

```json
{
  "total_aceitas": "2",
  "sem_plano": "2",
  "com_plano": "0"
}
```

**As 2 únicas propostas ACEITA não têm `planoId` na proposta.**

Detalhes:
```json
[
  {
    "id": "cmn33iapr0003uo7o80sw350e",
    "cooperadoId": "cmn2yx2y60023uosgnxc0ho08",
    "mesReferencia": "02/2026",
    "createdAt": "2026-03-23 11:21:34.91"
  },
  {
    "id": "cmmxz4mi10001uon4ykz3dajm",
    "cooperadoId": "cmmuhw21r0000uor8gim80uuy",
    "mesReferencia": "01/2026",
    "createdAt": "2026-03-19 21:20:07.652"
  }
]
```

### Contratos: com vs sem proposta

```json
{
  "total": "73",
  "com_proposta": "1",
  "sem_proposta": "72"
}
```

**72 de 73 contratos foram criados SEM proposta** (provavelmente via importação/migration manual). Apenas 1 contrato foi criado via `aceitar()` (CTR-2026-0002, ligado à proposta cmn33iapr de 23/03).

### Contrato da proposta sem plano

```json
[
  {
    "id": "cmn33ib4n0005uo7o3akfllqq",
    "numero": "CTR-2026-0002",
    "planoId": "cmmt9jej10000uockf23fe0oh",
    "createdAt": "2026-03-23 11:21:35.445"
  }
]
```

O contrato TEM `planoId` apesar da proposta não ter — confirma que o fallback `findFirst({ where: { ativo: true } })` na linha 586-588 do `aceitar()` preencheu.

A segunda proposta (cmmxz4mi, 19/03) não gerou contrato — provavelmente early return por falta de UC ou outra condição.

### 2.3 HistoricoStatusCooperado

```
=== HISTORICO ACEITAR 30D ===
{ "total": "0", "mais_antigo": null, "mais_recente": null }

=== HISTORICO ACEITAR ALL TIME ===
{ "total": "0", "mais_antigo": null, "mais_recente": null }
```

**Zero registros de audit trail de aceitar().** O código que grava o audit trail (linhas 707-720 do service) foi adicionado recentemente (commit de segurança T3 PARTE 4) e nenhuma proposta foi aceita desde então.

---

## Parte 3 — Conclusão empírica

**Q1:** A tela `/dashboard/cooperados/[id]` é acessível via menu/link do admin no fluxo normal?

**SIM.** É a ficha central do cooperado. Acessível via:
- Menu lateral → Cooperados (lista) → clicar no nome
- Dropdown de ações na lista (ver, proposta, cobrança)
- Links de 11+ outras telas (contratos, cobranças, usinas, UCs, ocorrências, parceiros, condomínios)

É a tela mais linkada do painel admin depois da lista de cooperados.

**Q2:** Nos últimos 6 meses, alguma proposta foi aceita sem `planoId`?

**SIM, 2 propostas.** Ambas sem `planoId` na proposta. Uma delas (23/03) gerou contrato CTR-2026-0002 com `planoId` preenchido pelo fallback. A outra (19/03) não gerou contrato.

Inferência de caminho: como ambas não têm `planoId`, provavelmente vieram da tela `/dashboard/cooperados/[id]` (que não envia `planoId` no body do aceitar — linha 983 do page.tsx). O Wizard Admin (Step4Proposta) envia `planoId`.

No entanto, 72/73 contratos foram criados sem proposta (importação direta). Apenas 1 contrato nasceu via `aceitar()`.

**Q3:** Nos últimos 30 dias, teve aceite de proposta?

**NÃO.** Zero registros no audit trail (que foi adicionado recentemente) e as 2 propostas aceitas datam de março (19/03 e 23/03). Nenhum aceite em abril.
