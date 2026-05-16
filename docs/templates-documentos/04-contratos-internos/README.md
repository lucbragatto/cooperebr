# 04 — Contratos Internos

Contratos celebrados pela CoopereBR com cooperados-donos de usinas, parceiros operacionais, comerciais e demais relações estruturantes.

**Status:** ⏸️ Placeholder — documentos a desenvolver

---

## Documentos previstos para esta pasta

### 4.1 — Contrato de Cessão de Usina (Cooperado-Dono → CoopereBR)
**Conteúdo previsto:**
- Identificação da usina (dados ANEEL, capacidade, classe GD, endereço, coordenadas)
- Forma de cessão (CESSAO, ALUGUEL ou PROPRIA — corresponde ao enum `FormaAquisicao` do schema Usina)
- Forma de pagamento ao dono (FIXO ou PERCENTUAL — `FormaPagamentoDono`)
- Vigência e renovação automática
- Responsabilidades operacionais do dono
- Garantia de geração mínima
- Responsabilidades da CoopereBR (administração SCEE, rateio, comunicação cooperados)
- Cláusula de inadimplência e suspensão
- Foro Vitória/ES

**Quando usar:** quando cooperado cede sua usina à cooperativa para operação cooperativa de geração distribuída compartilhada. Modelo fundamental para o cadastro de usinas no SISGD.

### 4.2 — Contrato CoopereBR × SISGDSOLAR (Operação Técnica)
**Conteúdo previsto:**
- Objeto: prestação de serviços técnicos de gestão SCEE
- Responsabilidades técnicas SISGDSOLAR
- Responsabilidades cooperativas CoopereBR (decisão final, autoridade)
- Remuneração mensal
- Confidencialidade e LGPD
- Cláusula de não-representação (SISGDSOLAR NÃO representa legalmente a CoopereBR)
- Vigência e rescisão
- Auditoria e prestação de contas

**Quando usar:** formalizar a relação entre cooperativa e operadora técnica. **Pendente:** esclarecer qual CNPJ SISGDSOLAR é o vigente.

### 4.3 — Contrato CoopereBR × Parceiro Comercializador (ex: Sinergia)
**Conteúdo previsto:**
- Objeto: operação conjunta de usinas geradoras parceiras
- Direitos e obrigações de cada parte
- Distribuição de créditos cooperados-CoopereBR × clientes-Sinergia
- Responsabilidade técnica e operacional
- Cláusula de não-conflito de interesses
- Foro Vitória/ES

**Quando usar:** quando CoopereBR opera em parceria com consórcios ou comercializadoras para compartilhamento de capacidade de usinas.

### 4.4 — Contrato CoopereBR × Indicador (programa MLM)
**Conteúdo previsto:**
- Objeto: programa de indicação de novos cooperados
- Critérios de comissionamento
- Vedações (práticas piramidais, garantias falsas)
- Confidencialidade de dados de indicados (LGPD)
- Validade da indicação (cooperado precisa efetivar adesão)
- Foro Vitória/ES

**Quando usar:** estruturar o programa de indicações MLM da CoopereBR. Conexão com módulo CooperToken / Clube de Vantagens.

### 4.5 — Contrato CoopereBR × Cooperado SEM_UC (Indicador Puro)
**Conteúdo previsto:**
- Cooperado sem unidade consumidora vinculada
- Acumula créditos via indicações (modo CLUBE / CooperToken)
- Possibilidade futura de converter em UC consumidora
- Possibilidade de MST (Mercado Secundário de Tokens — D-44)
- Foro Vitória/ES

**Quando usar:** caso de uso do `TipoCooperado.SEM_UC` no schema. Bloco C do plano A→H.

---

## Princípios diretivos comuns

Todos os contratos desta pasta devem:

1. **Caracterizar como ato cooperativo** quando entre CoopereBR e cooperado
2. **Caracterizar como contrato comercial** quando entre CoopereBR e fornecedor/parceiro não-cooperado (SISGDSOLAR, Sinergia)
3. **Separar claramente as figuras jurídicas:**
   - SISGDSOLAR = prestador de serviços técnicos (não cooperado, não representante)
   - Sinergia = consórcio parceiro de geração (não cooperado, parceiro comercial)
   - Cooperados = atos cooperativos típicos
4. **Foro Vitória/ES**
5. **Conformidade LGPD**
6. **Versionamento e assinatura eletrônica**

---

**Próxima ação:** desenvolver contrato de cessão de usina (4.1) como prioridade, pois é base para cadastramento correto da Cooperebr2 e formalização da relação atual.
