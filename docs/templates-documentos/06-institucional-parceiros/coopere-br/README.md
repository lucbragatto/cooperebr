# 06.A — Documentos Institucionais CoopereBR

**Cooperativa de Energia Renovável Brasil — COOPERE-BR**
CNPJ: 41.604.843/0001-84 | NIRE: 32400023209
Natureza: cooperativa singular sem fins lucrativos (Lei 5.764/71)

---

## Documentos

| Arquivo | Versão | Status |
|---|---|---|
| `estatuto-social-reformado-v3.md` | v3.0 (proposta, pendente AGE 17/06/2026) | 🟡 Aguardando aprovação assembleia |
| `edital-ago-age-2026-06-17.md` | v2 (revisada) | 🟡 Aguardando publicação |
| `ata-ago-age-2026-06-17.md` | v2 (revisada) | 🟡 Aguardando realização da assembleia + assinaturas |
| `analise-juridica-8-atores.md` | v1 | ✅ Material de referência (não vinculante) |
| `analise-conformidade-aneel.md` | v1 | ✅ Material de referência (não vinculante) |

## Contexto da Reforma Estatutária 17/06/2026

A reforma proposta aborda **6 eixos**:

1. **Governança societária:**
   - Renúncia de Victor Belizario Couto (Presidente atual)
   - Eleição de Leonardo Capucho Pissinati (novo Presidente)
   - Conselho Fiscal: Leonardo Sousa Rocha (Presidente), André Vervloet Comério, Luciano Rabelo Bragatto

2. **Mudança de sede:**
   - Sede passa de Vitória/ES (Av. Fernando Ferrari 500) para Colatina/ES (Estrada Córrego Santa Fé S/N)
   - Filial passa a operar no endereço de Vitória

3. **Alçadas de assinatura:**
   - Diretor-Presidente assina **isoladamente** atos ordinários (operacional, bancário cotidiano, convênios)
   - Diretor-Presidente + Presidente Conselho Fiscal assinam **conjuntamente** para empréstimos, financiamentos e oneração de bens
   - Empréstimos exigem aprovação prévia em assembleia

4. **Categorização do quadro social:**
   - **Cooperados Beneficiários** — consumidores finais que usam serviços
   - **Cooperados Investidores/Provedores** — aportam ativos (usinas) ou capital

5. **Expansão do objeto social:**
   - Geração distribuída compartilhada (atual)
   - **+ Mobilidade elétrica urbana** (eletropostos para carros, bicicletas, patinetes)
   - **+ Convênios de saúde, alimentação, refeição, consignados**
   - **+ Parcerias com órgãos públicos** (chamadas públicas, concessão de uso de solo)

6. **Distribuição de sobras:**
   - Mantém regra cooperativa (Reserva Legal 10% + FATES 5%)
   - **Adiantamento mensal de sobras** para Cooperados Investidores/Provedores

## Pendências críticas (antes da AGE 17/06/2026)

- [ ] Revisão final do Estatuto v3 por advogado especializado em cooperativismo + direito regulatório (energia/ANEEL)
- [ ] Confirmação dos endereços (sede Colatina + filial Vitória)
- [ ] Publicação do Edital em jornal de grande circulação (Art. 38 Lei 5.764/71)
- [ ] Afixação do Edital na sede + envio aos cooperados por circular eletrônica
- [ ] Verificação do livro de presença + quórum (mínimo 10 cooperados em 3ª convocação)
- [ ] Ata pronta para assinatura no dia da assembleia
- [ ] Pós-aprovação: registro na JUCEES + Receita Federal
- [ ] Adequações operacionais no sistema SISGD pós-reforma (módulo Cooperados — adicionar categoria Investidor/Provedor)
- [ ] Adequação do termo de adesão atual (Camada 01) pra refletir mudança de sede

## Reflexos da reforma estatutária no Sistema SISGD

A reforma terá impactos nos seguintes módulos do SISGD:

| Módulo | Impacto |
|---|---|
| **Cooperados** | Adicionar campo `categoriaCooperado` (BENEFICIARIO \| INVESTIDOR_PROVEDOR \| FUNDADOR) |
| **Usinas** | Já possui `formaAquisicao` + `formaPagamentoDono` (Bloco H' em andamento) |
| **Cadastro CoopereBR** | Atualizar sede para Colatina/ES + filial Vitória |
| **Documentos** | Termo de adesão precisa citar nova sede |
| **Comercial** | Novos módulos: Mobilidade elétrica (eletropostos), Convênios saúde/alimentação |
| **Financeiro** | Tratamento contábil: Ingresso de Custeio para Ato Cooperativo Auxiliar |
| **AuditLog** | Registrar todas as decisões societárias |

⚠️ Esses reflexos no sistema **NÃO** são automáticos — requerem desenvolvimento de código posterior. Catalogar como débitos técnicos pós-reforma.

## ⚠️ Observação importante sobre material recebido externamente

Este material foi compilado a partir de uma conversa anterior com outra IA (ChatGPT/Gemini). O conteúdo jurídico foi mantido por estar tecnicamente sólido, **mas referências a:**

- Arquivo `sys/sisgdsolar/helpcontent/auditoria_estatutaria.md`
- Scripts Python de auditoria automatizada
- Integrações de "trava bancária" via API
- "Módulos de governança automatizada"

**FORAM REMOVIDAS** — não correspondem à realidade do sistema atual e foram **invenções da outra IA**. O SISGD não tem nenhum desses recursos automatizados ainda. Caso eles sejam desejados, devem ser implementados como módulos novos (catalogar em débitos técnicos).
