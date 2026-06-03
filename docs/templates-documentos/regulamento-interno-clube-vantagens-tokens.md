<!--
TEMPLATE BASE — Regulamento Interno do Clube de Vantagens (Módulo de Tokens).
Gerar 1 versão vigente por PROVEDORA (cooperativa/parceiro). Variáveis {{...}} preenchidas no momento da publicação.
⚠️ RECONCILIAR os percentuais com ConfigCooperToken (sistema): taxa (hoje 2% emissão / 1% QR, hardcoded → tornar configurável, teto 15%) +
   desvalorização (modeloVida DECAY_CONTINUO → alinhar 2%/mês + graça 30d + piso + reversão ao Fundo de Reserva).
Variáveis: {{provedora.razaoSocial}} {{provedora.sigla}} {{provedora.sede}} {{provedora.orgaoGestor}} {{config.taxaTeto}}
{{config.desvalorizacaoMensal}} {{config.periodoGracaDias}} {{data.emissao}}
-->

# REGULAMENTO INTERNO DO CLUBE DE VANTAGENS – {{provedora.sigla}}
## MÓDULO DE TOKENS DE CONVENIÊNCIA COLETIVA E ECONOMIA CIRCULAR

**Preâmbulo:** O presente Regulamento Interno é editado pelo {{provedora.orgaoGestor}} da {{provedora.razaoSocial}} ({{provedora.sigla}}), no uso das suas atribuições estatutárias e legais, servindo como norma complementar ao Estatuto Social para disciplinar as condições de funcionamento, emissão, uso, governação, taxas de suporte e liquidação dos Tokens de Conveniência no âmbito do Clube de Vantagens corporativo.

## CAPÍTULO I – DA NATUREZA JURÍDICA E DO CIRCUITO FECHADO
**Artigo 1º** – O Token de Conveniência emitido pela {{provedora.sigla}} constitui, para todos os efeitos jurídicos, um *utility token* (token de utilidade) estritamente de circuito fechado, representativo de um direito de uso e fruição de benefícios e vantagens institucionais dentro do ecossistema da Cooperativa.

§1º – Os Tokens de Conveniência não possuem natureza de moeda fiduciária, valor mobiliário, investimento financeiro ou ativo de especulação, estando a sua circulação restrita exclusivamente aos limites deste Clube de Vantagens.

§2º – É expressamente proibido o resgate ou a conversão direta de tokens em moeda corrente nacional por mera solicitação de levantamento desvinculada das regras operacionais e contratuais estabelecidas neste instrumento.

## CAPÍTULO II – DOS INSTRUMENTOS DE ENGENHARIA CONTRATUAL
**Artigo 2º** – A infraestrutura de governação e circulação dos ativos digitais apoia-se estritamente na integração sistemática de 3 (três) instrumentos jurídicos indissociáveis:

1. **Este Regulamento Interno do Clube de Vantagens:** Normativa interna que dita as balizas de conformidade, taxas de rateio e controlo tecnológico;
2. **Termo de Adesão de Estabelecimento Parceiro:** Contrato que vincula os comércios parceiros e prestadores como cooperados, fixando a obrigatoriedade de recebimento do ativo e o fluxo de compensação interna;
3. **Aditivo ao Convênio Corporativo (Empresa Conveniada):** Instrumento que regula o aporte financeiro extraordinário para o "Módulo de Conveniência Coletiva", gerando o lastro fiscal de despesa operacional legítima para a empresa contratante.

## CAPÍTULO III – DO FLUXO OPERACIONAL E DA DAÇÃO EM PAGAMENTO
**Artigo 3º** – A circulação do benefício ocorrerá por meio da compensação interna de obrigações e dação em pagamento, estruturada nas seguintes etapas consecutivas:

1. **Aporte e Emissão:** A Empresa Conveniada adquire quotas de benefícios da {{provedora.sigla}} através do Aditivo ao Convênio Corporativo, realizando o rastro de pagamento bancário direto para a Cooperativa. A Cooperativa emite e credita os respetivos tokens de conveniência na carteira dos profissionais vinculados;
2. **Consumo no Parceiro:** O cooperado portador utiliza os tokens armazenados na sua carteira digital para abater, total ou parcialmente, despesas de consumo realizadas junto aos Estabelecimentos Parceiros integrados;
3. **Emissão de Nota Fiscal:** O Estabelecimento Parceiro fica obrigado a emitir Nota Fiscal de Serviços ou de Venda ao Consumidor Eletrónica (NFC-e/NF-e) correspondente ao valor integral da operação de consumo, registrando o valor pago em tokens sob a modalidade "Outros / Permuta / Voucher" nos campos apropriados de fecho do documento fiscal.

## CAPÍTULO IV – DA TAXA OPERACIONAL FLEXÍVEL (APORTES E TRANSAÇÕES)
**Artigo 4º** – Fica instituída a Taxa de Manutenção e Operacionalização da Rede do Clube de Vantagens, aplicável para fazer face às despesas de gestão, desenvolvimento tecnológico e administração do ecossistema de conveniências da {{provedora.sigla}}.

§1º – A taxa referida no caput terá o seu percentual exato determinado e revisto periodicamente pelo {{provedora.orgaoGestor}} por meio de Resolução Normativa Interna, respeitado o limite (teto) máximo global de até **{{config.taxaTeto}}% ({{config.taxaTeto_extenso}})**, ficando inteiramente dispensada a convocação de Assembleia Geral Extraordinária para fins da sua alteração ou calibração.

