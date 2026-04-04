## QA Runner - Agente de Testes Automatizados

Execute a suite de testes Playwright do CoopereBR e interprete os resultados.

### Passos:

1. **Verificar servicos:**
   - Checar se backend esta rodando: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`
   - Checar se frontend esta rodando: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/`
   - Se algum estiver offline, avisar o usuario e sugerir iniciar com `cd backend ; npm run start:dev` ou `cd web ; npm run dev`

2. **Executar testes:**
   - Se ambos online: `npx playwright test --config tests/playwright.config.ts`
   - Se apenas frontend: `npx playwright test --config tests/playwright.config.ts tests/01-sanity.spec.ts tests/07-convite-publico.spec.ts`
   - Se ambos offline: avisar que nao ha testes para rodar offline

3. **Interpretar resultados:**
   - Listar cada teste com status (PASS/FAIL/SKIP)
   - Para cada FAIL, explicar:
     - O que o teste verifica
     - O que falhou
     - Possivel causa raiz
     - Sugestao de correcao
   - Gerar resumo final: X passed, Y failed, Z skipped

4. **Relatorio:**
   - Informar que o relatorio HTML esta em `tests/reports/ultima-execucao/index.html`
   - Se houver falhas criticas (sanity, auth), alertar que nao deve subir para prod

### Testes disponiveis:
- `01-sanity.spec.ts` - Backend + Frontend + pagina publica
- `02-auth.spec.ts` - Login valido/invalido
- `03-portal-cooperado.spec.ts` - Tokens, indicacoes
- `04-parceiro-dashboard.spec.ts` - Dashboard parceiro, configuracoes
- `05-admin-dashboard.spec.ts` - Planos, CooperToken, modelos cobranca
- `06-cooper-token-api.spec.ts` - API de tokens (saldo, config, resumo)
- `07-convite-publico.spec.ts` - Pagina publica de convite + calculadora
