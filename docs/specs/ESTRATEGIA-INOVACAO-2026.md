# Estratégia de Inovação CoopereBR — 2026
**Versão:** 2.0 | **Data:** 2026-03-31 | **Autor:** Assis 🤝

---

## VISÃO ESTRATÉGICA: CoopereBR como VPP

A CoopereBR está em transição de **cooperativa de geração distribuída** para **Virtual Power Plant (VPP)** — uma usina virtual que agrega recursos energéticos distribuídos e os opera de forma coordenada.

### O que é uma VPP

Uma VPP agrega múltiplos recursos energéticos distribuídos (usinas, consumidores flexíveis, baterias) e os opera como se fossem uma usina única, participando do mercado de energia, prestando serviços de ancilagem e otimizando custos coletivamente.

### Por que a CoopereBR já É uma VPP em potencial

| Componente VPP | CoopereBR hoje |
|---|---|
| Geração distribuída | 3 usinas arrendadas em operação |
| Agregação de consumidores | N cooperados com UCs cadastradas |
| Plataforma de gestão | Sistema CoopereBR (backend + bot WA) |
| Mecanismo de incentivo | **CooperToken** (implementado) |
| Demand response | **Fase 2 — a implementar** |
| Mobilidade elétrica | **Planejado — ver seção 3** |

**O que faltava:** a camada de inteligência e incentivo para coordenar o comportamento dos cooperados como ativo gerenciável. O CooperToken é essa camada.

---

## 1. CooperToken como Espinha Dorsal da VPP

### 1.1 Estrutura em 3 camadas

```
Token Geração (Fase 1 — implementado)
  Origem: excedente de kWh gerado acima do contrato
  Uso: desconto na mensalidade CoopereBR
  Impacto: monetiza crédito SCEE que expiraria

Token Flex (Fase 2 — após Tarifa Branca)
  Origem: deslocamento de consumo do horário de ponta
  Uso: Clube de Vantagens + parceiros
  Impacto: demand response cooperativo = CoopereBR controla carga coletiva

Token Social (Fase 3)
  Origem: doação voluntária de superavitários
  Uso: abatimento para cooperados de baixa geração
  Impacto: resiliência e retenção da base
```

### 1.2 Por que isso é VPP textbook

Quando a Fase 2 estiver rodando:

```
17:00 → Sistema detecta pico previsto na rede ES
  ↓
WhatsApp Bot notifica 200 cooperados:
"⚡ Pico em 30 min. Desloque consumo pesado por 1h → ganhe 10 CT"
  ↓
Cooperados respondem SIM → desligam ar-condicionado, máquina de lavar
  ↓
Redução coletiva de ~500-800 kW na rede ES
  ↓
CoopereBR entrega demand response para a distribuidora
  ↓
Potencial: vender esse serviço de flexibilidade no mercado de ancilagem (futuro)
```

Nenhuma distribuidora nem concessionária oferece isso para o cliente residencial no ES. **A CoopereBR chegaria primeiro.**

---

## 2. O Problema dos 600.000 kWh Represados

### 2.1 Diagnóstico

A CoopereBR acumulou **600.000 kWh de crédito SCEE no seu CNPJ**. A distribuidora (EDP-ES) proíbe transferência para outros CNPJs/CPFs, mesmo sendo cooperados associados.

- **Valor econômico:** 600.000 × R$0,78931 = **~R$ 473.000**
- **Prazo:** lote mais antigo expira em **maio de 2028** (~25 meses)
- **Consumo próprio atual:** zero (cooperativa não tem sede com consumo relevante)
- **Risco:** R$473k virando zero se nenhuma ação for tomada

### 2.2 Três caminhos de solução

---

#### 🟢 Caminho 1 — Tokenização imediata (sem mudança regulatória)

**Pode começar esta semana.**

O SCEE não é transferido — o valor econômico que ele representa é redistribuído internamente via CooperToken.

```
Emitir 600.000 CooperTokens lastreados pelo crédito represado
  ↓
Distribuir proporcionalmente aos cooperados (por cota ou tempo de casa)
  ↓
Cooperado usa CT → desconto na mensalidade CoopereBR
  ↓
CoopereBR: usa os kWh SCEE para financiar o consumo dos carregadores EV (ver seção 3)
         financia os descontos com a receita operacional
  ↓
Resultado: R$473k que iam a zero viram fidelização real
```

**No sistema:** `CooperTokenService.creditar()` já implementado. Falta apenas:
- Tela de admin para emissão manual dos 600k tokens com regra de distribuição
- Definir critério de distribuição: proporcional à cota? Por tempo de associação?

---

#### 🟡 Caminho 2 — Contestação jurídica (médio prazo)

A Lei 14.300/2022, Art. 4°, §1° prevê exceção cooperativista:

> "Geração compartilhada por cooperativas permite que os créditos gerados em uma ou mais UCs sejam compensados nas UCs dos cooperados associados."

