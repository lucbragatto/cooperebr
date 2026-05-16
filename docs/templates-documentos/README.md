# Templates de Documentos — SISGDSOLAR e Parceiros

**Repositório centralizado de documentos contratuais do ecossistema SISGDSOLAR.**

Última atualização: 16/05/2026 | Versão: v1.1 (reorganização em 3 camadas)

---

## Arquitetura do ecossistema

```
┌─────────────────────────────────────────────────────────────────┐
│  SISGDSOLAR (Plataforma SaaS multi-tenant)                      │
│  Dono operacional: Luciano                                      │
│  Função: infraestrutura técnica que administra parceiros        │
└────────────┬──────────────────────┬─────────────────────────────┘
             │                      │
   PARCEIRO 1 (paga SaaS)   PARCEIRO 2 (paga SaaS)
             │                      │
   ┌─────────▼──────────┐  ┌────────▼────────────┐
   │ COOPEREBR          │  │ CONSÓRCIO SINERGIA  │
   │ Cooperativa s/ fins │  │ Consórcio           │
   │ lucrativos          │  │ (Lei 6.404/76       │
   │ (Lei 5.764/71)     │  │  ou 11.795/2008)   │
   └─────────┬──────────┘  └────────┬────────────┘
             │                      │
       COOPERADOS              CONSORCIADOS
   (atos cooperativos)    (contratos de consórcio)
```

## 3 camadas contratuais

| Camada | Relação | Natureza | Pasta |
|---|---|---|---|
| **2 (base)** | SISGDSOLAR × Instituição Parceira | Contrato SaaS comercial | `00-contratos-saas-instituicoes/` |
| **1 (operacional)** | Instituição × Membro | Bilateral, conforme regime de cada instituição | `01-termos-adesao/{coopere-br,sinergia}/` |
| **3 (portabilidade)** | Membro entre instituições parceiras | Transferência inter-parceiros | `01-termos-adesao/inter-parceiros/` |

## Estrutura completa

```
docs/templates-documentos/
├── README.md                                        Este índice
├── CHANGELOG.md                                     Versionamento
│
├── 00-contratos-saas-instituicoes/                  CAMADA 2 — Estrutural
│   └── README.md + modelo contrato SaaS
│
├── 01-termos-adesao/                                CAMADA 1 + 3 — Operacional
│   ├── README.md
│   ├── coopere-br/                                  CoopereBR × Cooperado
│   │   ├── modelo-termo-adesao-bilateral-v3.md      🆕 Bilateral blindado
│   │   ├── analise-modelos-atuais.md
│   │   └── originais/
│   ├── sinergia/                                    Sinergia × Consorciado
│   │   └── modelo-termo-adesao-sinergia-v1.md       🆕 Bilateral
│   └── inter-parceiros/                             Portabilidade
│       ├── acordo-cooperacao-inter-parceiros-v1.md  🆕 Entre instituições
│       └── termo-transferencia-membro-v1.md         🆕 Membro muda instituição
│
├── 02-termos-responsabilidade/                      Termos complementares
├── 03-procuracoes/                                  Outorga de poderes
├── 04-contratos-internos/                           Cessão usinas, etc
└── 05-anexos-lgpd-privacidade/                      LGPD
```

## Princípios diretivos universais

### Para TODOS os documentos:

1. **Identificação correta das partes** — cada instituição tem regime jurídico próprio
2. **SISGDSOLAR é infraestrutura técnica**, não parte signatária dos termos membro-instituição
3. **Bilateralidade** dos termos de adesão (instituição × membro)
4. **Foro Vitória/ES**
5. **Suporte a assinatura eletrônica** (MP 2.200-2/2001, Lei 14.063/2020)
6. **Conformidade LGPD** (Lei 13.709/2018)
7. **Versionamento semântico** + changelog

### Para CoopereBR especificamente:

8. **Natureza cooperativa** explícita (Lei 5.764/71 + CRFB 146 III "c" + 174 § 2º + STF Tema 536)
9. **Ato cooperativo típico** (Art. 79 Lei 5.764/71)
10. **Direitos cooperados** preservados (Art. 4º — sobras, voto, etc.)

### Para Sinergia especificamente:

11. **Natureza de consórcio** explícita (regime jurídico aplicável)
12. **Contrato de consórcio** caracterizado

### Para Inter-Parceiros:

