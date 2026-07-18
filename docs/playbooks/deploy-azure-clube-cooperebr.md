# Deploy Azure - Clube CoopereBR

Memoria operacional do ambiente publicado em VM unica no Azure para o projeto CoopereBR.

Ultima atualizacao: 2026-07-18.

## Ambiente Atual

- URL publica do clube: `https://clube.cooperebr.com.br`
- URL do sistema/cliente: `https://cliente.clube.cooperebr.com.br`
- Login administrativo: `https://cliente.clube.cooperebr.com.br/login`
- Captacao publica do sistema: `https://cliente.clube.cooperebr.com.br/entrar`
- Azure resource group: `rg-clube-cooperebr`
- Azure VM: `vm-clube-cooperebr`
- IP publico: `20.226.32.2`
- Branch publicada: `deploy/clube-cooperebr`
- Workflow GitHub Actions: `Deploy Clube CoopereBR VM`
- Workflow file: `.github/workflows/deploy-clube-cooperebr-vm.yml`
- Script de deploy na VM: `deploy/azure-vm/deploy.sh`
- Script de bootstrap da VM: `deploy/azure-vm/bootstrap.sh`

Este ambiente foi criado para baixo custo. Ele nao e a arquitetura final recomendada para producao critica.

## Arquitetura

Tudo roda na mesma VM:

- Nginx nas portas `80` e `443`
- Frontend Next.js na porta interna `3001`
- Backend NestJS na porta interna `3000`
- WhatsApp service na porta interna `3002`
- PostgreSQL local na propria VM
- PM2 gerenciando os processos Node
- Certificado HTTPS via Let's Encrypt/Certbot

Fluxo de acesso:

```text
Internet
  -> https://clube.cooperebr.com.br ou https://cliente.clube.cooperebr.com.br
  -> Nginx
  -> /      para frontend Next.js 3001
  -> /api   para backend NestJS 3000
  -> /wa    para whatsapp-service 3002
```

## DNS

O Registro.br deve ter o registro:

```text
Tipo: A
Nome: clube
Valor: 20.226.32.2
```

E tambem:

```text
Tipo: A
Nome: cliente.clube
Valor: 20.226.32.2
```

Para validar:

```powershell
Resolve-DnsName clube.cooperebr.com.br -Type A -Server 8.8.8.8
Resolve-DnsName cliente.clube.cooperebr.com.br -Type A -Server 8.8.8.8
curl.exe -I https://cliente.clube.cooperebr.com.br/login
```

Resultado esperado:

```text
clube.cooperebr.com.br -> 20.226.32.2
cliente.clube.cooperebr.com.br -> 20.226.32.2
HTTP/1.1 200 OK
```

## Como Publicar Alteracoes

Qualquer push na branch `deploy/clube-cooperebr` dispara o deploy automatico.

Fluxo local:

```powershell
git checkout deploy/clube-cooperebr
git status --short --branch
git add <arquivos>
git commit -m "mensagem objetiva"
git push
```

Depois acompanhar:

```powershell
gh run list --repo lucbragatto/cooperebr --branch deploy/clube-cooperebr --limit 5
gh run watch <run-id> --repo lucbragatto/cooperebr --exit-status
```

O workflow entra na VM por SSH e executa:

```text
git fetch origin deploy/clube-cooperebr
git checkout deploy/clube-cooperebr
git reset --hard origin/deploy/clube-cooperebr
npm ci
prisma generate
prisma db push
build backend
build frontend
pm2 startOrReload
```

## GitHub Secrets

O workflow usa estes secrets:

```text
AZURE_CLUBE_HOST
AZURE_CLUBE_USER
AZURE_CLUBE_SSH_KEY
```

Nao registrar valores reais destes secrets em Markdown, commit, issue ou PR.

Para conferir os nomes:

```powershell
gh secret list --repo lucbragatto/cooperebr
```

## Validacao Depois do Deploy

Validar HTTP/HTTPS:

```powershell
curl.exe -I https://cliente.clube.cooperebr.com.br/login
curl.exe -I http://cliente.clube.cooperebr.com.br/login
```

Esperado:

- HTTPS retorna `200 OK`
- HTTP retorna `301` para HTTPS

Validar que credenciais de desenvolvimento nao aparecem publicamente:

```powershell
$html = (Invoke-WebRequest -UseBasicParsing https://cliente.clube.cooperebr.com.br/login).Content
$html -match 'superadmin@cooperebr.com.br'
$html -match 'Credenciais de teste'
```

Esperado:

```text
False
False
```

Validar processos na VM:

```powershell
ssh -i <caminho-chave-ssh> azureuser@20.226.32.2 "sudo pm2 status"
```

Processos esperados:

```text
cooperebr-backend
cooperebr-frontend
cooperebr-whatsapp
```

## Banco De Dados

Este ambiente usa PostgreSQL local dentro da VM.

Dados principais:

