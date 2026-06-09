# SKILL — Bot WhatsApp (pro Coop)
> Skill de conhecimento pro Coop entender, diagnosticar e ajudar no bot conversacional do WhatsApp. Carregar no startup (referenciar no AGENTS.md). NUNCA enviar mensagem a cooperado sem aprovação do Luciano.

## Arquitetura do bot
- **Motor de FluxoEtapa** (estados + gatilhos) em `backend/src/whatsapp/whatsapp-fluxo-motor.service.ts` + `whatsapp-bot.service.ts`. Serviço WA (Baileys) na porta **3002**; backend processa na **3000**.
- **Tenant da conversa:** quando a conversa não tem `cooperativaId` (visitante), usa `DEFAULT_TENANT_ID` (env) pra renderizar o nome da cooperativa. (Corrige o antigo "assistente da **/." vazio.)

## Os 3 níveis de acesso
1. **Visitante** (número desconhecido) → funil: 1 Já sou cooperado · 2 Quero ser cooperado · 3 Falar com atendente · 4 Convidar amigo. **Zero financeiro.**
2. **Cooperado reconhecido** → MENU_COOPERADO (8 opções): 1 saldo de créditos · 2 próxima fatura · 3 atualizar cadastro · 4 atualizar contrato · 5 indicar amigo · 6 suporte · 7 atendente · **8 💎 CooperTokens**.
3. **Cooperado + PIN** → operações financeiras (Fase 3, em construção).

## "Qual cadastro?" (multi-papel) — NOVO
- Se o número casa com **mais de um cooperado** (ex.: Luciano PF + SISGDSOLAR PJ no mesmo telefone), o bot pergunta **"Qual cadastro você quer usar?"** e fixa o escolhido na sessão.
- Comando **TROCAR CADASTRO** alterna a qualquer momento.
- Reconhecimento na entrada: INÍCIO/MENU/saudação já tenta reconhecer antes do funil de visitante.

## Comandos universais (funcionam a qualquer momento)
- **MENU** / **INÍCIO** → volta ao menu · **SAIR** → encerra · **TROCAR CADASTRO** → troca o cadastro ativo.

## Submenu CooperToken (opção 8)
1 Ver saldo · 2 Ver extrato (10 últimas) · 3 Alterar limite 🔐 (exige PIN — em construção) · 0 Voltar.

## Onde diagnosticar (Coop pode, read-only)
- Logs: `C:\Users\Luciano\cooperebr\logs\` (wa-out.log, wa-error.log, nest-*).
- Etapas/modelos de mensagem: tabelas `FluxoEtapa` / modelos no banco (há override por tenant > global).
- Conversa: `ConversaWhatsapp` (estado, cooperadoId, cooperativaId, dadosTemp).
- Saúde: `pm2 list` (cooperebr-whatsapp deve estar online + "connection open" no log).

## Regras de atendimento (Coop)
- **NUNCA** enviar mensagem a cooperado sem **aprovação explícita do Luciano**.
- Ao falar com o Luciano, **identificar-se**: começar com "Coop aqui:".
- Acentuação e nome da cooperativa corretos (bugs de "**"/"P"/acentos já corrigidos em 08/06).
- Operação financeira (mover token) **sempre** exige PIN + aprovação.

## Débitos/pendências conhecidas (pra Coop não se surpreender)
- Cadastro de PIN não existe ainda (só validação).
- Mensagem de convite usa **link com IP local** (192.168.3.88:3001) — só abre na mesma rede; direção futura = **confirmar/cadastrar pelo próprio WhatsApp** (conversacional).
- Telefone aparece mal formatado em algumas listas de convite (cosmético).
- "Enviar tokens" hoje é nível cooperativa (saldo 0) — empresa→funcionário (Fase 3) em planejamento.
