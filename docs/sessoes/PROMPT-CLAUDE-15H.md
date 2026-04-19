# Prompt para Claude Code — 15h

Leia o arquivo de contexto completo antes de começar:
C:\Users\Luciano\cooperebr\RELATORIO-COMPLETO-COOPEREBR-2026-03-29.md

Execute as tarefas na ordem de prioridade abaixo.
Use sempre: claude --permission-mode bypassPermissions --print
Shell: PowerShell (usar ; não &&)

---

## ORDEM DE EXECUÇÃO

### FASE 1 — Status inline nas listagens
Telas: Membros, Parceiros, UCs, Usinas, Contratos, Cobranças, Ocorrências, Usuários.
Clicar no badge de status na lista abre um select inline para trocar direto, sem abrir a ficha.
Ver detalhes na seção "PRIORIDADE 1" do relatório.

### FASE 2 — Movimentação de membros + Lista dual concessionária
Backend já pronto. Implementar frontend:
- Tela Membros: botão Mover usina + Ajustar %
- Tela Parceiro detalhe: mesmas ações
- Tela Usina detalhe: banner pós-migração + editar % inline
- Componente DualListaConcessionaria.tsx
Ver detalhes na seção "PRIORIDADE 2" do relatório.

### FASE 3 — Leads fora da área + simulação + intenção
- model LeadExpansao no Prisma
- Bot: verificar distribuidora pós-OCR, simular mesmo sem usina, capturar intenção
- Trigger: nova usina → notificar leads confirmados
- Página relatório para investidores
Ver detalhes na seção "PRIORIDADE 3" do relatório.

### FASE 4 — Cadastro por proxy
- Estados bot: CADASTRO_PROXY_*
- Endpoint: POST /cooperados/pre-cadastro-proxy
- Página: /portal/assinar/[token]/page.tsx
- Notificações indicador + convidado
Ver detalhes na seção "PRIORIDADE 4" do relatório.

### FASE 5 — Espelhamento de conversas por parceiro
- Filtro tenant em GET /whatsapp/conversas
- Aba "Conversas" em /dashboard/whatsapp/page.tsx
Ver detalhes na seção "PRIORIDADE 5" do relatório.

### FASE 6 — Menu do cooperado expandido
- Opção 3: Atualizar cadastro
- Opção 4: Atualizar contrato
- Opção 5: Indicar amigo (já usa getMeuLink())
Ver detalhes na seção "PRIORIDADE 6" do relatório.

### FASE 7 — Sugestões Assis (implementar após fases 1-6)
- Score de propensão de conversão (1-10 automático)
- Alerta preventivo de inadimplência (3 dias antes)
- NPS automático pós-simulação
- QR Code personalizado por parceiro
- Portal do proprietário: visibilidade de geração + repasses

---

Ao finalizar cada fase: commitar com mensagem descritiva e notificar:
openclaw system event --text "Fase X concluída: [resumo]" --mode now
