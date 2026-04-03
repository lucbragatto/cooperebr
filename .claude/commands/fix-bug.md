# /fix-bug

Fluxo padrão para corrigir um bug no CoopereBR.

## Uso
```
/fix-bug <ID do bug ou descrição>
```

## Passos

1. **Entender o bug**
   - Qual módulo afeta? (backend / web / whatsapp-service)
   - Qual é o comportamento esperado vs atual?
   - Tem teste que reproduz o problema?

2. **Localizar o código**
   - Buscar nos arquivos relevantes do módulo
   - Checar se há teste existente que deveria cobrir o caso

3. **Corrigir**
   - Fix mínimo e cirúrgico — não refatorar código saudável junto
   - Se envolver cálculo financeiro: verificar `Math.round()`
   - Se envolver query Prisma: verificar isolamento multi-tenant (`cooperativaId`)

4. **Testar**
   ```bash
   cd backend; npm run test -- --testPathPattern=<modulo>
   ```

5. **Documentar**
   - Atualizar o bug no `CLAUDE.md` (seção "Bugs críticos") com status `✅ Resolvido`
   - Se foi bug de produção: adicionar nota sobre causa raiz

## Bugs conhecidos (ver CLAUDE.md para status atual)

- PIX-01, CTK-01, CTK-04, WA-BOT-06
