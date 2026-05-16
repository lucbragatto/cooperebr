# 00 — Contratos SaaS Instituições × SISGDSOLAR

**CAMADA 2 do ecossistema:** contratos que regulam a relação entre a plataforma SISGDSOLAR (Luciano) e as instituições parceiras (CoopereBR, Sinergia, futuros).

---

## Por que vem antes (numeração 00)

Esta camada é **estrutural**: define a relação SaaS entre a plataforma e as instituições parceiras. Sem isso, as instituições não podem operar tecnicamente, e os termos de adesão da Camada 1 (membro × instituição) não têm infraestrutura de execução.

```
SISGDSOLAR (Plataforma SaaS)
    │
    ├── Contrato SaaS × CoopereBR  ← Esta pasta (Camada 2)
    ├── Contrato SaaS × Sinergia   ← Esta pasta (Camada 2)
    └── Contrato SaaS × futuros parceiros
```

## Documentos

| Arquivo | Descrição |
|---|---|
| `README.md` | Este índice |
| `modelo-contrato-saas-parceiro-v1.md` | Modelo de contrato SaaS aplicável a qualquer parceiro |

## Características do contrato SaaS

- **Natureza:** contrato comercial (prestação de serviços de plataforma SaaS)
- **Partes:**
  - SISGDSOLAR TECNOLOGIA LTDA (provedora)
  - Instituição parceira (cliente SaaS) — CoopereBR, Sinergia, ou outra
- **Objeto:** licença de uso da plataforma SISGDSOLAR para gestão de:
  - Cooperados/consorciados
  - Usinas geradoras
  - Créditos SCEE
  - Cobranças e financeiro
  - Comunicações (WhatsApp, email, push)
- **Remuneração:** mensalidade SaaS conforme plano (BRONZE, PRATA, OURO — alinhar com SISGD `PlanoSaas`)
- **Vigência:** período mensal renovável, sem fidelidade longa
- **Rescisão:** com aviso prévio razoável + portabilidade de dados (LGPD Art. 20)

## Princípios diretivos

1. **Separação clara** entre operação técnica (SISGDSOLAR) e relação cooperativa/consorcial (instituição × membro)
2. **SISGDSOLAR não responde** pelos atos de gestão das instituições parceiras
3. **Instituição parceira responde** pelos atos próprios e pelos atos dos seus membros
4. **SISGDSOLAR garante** disponibilidade técnica, segurança, conformidade LGPD da plataforma
5. **Dados são propriedade** da instituição parceira (SISGDSOLAR é operador LGPD)
6. **Portabilidade de dados** garantida em caso de rescisão (LGPD Art. 18 VII)

## Status

| Documento | Status |
|---|---|
| Modelo Contrato SaaS Parceiro × SISGDSOLAR v1 | 🟡 Proposto (placeholder estruturado) |

## Pendências

- [ ] Esclarecer CNPJ atual do SISGDSOLAR (49.950.705/0001-69 OU 58.103.611/0001-45)
- [ ] Definir planos SaaS comerciais (alinhar com `PlanoSaas` do schema)
- [ ] Definir SLA (uptime, suporte, performance)
- [ ] Definir tabela de preços
- [ ] Revisão jurídica
- [ ] Definir DPA (Data Processing Agreement) LGPD anexo
