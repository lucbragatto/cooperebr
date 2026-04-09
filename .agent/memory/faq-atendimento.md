# FAQ Atendimento — Perguntas e Respostas Frequentes
**Mantido pelo Coop | Atualizado automaticamente conforme conversas**

---

## O que é a CoopereBR?

A **CoopereBR** (Cooperativa de Energia Renovável Brasil) é uma cooperativa de energia solar que permite economizar na conta de luz sem precisar instalar nada em casa.

**Como funciona:**
- A CoopereBR tem usinas solares que produzem energia
- Essa energia é injetada na rede da EDP Espírito Santo
- A EDP transforma isso em créditos de energia na conta do cooperado
- Resultado: desconto na fatura todo mês

**Vantagens:**
- Zero investimento inicial
- Sem obras ou alterações na residência
- Sem fidelidade
- 100% digital
- Energia limpa e sustentável, regulamentada pela ANEEL

O cooperado continua cliente da EDP normalmente — só paga menos.

---

## ⚠️ NOTA SOBRE DESCONTO (importante)

- O desconto é **variável** — pode passar de 20% em alguns meses
- **NÃO afirmar** que o desconto é fixo em 15%
- Dizer sempre: "pode chegar a mais de 20%" ou "desconto variável"

---

## O que preciso para ter o benefício na minha casa, escritório, empresa ou clínica?

**Requisitos:**
- Ser titular da conta de energia da unidade
- Estar na área atendida pela EDP Espírito Santo
- Não ter Tarifa Social ou benefícios tarifários conflitantes
- Ter CPF e os dados da conta de luz (número da instalação/UC)

**4 passos para aderir:**
1. Simulação no site
2. Cadastro (CPF, número de instalação, dados pessoais)
3. Análise de elegibilidade pela CoopereBR
4. Aprovação — cooperado avisado quando desconto começa

**Obs.:** Residência, escritório, empresa e clínica podem participar — cada UC é analisada individualmente. Nenhuma obra necessária, zero investimento, sem fidelidade.

Contato: cooperebr.com.br | WhatsApp (27) 4042-1630

---

## Quais documentos são necessários?

Não tem burocracia — tudo 100% online:
- CPF (do titular da conta de energia)
- Número de instalação/UC (está na própria fatura de energia)
- Dados pessoais (nome, endereço, contato)

Nada de contrato físico, cartório ou reconhecimento de firma.

---

## Posso enviar tudo pelo WhatsApp?

Sim! O processo é 100% digital. Basta tirar foto ou print da conta de luz, enviar pelo WhatsApp junto com os dados pessoais e a equipe cuida do resto.

WhatsApp: (27) 4042-1630 | Site: cooperebr.com.br

---

## ⚙️ REGRA: Registrar contatos do WhatsApp

Sempre que alguém entrar em contato pelo WhatsApp da CoopereBR:
- Salvar o **número de telefone**
- Salvar o **nome** (quando disponível — extraído do OCR, do cadastro ou informado pelo usuário)
- Esses dados ficam no banco (tabela `ConversaWhatsapp` e `Cooperado`) para recontato futuro
- Luciano pode solicitar a lista de contatos para campanhas, follow-up ou abordagem comercial

Usar o script `ver-msgs-luciano.mjs` como referência para consultas rápidas por telefone.

---

## ⚙️ REGRA: Call-to-action no final de toda resposta

No final de **toda** resposta da CoopereAI, incluir uma linha contextual sugerindo o próximo passo:

| Contexto da pergunta | Call-to-action sugerido |
|---|---|
| Desconto, economia, quanto vou pagar | _"Quer simular sua economia? Digite **simulação**."_ |
| Fatura, conta, status, pagamento | _"Para consultar sua fatura ou status, digite **fatura**."_ |
| Cadastro, como entrar, participar | _"Para iniciar seu cadastro, digite **cadastro**."_ |
| Dúvida genérica / qualquer outra | _"Para ver todas as opções, digite **menu**."_ |
| Quer falar com pessoa | _"Para falar com nossa equipe, digite **atendimento**."_ |

**Regra:** a sugestão deve ser **contextual** — não jogar sempre "menu". Pensar no que faz mais sentido para aquele usuário naquele momento.

---

## ⚙️ REGRA: Fluxo de primeiro atendimento (CoopereAI PRIMEIRO)

### Qualquer mensagem de número desconhecido → CoopereAI responde primeiro

NÃO mostrar menu automático. A CoopereAI é a porta de entrada.

**Exemplo de fluxo:**
- Usuário: "oi"
- CoopereAI: "Olá! Tudo bem? 😊 Aqui é a CoopereBR, cooperativa de energia solar. Você já conhece o nosso projeto?"
- Usuário responde qualquer coisa → CoopereAI segue a conversa naturalmente
- Ao final de cada resposta: call-to-action contextual (ver regra acima)
- Se não souber responder: "Vou chamar um dos nossos colaboradores para te ajudar! Eles entrarão em contato em breve."

### Captura de dados do contato
1. **Número** → sempre salvo automaticamente ao receber qualquer mensagem
2. **Nome** → tentar extrair do perfil do WhatsApp. Se não disponível:
   - Perguntar: "Como posso te chamar?"
   - Salvar no banco assim que responder
3. **Email** → perguntar somente quando fizer sentido no contexto (ex: cadastro, simulação)
   - "Para te enviar a simulação detalhada, qual seu email?"
   - Salvar no banco assim que responder
4. Todos os dados vão para: tabela `ConversaWhatsapp` + `Cooperado` (ou `Lead` se não for cooperado ainda)

### Quando encaminhar para humano
- Pergunta que a CoopereAI não consegue responder após 2 tentativas
- Usuário pede explicitamente por atendente
- Situação sensível (reclamação, problema com conta, inadimplência)
- Resposta: "Vou chamar um colaborador para te ajudar. Eles entrarão em contato em breve! 🙏"

### Menu
- Só aparece quando usuário digitar **menu** explicitamente
- Ou quando CoopereAI sugerir e usuário aceitar
- Nunca jogar o menu de surpresa na primeira mensagem

---

## Como descubro quanto vou economizar?

Duas formas:
1. Calculadora no site cooperebr.com.br — informa o valor médio da conta e mostra a economia estimada
2. Pelo WhatsApp (27) 4042-1630 — envia foto ou valor da fatura e a equipe faz a simulação

Referência: conta de ~R$ 150/mês → ~R$ 11/mês de economia (~R$ 136/ano). Quanto maior o consumo, maior a economia.
Lembrar: desconto é variável e pode passar de 20%.

---

---

## 📥 Perguntas frequentes identificadas automaticamente (06/04/2026)

_Estas perguntas foram identificadas nas conversas do WhatsApp e ainda não têm resposta definida. Luciano deve revisar e adicionar as respostas._

### ❓ "Cooperai tá na área?" *(1x nos últimos 30 dias)*
**Resposta:** _(a definir)_

### ❓ "Coopere AI tá na ativa?" *(1x nos últimos 30 dias)*
**Resposta:** _(a definir)_

### ❓ "Tem outra conta em nome de Jucielly, pode olhar como está por favor!" *(1x nos últimos 30 dias)*
**Resposta:** _(a definir)_

### ❓ "Ainda nem dormi! Os agentes estão testando?" *(1x nos últimos 30 dias)*
**Resposta:** _(a definir)_