13. **Liberdade de associação** preservada
14. **Não-aliciamento** entre parceiros
15. **Transparência** sobre mudança de regime ao membro
16. **Carência razoável** antes de transferência

## Status atual por documento

| Documento | Localização | Status |
|---|---|---|
| Termo Adesão CoopereBR (bilateral) | `01-termos-adesao/coopere-br/modelo-termo-adesao-bilateral-v3.md` | 🟢 Proposto v3 |
| Termo Adesão Sinergia | `01-termos-adesao/sinergia/modelo-termo-adesao-sinergia-v1.md` | 🟡 Proposto v1 (depende confirmação regime) |
| Acordo Inter-Parceiros | `01-termos-adesao/inter-parceiros/acordo-cooperacao-inter-parceiros-v1.md` | 🟢 Proposto v1 |
| Termo Transferência Membro | `01-termos-adesao/inter-parceiros/termo-transferencia-membro-v1.md` | 🟢 Proposto v1 |
| Contrato SaaS Parceiro × SISGDSOLAR | `00-contratos-saas-instituicoes/modelo-contrato-saas-parceiro-v1.md` | 🟡 Proposto v1 |
| Demais documentos (Camadas 4-5) | Outras pastas | ⏸️ Placeholder |

## Roadmap consolidado

### Curto prazo (próximas 2 semanas)
- [ ] Aprovação Luciano dos modelos das Camadas 1, 2 e 3
- [ ] Revisão por advogado especializado
- [ ] Confirmação regime jurídico Consórcio Sinergia
- [ ] Esclarecimento CNPJ SISGDSOLAR (49.950.705/0001-69 × 58.103.611/0001-45)

### Médio prazo (próximo mês)
- [ ] Contrato de Cessão de Usina (cooperado-dono → CoopereBR)
- [ ] Política LGPD + Termo de Consentimento
- [ ] Procuração administração SCEE (cooperado → CoopereBR)
- [ ] Termo de Responsabilidade Técnica

### Longo prazo
- [ ] Termo de Adesão Clube/CooperToken
- [ ] Procuração Representação Judicial
- [ ] Contrato CoopereBR × Indicador (programa MLM)
- [ ] Contrato Cooperado SEM_UC (indicador puro)

---

## Princípio de blindagem CoopereBR

Todos os documentos da CoopereBR devem proteger explicitamente contra responsabilização por:
- Atos da distribuidora local (EDP-ES, etc.) — classificação tarifária, faturamento, cobrança
- Atos da ANEEL ou MME — regulamentação, classificação, percentuais de Fio B
- Decisões fiscais (Receita Federal, SEFAZ, ISS)
- Atos do SISGDSOLAR (operadora técnica de plataforma) ou outros operadores
- Variações tarifárias regulatórias supervenientes
- Casos fortuitos ou força maior, **inclusive força maior regulatório**

---

## 🚀 Próxima evolução — Módulo Documentos no SISGD

**Decisão Luciano 16/05/2026:** os documentos deste repositório serão **integrados como módulo nativo do SISGD**, com:

- ✅ Acesso pelo menu (Administração / Documentos)
- ✅ Documentos editáveis in-app (Markdown + preview)
- ✅ Criação automática quando novo parceiro entra (hook `onPartnerCreated`)
- ✅ Templates mestres (SUPER_ADMIN) + customizações por parceiro
- ✅ Geração automática ao cooperado aderir (substitui placeholders)
- ✅ Integração com plataforma de assinatura (Assinafy/DocuSign)
- ✅ Versionamento + auditoria via AuditLog

**Localização planejada:**
- Backend: `backend/src/documentos/`
- Frontend SUPER_ADMIN: `web/app/dashboard/super-admin/documentos/`
- Frontend Parceiro: `web/app/dashboard/configuracoes/documentos/`
- Frontend Cooperado: `web/app/dashboard/cooperado/meus-documentos/`

**Status:** Sprint Módulo Documentos catalogado no plano A→H (entra após Sprint G Assinafy, ~46h Code).

**Detalhes:** ver `~/.claude/projects/C--Users-Luciano-cooperebr/memory/sugestao_modulo_documentos_multitenant_16_05.md`

Enquanto isso, este repositório `docs/templates-documentos/` funciona como **fonte da verdade dos templates** que alimentarão o módulo quando estiver implementado.

---

**Repositório vivo.** Atualizar a cada nova versão. Manter histórico em pastas `arquivado/` (não deletar versões anteriores).
