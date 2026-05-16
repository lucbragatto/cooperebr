# CHANGELOG — Templates de Documentos

Histórico de versões dos documentos jurídicos e contratuais.

---

## [v1.1] — 16/05/2026 (mesmo dia da v1.0, reorganização estrutural)

### Mudança arquitetural

**Esclarecimento Luciano:** SISGDSOLAR é plataforma SaaS multi-tenant (infraestrutura), não parte dos termos membro-instituição. CoopereBR e Sinergia são instituições parceiras DISTINTAS com regimes jurídicos próprios. Termos de adesão devem ser BILATERAIS.

### Adicionado
- Pasta `00-contratos-saas-instituicoes/` (NOVA — Camada 2)
- Subpasta `01-termos-adesao/coopere-br/` (cooperativa × cooperado)
- Subpasta `01-termos-adesao/sinergia/` (consórcio × consorciado)
- Subpasta `01-termos-adesao/inter-parceiros/` (portabilidade — Camada 3)
- Documentos:
  - `modelo-termo-adesao-bilateral-v3.md` (CoopereBR puro, sem SISGDSOLAR como signatário)
  - `modelo-termo-adesao-sinergia-v1.md` (Sinergia × Consorciado)
  - `acordo-cooperacao-inter-parceiros-v1.md` (entre instituições)
  - `termo-transferencia-membro-v1.md` (membro muda de parceiro)
  - `modelo-contrato-saas-parceiro-v1.md` (instituição × SISGDSOLAR)

### Refatorado
- `README.md` raiz: nova arquitetura em 3 camadas
- `01-termos-adesao/README.md`: reflete subpastas

### Marcado como obsoleto
- `01-termos-adesao/modelo-coopere-br-blindado-v2.md` → substituído pela v3 bilateral (em `coopere-br/`)
- Arquivos movidos conceitualmente para subpastas (manter referências antigas como redirect)

---

## [v1.0] — 16/05/2026

### Adicionado
- Estrutura inicial do repositório `docs/templates-documentos/`
- README principal com diretrizes
- Pasta `01-termos-adesao/` com:
  - Transcrição dos termos originais (Jucielly Nicco + Cristiano Pandini)
  - Análise jurídica comparativa
  - Modelo blindado v2 proposto (CoopereBR puro — depois superado pela v3)
- Placeholders para pastas futuras (02, 03, 04, 05)

### Pendente
- Revisão por advogado especializado em Direito Regulatório (energia)
- Aprovação Luciano dos modelos propostos
- Esclarecimento sobre divergência de CNPJ do SISGDSOLAR (49.950.705/0001-69 × 58.103.611/0001-45)

---

## Próximas versões previstas

### [v1.2] — Após aprovações
- Contrato de Cessão de Usina (cooperado-dono → CoopereBR)
- Procuração administração SCEE
- Termo de Responsabilidade Técnica

### [v1.3]
- Política LGPD + Termo de Consentimento
- Termo de Adesão Clube/CooperToken

### [v1.4]
- Procuração Representação Judicial
- Contrato Indicador (programa MLM)

---

**Política de versionamento:**
- vX.0 → mudança material com revisão jurídica completa
- vX.Y → ajustes de redação sem mudança de conteúdo
- Documentos descontinuados vão para subpasta `arquivado/` (não deletar)
