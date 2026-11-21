# Sessão 19–21/11/2026 — Clube: login unificado com a CoopereBR + redesign (Code, Leonardo)

Branch: `deploy/clube-cooperebr` (deploy automático na VM `vm-clube-cooperebr`).

## TL;DR

- O clube agora mostra "até 20% da fatura em CooperTokens para usar nos parceiros" como benefício principal. O desconto direto continua como alternativa.
- O cooperado da CoopereBR entra no clube com o **mesmo celular ou e-mail do app** e recebe um código, sem senha. Se ainda não tiver cadastro no clube, o cadastro é criado na hora.
- O teste real revelou uma falha, já corrigida: um telefone **autorizado** na conta de outra pessoa abria a sessão dela. Agora só o **titular** entra.
- Ganharam visual novo, responsivo e pensado primeiro para o celular: a página inicial (com simulador), o login, o cadastro (`/entrar`) e o portal do cooperado.

## Entregas (commits em `deploy/clube-cooperebr`)

| SHA | Entrega |
|---|---|
| `613cb92` | Página inicial: tokens como benefício principal (card "Resumo do mês") |
| `0b81c46` | Login por código usando a Function `func-cadastro-benef`, com criação automática de Usuario + Cooperado |
| `4721e54` | Login responsivo em 3 etapas: celular → código → boas-vindas |
| `01d83ee` | **Fix:** só o titular abre sessão; tela de escolha quando há CPF + CNPJ; token auxiliar sem `sub` nunca vale como sessão |
| `3c557ab` | Nova página inicial com simulador de tokens + máscara de celular e sugestões de e-mail no login |
| `66a97b9` | Tela de cadastro `/entrar` no visual novo |
| `249b261` | Portal do cooperado mobile-first (abas estilo iOS, menu lateral no desktop, carteira de tokens), `viewport-fit=cover`, `lang=pt-BR` |
| (último) | `/portal/login` redireciona para `/login` |

## Infra e configuração

- **Chave da Function:** criada na Function `func-cadastro-benef`, `tbl_api_keys` **id 11** (`clube-cooperebr-login-prod`, escopo `Login`, `prod`). Está em `backend/.env` local e no `.env` da VM. O valor não foi para o repositório.
- **Variáveis da VM:** `CADASTRO_BENEF_API_URL`, `CADASTRO_BENEF_API_KEY`, `CLUBE_COOPERATIVA_ID=cmrp8xqh60000fj3dccl8scv7` ("Clube CoopereBR") e `CLUBE_SISTEMAS_PERMITIDOS=2`. Os nomes também foram registrados em `deploy/azure-vm/bootstrap.sh`, sem os valores.
- **Liga e desliga da VM:** há um agendamento que desliga por volta das 22h (horário de Brasília) e uma automação que liga às 6h.

## Bugs descobertos

1. **Login pelo telefone autorizado** (corrigido em `01d83ee`).
   - Ao validar o código, a Function devolve primeiro as contas em que o telefone está **autorizado** (`tbl_usuario_telefone_acesso`) e nem procura a conta própria.
   - O telefone 11953822691 trouxe a conta do Luciano (beneficiário 409). O clube criou o cadastro e abriu a sessão dele.
   - Agora o clube só aceita a conta se o contato digitado for o contato da própria conta.
2. **Deploy falhava sem aviso** quando a VM estava desalocada (timeout de SSH). Ficou só registrado, sem correção.

## Débitos novos

- **D-novo-SENHA-UNICA-VM (P0):** a VM roda com `AMBIENTE_REAL=false` e `DEV_AUTH_PASSWORD` fixa (escrita em `bootstrap.sh`). O login por senha aceita essa senha para **qualquer conta**, e o quadro de credenciais de teste aparece ao clicar em "Entrar com senha". Corrigir: senhas próprias para a equipe, depois desligar a senha única e esconder o quadro.
- **D-novo-FUNCTION-VINCULO (P1):** a Function `validar-codigo` deve rodar sempre as duas buscas e devolver `vinculo: PROPRIO | AUTORIZADO`.
- **D-novo-CLUBE-AUTORIZADO-CONSULTA (P2):** mostrar as contas autorizadas no clube **só para consulta**, como o Luciano decidiu.
- **D-novo-SELETOR-CPF-CNPJ (P2):** trocar entre CPF e CNPJ pelo seletor do portal sem pedir novo código. Hoje é preciso sair e entrar de novo.
- **D-novo-CADASTRO-SYNC (P3):** telefone e e-mail são copiados da CoopereBR só no primeiro acesso; não há sincronização depois.
- **D-novo-TELAS-INTERNAS-PORTAL (P2):** Tokens, Clube, Financeiro e as outras telas internas continuam no visual antigo e ficam largas no desktop.
- **D-novo-BIOMETRIA (P3):** login por passkey e "QR Code do app" estão na proposta de design, sem implementação.

## Débitos resolvidos

- O cadastro de cooperado não criava login: agora o login por código cria Usuario + Cooperado para beneficiários da CoopereBR.
- `/portal/login` antigo, com marca "SISGD" e senha, foi substituído por redirecionamento.

## Decisões registradas

- **Luciano, 19/11:** benefício principal = até 20% da fatura em tokens; desconto direto como alternativa. Para participar do clube é preciso ser cooperado, com ou sem conta de energia. Sinergia e Figata entram como empresas cooperadas que distribuem tokens por convite.
- **Leonardo, 21/11:** no clube só entra o **titular**. O acesso autorizado serve **só para consulta**. Um titular com CPF e CNPJ entra nas duas contas, escolhendo qual.
- **Padrões adotados por mim** (podem ser revistos):
  - Quem vem da CoopereBR entra como cooperado ATIVO, SEM_UC, modo CLUBE.
  - Só o sistema 2 (COOPERE-BR) é aceito.
  - Quem não tem e-mail recebe o técnico `sem-email+<CPF>@clube.cooperebr.com.br`. Evitei `.invalid` por causa da regra de limpeza automática de dados de teste.

## Pendências para a próxima sessão

1. **Senha única:** resolver o D-novo-SENHA-UNICA-VM (P0).
2. **Cadastro do Luciano:** decidir se apaga o cadastro dele no clube, criado pelo login de teste (cooperado `cmwpomu610002fj1fv4dht6cy`, usuário `cmwpomu740005fj1fcm7qxf5w`).
3. **Telefone autorizado:** conferir no SISGDSOLAR se o 11953822691 deve continuar autorizado na conta do Luciano.
4. **Function:** fazer a fase 2, com o campo `vinculo` (D-novo-FUNCTION-VINCULO).
5. **Telas internas:** levar Tokens (com "Pagar" abrindo o QR direto) e as demais telas para o visual novo.
6. **Jornada do membro:** atualizar `docs/diagramas/jornada-membro.html`. Não foi feito nesta sessão.
7. **Branch:** levar `deploy/clube-cooperebr` para `main` quando aprovado.

## Próximo passo único

Resolver a **senha única da VM**: criar senhas próprias para a equipe, depois desligar `DEV_AUTH_PASSWORD` e o quadro de credenciais.
