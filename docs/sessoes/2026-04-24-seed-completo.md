# Seed Convênios Hangar + Moradas (24/04/2026)

## Estrutura criada

### Convênio Hangar (EMPRESA)
- Conveniado: ACADEMIA DE GINASTICA HANGAR LTDA (CNPJ 36324580000110)
- 2 UCs reais (fixtures OCR)
- 15 Professores (nível 1): 7 DESCONTO + 8 CLUBE
- 150 Alunos (nível 2, 10 por professor): 75 DESCONTO + 75 CLUBE
- Faixas: 1-10=3%/1%, 11-50=5%/2.5%, 51-100=8%/4%, 101+=12%/6%
- registrarComoIndicacao: true

### Convênio Moradas da Enseada (CONDOMINIO)
- Conveniado: CONDOMINIO MORADAS DA ENSEADA (PJ)
- 1 UC áreas comuns (fixture OCR)
- 50 Condôminos (10 andares × 5 aptos: 101-1005)
- Faixas: 1-20=5%/2%, 21-40=8%/3%, 41+=12%/5%
- registrarComoIndicacao: false

## Totais

| Métrica | Valor |
|---|---|
| Cooperados CoopereBR total | 307 |
| Convênios | 2 |
| Membros convênio | 215 (165 Hangar + 50 Moradas) |
| UCs criadas | ~220 |

## Comando pra reexecutar
```bash
cd backend && node scripts/seed-convenios-teste.js
```
Idempotente: se Hangar já existe, pula.

## Primeiros CPFs (referência)
- Professores: 70000000007 até 70000001406
- Alunos: 80000000006 até 80000014905
- Condôminos: 90000000103 até 90000005003