```text
Host: localhost
Porta: 5432
Database: cooperebr
Usuario: cooperebr
```

A connection string fica no arquivo da VM:

```text
/opt/cooperebr/app/backend/.env
```

Nao commitar o valor real de `DATABASE_URL`.

## HTTPS

O certificado foi emitido com Let's Encrypt para:

```text
clube.cooperebr.com.br
cliente.clube.cooperebr.com.br
```

Comandos uteis na VM:

```bash
sudo certbot certificates
sudo systemctl status certbot.timer --no-pager
sudo nginx -t
sudo systemctl reload nginx
```

O Certbot instala renovacao automatica via timer do systemd.

## Variaveis Importantes

Frontend publicado:

```text
NEXT_PUBLIC_API_URL=https://cliente.clube.cooperebr.com.br/api
NEXT_PUBLIC_WHATSAPP_URL=https://cliente.clube.cooperebr.com.br/wa
NEXT_PUBLIC_MODO_TESTE=false
NEXT_PUBLIC_AMBIENTE_REAL=true
```

Observacao importante:

- O frontend usa `NEXT_PUBLIC_AMBIENTE_REAL=true` para nao mostrar recursos/credenciais dev.
- O backend deste ambiente ainda usa autenticacao local com Postgres porque Supabase real nao esta configurado neste deploy barato.
- Antes de producao real, revisar `AMBIENTE_REAL`, Supabase/Auth real, seeds, usuarios e senhas.

## Custo E Limites

Este formato foi escolhido para ser barato:

- 1 VM pequena
- 1 disco
- 1 IP publico
- PostgreSQL local, sem Azure Database gerenciado

Limites:

- Sem backup gerenciado automatico do banco
- Sem alta disponibilidade
- Deploy executa `prisma db push`, que e pratico para ambiente de validacao, mas exige cuidado em producao real
- Se a VM cair, frontend, backend, WhatsApp service e banco caem juntos

## Producao Futura No GitHub

Para producao real, criar ambiente separado. Sugestao:

```text
develop -> homologacao
main    -> producao
```

Workflow de producao sugerido:

```text
.github/workflows/deploy-production.yml
```

Secrets separados:

```text
AZURE_PROD_HOST
AZURE_PROD_USER
AZURE_PROD_SSH_KEY
```

Infra recomendada para producao:

- VM/App Service separado do ambiente clube
- PostgreSQL gerenciado no Azure Database for PostgreSQL
- Backups automaticos
- Variaveis reais de ambiente
- `AMBIENTE_REAL=true` no backend
- Supabase/Auth real ou outro provedor de auth definitivo
- Usuarios e senhas sem seed/dev
- Monitoramento e logs
- Deploy via PR para `main`, nao push direto

Fluxo esperado:

```text
feature/*
  -> PR para develop
  -> validacao/homologacao
  -> PR para main
  -> GitHub Actions publica producao
```

## Comandos Azure Uteis

Listar recursos:

```powershell
az resource list -g rg-clube-cooperebr --query "[].{name:name,type:type}" -o table
```

Abrir porta:

```powershell
az vm open-port -g rg-clube-cooperebr -n vm-clube-cooperebr --port 443 --priority 1010
```

Ver IP publico:

```powershell
az network public-ip show -g rg-clube-cooperebr -n pip-clube-cooperebr --query ipAddress -o tsv
```

## Incidentes Comuns

Se o dominio nao abrir na maquina local, mas resolver no Google DNS:

```powershell
Resolve-DnsName clube.cooperebr.com.br -Type A -Server 8.8.8.8
```

Pode ser cache DNS local. Testar em rede movel ou aguardar propagacao.

Se o build Next.js falhar com permissao em `.next`:

```bash
sudo chown -R azureuser:azureuser /opt/cooperebr/app/web/.next /opt/cooperebr/app/web/.env
```

Se o PM2 nao achar processos sem `sudo`, os processos atuais estao sob o PM2 do root:

```bash
sudo pm2 status
sudo pm2 restart cooperebr-frontend --update-env
sudo pm2 save
```

## Memoria Da Implantacao

Principais fatos da implantacao inicial:

- Criado o resource group `rg-clube-cooperebr`.
- Criada VM `vm-clube-cooperebr` em `brazilsouth`.
- Criado IP publico `20.226.32.2`.
- Criado workflow `Deploy Clube CoopereBR VM`.
- Configurado deploy automatico por push na branch `deploy/clube-cooperebr`.
- Configurado DNS `clube.cooperebr.com.br` apontando para `20.226.32.2`.
- Configurado DNS `cliente.clube.cooperebr.com.br` apontando para `20.226.32.2`.
- Instalado HTTPS com Let's Encrypt.
- Removidos recursos e secrets antigos com nome de teste.
- Validado `https://cliente.clube.cooperebr.com.br/login` com `200 OK`.
- Validado que a pagina `/login` nao mostra credenciais dev no ambiente publicado.