§2º – O {{provedora.orgaoGestor}}, no uso da sua competência de gestão, poderá determinar através de Resolução se a taxa incidirá:

- **No momento do Aporte Financeiro (Na Entrada):** Retida diretamente sobre o valor monetário depositado pelas empresas parceiras ou conveniadas para o fundo de custeio, antes da emissão e conversão dos respetivos tokens;
- **No momento da Transação ou Resgate (Na Saída):** Descontada de forma automatizada pelo sistema quando da movimentação de tokens para pagamentos, compensações energéticas ou pedidos de repasse por parte dos estabelecimentos;
- **De forma híbrida:** Dividida entre o aporte de entrada e as movimentações de saída, desde que a soma cumulativa das retenções não ultrapasse o teto estabelecido no §1º.

§3º – A incidência e a retenção da referida taxa ocorrerão de forma automatizada por meio do Sistema de Gestão SISGDSOLAR, atuando os valores arrecadados estritamente como **Quota de Rateio de Despesas** da Cooperativa, operando sob o regime de **não incidência tributária (PIS/COFINS, IRPJ e CSLL)** nos termos do art. 79 da Lei nº 5.764/71.

## CAPÍTULO V – DA DESVALORIZAÇÃO TEMPORAL PROGRAMADA (TAXA DE OXIDAÇÃO)
**Artigo 5º** – Com a finalidade de fomentar a circulação económica interna, coibir o represamento patrimonial (*hoarding*) e incentivar a utilização célere do benefício junto à rede de estabelecimentos parceiros, os Tokens de Conveniência armazenados nas carteiras digitais dos utilizadores sofrerão uma Desvalorização Temporal Programada (Taxa de Oxidação/*Demurrage*).

§1º – A desvalorização temporal operará de forma contínua pelo sistema SISGDSOLAR, aplicando uma redução automática à razão de **{{config.desvalorizacaoMensal}}% ({{config.desvalorizacaoMensal_extenso}}) ao mês**, incidente de forma exclusiva sobre o saldo de ativos digitais que permanecer sem qualquer movimentação por prazo superior a **{{config.periodoGracaDias}} ({{config.periodoGracaDias_extenso}}) dias consecutivos**.

§2º – As frações e saldos depreciados ou extintos em decorrência do decurso do tempo previsto neste capítulo serão automaticamente estornados pelo sistema e revertidos integralmente ao **Fundo de Reserva Legal** da {{provedora.sigla}} para investimentos na infraestrutura energética e de software da plataforma, sendo vedada qualquer espécie de reclamação, indemnização, ressarcimento ou recomposição de saldo por parte do utilizador.

## CAPÍTULO VI – DAS OPÇÕES DE COMPENSAÇÃO E REPASSE AO PARCEIRO
**Artigo 6º** – O Estabelecimento Parceiro acumulará na sua carteira digital os tokens recebidos de forma líquida (já deduzidas as eventuais taxas operacionais aplicadas nos termos do Artigo 4º), podendo optar livremente por duas vias de liquidação dos seus haveres:

### Secção I – Da Compensação Energética (Ato Cooperativo Puro)
**Artigo 7º** – O parceiro poderá direcionar os seus tokens líquidos para o abatimento ou quitação da sua respetiva fatura ou quota de custeio de energia renovável gerada pelas usinas integradas à {{provedora.sigla}}.

*Parágrafo Único* – Esta operação configura compensação interna de custos operacionais amparada como **Ato Cooperativo Puro** (Art. 79 da Lei nº 5.764/71), gozando de isenção total de novos tributos, sem emissão de novas notas fiscais e sem circulação de fluxo monetário externo.

### Secção II – Do Repasse de Custeio Operacional (Ato Cooperativo Auxiliar)
**Artigo 8º** – Inexistindo saldo devedor de energia suficiente para a compensação integral dos ativos acumulados, o parceiro poderá solicitar à {{provedora.sigla}} o repasse financeiro correspondente em moeda corrente nacional para a sua conta bancária oficial.

§1º – A Cooperativa executará a transferência utilizando exclusivamente os recursos financeiros aportados no seu caixa pelo Convênio Corporativo da Empresa Conveniada que originou o lote de tokens transacionados, agindo como mera mandatária do fluxo.

§2º – Por se tratar de mera liquidação de direito creditório oriundo de operação já tributada integralmente no momento da emissão da Nota Fiscal de consumo pelo parceiro (Artigo 3º), o depósito bancário efetuado pela Cooperativa entra no caixa do estabelecimento como recebimento de contas a receber, operando sem nova incidência de tributos para evitar a bitributação, e mantendo-se isento na Cooperativa por se tratar de **Ato Cooperativo Auxiliar**.

## CAPÍTULO VII – DISPOSIÇÕES FINAIS E AUDITORIA
**Artigo 9º** – Todos os parâmetros matemáticos, prazos de depreciação temporal, travas de segurança contra fraudes e aplicação das taxas operacionais vigentes são auditados diariamente e executados por rotinas de algoritmos automatizados do Sistema de Gestão SISGDSOLAR.

**Artigo 10** – Este Regulamento entra em vigor na data da sua aprovação pelo {{provedora.orgaoGestor}}, devendo ser disponibilizado para aceite eletrónico mandatório a todos os utilizadores, cooperados e estabelecimentos parceiros no momento do seu primeiro acesso à plataforma digital.

{{provedora.sede}}, {{data.emissao}}.

**{{provedora.orgaoGestor}}**
**{{provedora.sigla}}**