A EDP-ES pode estar aplicando a regra geral sem reconhecer a exceção cooperativista. Ação: manifestação formal à ANEEL questionando se os 600k kWh acumulados podem ser retroativamente migrados para o modelo de geração compartilhada cooperativista.

Se favorável: créditos redistribuídos legalmente para as UCs dos cooperados — sem necessidade de tokens.

---

#### 🔵 Caminho 3 — Reestruturação prospectiva (evitar acúmulo futuro)

Renegociar com a EDP-ES o cadastro das 3 usinas: de "autoconsumo do CNPJ" para "geração compartilhada cooperativista". A partir daí, kWh novos vão direto para as UCs dos cooperados. Zero acúmulo no CNPJ.

---

### 2.3 Recomendação: executar os 3 em paralelo

| Caminho | Dependência | Quando começar |
|---|---|---|
| Tokenização (C1) | Apenas desenvolvimento interno | Agora |
| Contestação ANEEL (C2) | Advogado especialista em energia | Abril/2026 |
| Reestruturação EDP (C3) | Negociação com a distribuidora | Maio/2026 |

---

## 3. Mobilidade Elétrica — Consumo Estratégico dos Créditos

### 3.1 A ideia

Instalar carregadores de veículos elétricos (EVs) em parceiros — **pedido feito no CNPJ da CoopereBR** — para criar consumo próprio que absorva os 600k kWh represados.

### 3.2 Modelo de negócio

```
Parceiro (condomínio, estacionamento, shopping)
  → investe no hardware (carregador)
  → cede o ponto de instalação
  
CoopereBR
  → entra com o CNPJ (ponto de conexão SCEE)
  → fornece a energia via créditos represados (custo zero)
  → cobra taxa por kWh carregado ou mensalidade de acesso
  
Usuário final (motorista EV)
  → paga R$/kWh ou mensalidade
  → pode ser cooperado → recebe Token Flex
  
Resultado:
  → CoopereBR: receita nova + drena os 600k kWh
  → Parceiro: infraestrutura sem custo de energia
  → Cooperado motorista EV: desconto via token
```

### 3.3 Dimensionamento

| Cenário | Pontos | kWh/mês | Prazo para drenar 600k |
|---|---|---|---|
| Conservador | 5 pontos | ~2.500 kWh | ~20 anos (insuficiente) |
| Viável | 20 pontos | ~10.000 kWh | ~5 anos |
| Agressivo | 50 pontos | ~25.000 kWh | ~2 anos |

**Recomendação:** meta de 20 pontos até dezembro/2026. Isso drena ~120k kWh/ano e cria uma linha de receita nova antes que o saldo expire.

### 3.4 Integração com o sistema CoopereBR

- Carregador registrado como "UC parceiro" no sistema
- Consumo mensal importado via API do carregador ou leitura manual
- Revenue share com parceiro configurado no módulo Financeiro
- Cooperados que carregam o EV recebem Token Flex automaticamente

---

## 4. Roadmap de Inovação 2026-2027

### Horizonte 1 — 2026 Q2 (próximos 3 meses)
- [ ] Emissão dos 600k CooperTokens lastreados (Caminho 1)
- [ ] Tela de admin para distribuição proporcional de tokens
- [ ] Integrar CooperToken no CobrancasService (desconto no boleto)
- [ ] Integrar CooperToken no FaturasService (crédito ao processar fatura)
- [ ] Primeiro parceiro de carregador EV assinado

### Horizonte 2 — 2026 Q3-Q4
- [ ] 10-20 pontos de carregamento EV ativos
- [ ] Contestação ANEEL sobre os 600k kWh (C2)
- [ ] Renegociação cadastro usinas na EDP (C3)
- [ ] Frontend CooperToken no portal do cooperado

### Horizonte 3 — 2027 (pós Tarifa Branca)
- [ ] Token Flex com demand response via WhatsApp Bot
- [ ] Smart meters para cooperados prioritários
- [ ] Equalização tarifária horária intracooperativa
- [ ] Estudo de viabilidade para participar do mercado de ancilagem

---

## 5. Posicionamento Competitivo

| Capacidade | CoopereBR | Distribuidora | Outras cooperativas |
|---|---|---|---|
| Geração própria | ✅ 3 usinas | ❌ | Alguns |
| Tokenização de excedente | ✅ Implementado | ❌ | ❌ |
| Demand response coordenado | 🔄 Fase 2 | ❌ (residencial) | ❌ |
| Mobilidade elétrica integrada | 🔄 Planejado | ❌ | ❌ |
| Pool social entre cooperados | 🔄 Fase 3 | ❌ | ❌ |

**Conclusão:** a CoopereBR tem condições de ser a primeira cooperativa de GD no ES a operar como VPP completa, combinando geração, demand response, mobilidade e tokenização. A janela de vantagem competitiva é agora — antes que a Tarifa Branca force todo o mercado a se adaptar.

---

*Documento gerado por Assis — assistente IA da CoopereBR*
*Baseado em análise estratégica com Luciano — 2026-03-31*
