# SKILL — CooperToken (pro Coop)
> Skill de conhecimento pro Coop tratar perguntas e diagnósticos de CooperToken. Carregar no startup (referenciar no AGENTS.md). Read-only por padrão; mover token EXIGE aprovação do Luciano.

## O que é CooperToken (não confundir)
- **CooperToken (CTK)** = crédito de fidelidade / voucher de **circuito fechado**. **NÃO é dinheiro** na conta nem **kWh** de energia. Tem **valor estimado** em R$ (varia por dia — depreciação temporal).
- **kWh / saldo de energia** = créditos da distribuidora (compensação SCEE). Coisa diferente. Se o cooperado perguntar "meu saldo", confirmar SE é **token** ou **energia (kWh)**.
- Token sai do circuito por **resgate/liquidação** (recibo, **nunca "recompra"/NF de venda**) — e **resgate em R$ é só do ESTABELECIMENTO parceiro**, nunca do portador comum.
- **PROIBIDO** tratar token como "sobra" do cooperado/funcionário (simulação fiscal). Sobra acompanha energia, nunca token ("dois rios").

## Os 2 níveis de saldo (CUIDADO — fonte de confusão real)
- **Nível cooperado** — `CooperTokenSaldo` (chave `cooperadoId`). É a carteira da PESSOA/empresa cooperada. Ex.: o SISGDSOLAR tem **490 CTK** AQUI.
- **Nível cooperativa** — `CooperTokenSaldoParceiro` (chave `cooperativaId`). É a "casa" da CoopereBR. A tela `/parceiro/enviar-tokens` mexe AQUI (hoje = 0).
- ⚠️ Ao responder "saldo de token do X", use o nível **cooperado** (`CooperTokenSaldo` por `cooperadoId`), não o da cooperativa.

## Como CONSULTAR (read-only, pode fazer sozinho)
- Via API: `GET http://localhost:3000/cooper-token/saldo` (no contexto do cooperado) e `/cooper-token/extrato`.
- Via script no banco: rodar `.mjs`/`ts-node` em `C:\Users\Luciano\cooperebr\backend\` consultando `CooperTokenSaldo` por `cooperadoId` (read-only). Mostrar saldoDisponivel + saldoPendente.
- Sempre **multi-tenant**: filtrar por `cooperativaId` do cooperado.
- Valores monetários: `Math.round(x*100)/100`.

## Como AGIR
- **Sozinho:** consultar saldo/extrato, explicar o que é token, apontar inconsistência (ex.: token preso, extrato divergente) e **avisar o Luciano**.
- **Só com aprovação do Luciano:** creditar, transferir, queimar ou resgatar token; qualquer coisa que MOVE saldo.

## Perguntas comuns (respostas)
- *"Qual meu saldo de token?"* → consultar `CooperTokenSaldo` do cooperado → "Você tem X CTK (≈ R$ Y estimado hoje). Lembre: token vale desconto, não é dinheiro."
- *"Como uso o token?"* → abater a própria fatura de energia OU pagar em estabelecimento parceiro (QR). Resgate em dinheiro só pro estabelecimento.
- *"Token é o mesmo que meu crédito de energia?"* → Não. Token = fidelidade (circuito fechado). kWh = compensação da distribuidora.

## Estado atual (08/06/2026)
- Fase 1 (consultas saldo/extrato pelo WA) ✅. Fase 2 (segurança PIN/limites/OTP) ✅. Fase 3 (QR pagamento, transferência cooperado→cooperado, resgate→PIX) **NÃO construída** ainda.
- **Cadastro de PIN ainda não existe** (só validação) — se alguém pedir pra "alterar limite" e não tiver PIN, orientar que o cadastro de PIN está em construção.
