# 01.C — Inter-Parceiros (Camada 3)

**Documentos que regulam a portabilidade de membros entre instituições parceiras do sistema SISGDSOLAR.**

---

## Conceito

Membros do ecossistema SISGDSOLAR (cooperados CoopereBR + consorciados Sinergia + futuros) podem **transferir-se** entre instituições, com regras claras de mobilidade.

```
Cooperado CoopereBR ─┐
                     ├─→ pode migrar entre parceiros ─→ Termo Transferência
Consorciado Sinergia ┘
```

## Documentos

| Arquivo | Função |
|---|---|
| `acordo-cooperacao-inter-parceiros-v1.md` | Acordo entre as INSTITUIÇÕES (CoopereBR ↔ Sinergia ↔ futuros) que regula portabilidade |
| `termo-transferencia-membro-v1.md` | Termo assinado pelo MEMBRO ao migrar |

## Princípios

### 1. Liberdade de associação
- Princípio cooperativista da adesão voluntária (Lei 5.764/71 Art. 4º I)
- Direito civil de mudança contratual (CC Art. 422 boa-fé)

### 2. Não-aliciamento
- Parceiros não podem incentivar diretamente migração entre si
- Membro decide por iniciativa própria

### 3. Carência razoável
- Mínimo 12 meses na instituição atual antes de poder migrar
- Evita "shopping abusivo"
- Aviso prévio de 90 dias

### 4. Ciência informada
- Membro deve estar ciente de que **mudança de instituição pode implicar mudança de regime jurídico**:
  - Cooperativa (sem fins lucrativos, ato cooperativo, voto, sobras)
  - Consórcio (contrato, sem voto-sobras, regime tributário próprio)
- Direitos diferentes em cada regime

### 5. Tratamento de saldos
- Saldo SCEE: portabilidade técnica condicionada à área de concessão e classe GD
- Créditos cooperativos acumulados (CooperToken, indicações): regras específicas
- Mensalidades em aberto: quitação obrigatória antes da transferência

### 6. SISGDSOLAR operacionaliza
- Plataforma técnica realiza a transferência
- Não é parte do Acordo Inter-Parceiros (são as instituições)

## Riscos mitigados

| Risco | Mitigação |
|---|---|
| Aliciamento abusivo | Cláusula expressa de não-aliciamento + multa |
| Shopping abusivo (pulando rapidamente) | Carência mínima 12 meses |
| Cliente fica "no meio" sem instituição | Aviso prévio 90 dias + assinatura prévia da nova adesão |
| Confusão sobre regime jurídico | Ciência informada obrigatória |
| Perda de saldo SCEE técnico | Procedimento operacional padrão SISGDSOLAR |
| Cobrança duplicada | Apuração financeira pré-transferência |

## Status

| Documento | Status |
|---|---|
| `acordo-cooperacao-inter-parceiros-v1.md` | 🟢 Proposto v1 |
| `termo-transferencia-membro-v1.md` | 🟢 Proposto v1 |

## Pendências

- [ ] Aprovação Luciano (representando CoopereBR + interesse SISGDSOLAR)
- [ ] Aprovação Sinergia (administrador)
- [ ] Revisão jurídica conjunta
- [ ] Definição operacional técnica (procedimento SISGDSOLAR)
- [ ] Validação com 2-3 transferências-piloto
